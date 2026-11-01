import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import {
    date_from_filetime,
    datamine_record_format_text,
    e_datamine_parameter_type,
    read_datamine_upload,
    type s_datamine_file,
    type s_datamine_parameter,
    type s_datamine_record,
} from "@blamnetwork/datamine/reading";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { UPLOADS_FOLDER } from "src/constants";

const DATAMINE_MIME_TYPE = 'application/x-bungie-datamine';
const DATAMINE_QUEUE_FOLDER = join(UPLOADS_FOLDER, 'datamine-queue');
const MAX_CONCURRENT = 2;
const MAX_QUEUED = 32;
const INSERT_BATCH_SIZE = 500;

/** The zipped upload's `compressed.dat`, parsed. */
async function readDatamineZip(path: string): Promise<s_datamine_file> {
    return read_datamine_upload(await readFile(path));
}

/** The file's event and occurrence records (v3 definitions only describe them). */
function datamineRecords(file: s_datamine_file): s_datamine_record[] {
    return file.records.flatMap((entry) => entry.kind === 'definition' ? [] : [entry.record]);
}

function convertParameterType(type: number): 'LONG' | 'INT64' | 'FLOAT' | 'STRING' {
    switch (type) {
        case e_datamine_parameter_type.long:
            return 'LONG';
        case e_datamine_parameter_type.int64:
            return 'INT64';
        case e_datamine_parameter_type.float:
            return 'FLOAT';
        case e_datamine_parameter_type.string:
            return 'STRING';
        default:
            throw new Error(`Unknown parameter type: ${type}`);
    }
}

/** A parameter's stored values: numbers keep a numeric copy, strings do not. */
function parameterValues(parameter: s_datamine_parameter): { numericValue?: string; stringValue: string } {
    if (parameter.type === e_datamine_parameter_type.string) {
        return { stringValue: String(parameter.value) };
    }
    // int64s are stored unsigned (session ids, qwords), as rows written before this reader were.
    const value = parameter.type === e_datamine_parameter_type.int64
        ? BigInt.asUintN(64, BigInt(parameter.value))
        : parameter.value;
    const text = value.toString();
    return { numericValue: text, stringValue: text };
}

@Injectable()
export class DatamineUploadService implements OnModuleInit {
    private readonly queue: string[] = [];
    private running = 0;
    private inflight = 0;

    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) {}

    async onModuleInit() {
        await mkdir(join(process.cwd(), DATAMINE_QUEUE_FOLDER), { recursive: true });
    }

    private isDatamineUpload = (
        upload: Express.Multer.File
    ) => upload.mimetype === DATAMINE_MIME_TYPE

    public handleUpload = async (
        upload: Express.Multer.File
    ) => {
        if (!this.isDatamineUpload(upload)) {
            return;
        }

        if (this.inflight >= MAX_QUEUED) {
            this.logger.warn(`[DatamineUpload] Dropping upload; ${this.inflight} files already queued or processing`);
            return;
        }

        this.inflight++;
        const path = join(process.cwd(), DATAMINE_QUEUE_FOLDER, `${Date.now()}-${randomUUID()}.zip`);
        try {
            await writeFile(path, upload.buffer);
        } catch (error) {
            this.inflight--;
            this.logger.error(`[DatamineUpload] Failed to queue datamine file: ${error}`);
            return;
        }

        this.queue.push(path);
        this.pump();
    }

    private pump() {
        while (this.running < MAX_CONCURRENT && this.queue.length > 0) {
            const path = this.queue.shift()!;
            this.running++;
            this.processQueuedFile(path)
                .catch((error) => {
                    this.logger.error(`[DatamineUpload] Error processing datamine file: ${error}`);
                })
                .finally(async () => {
                    this.running--;
                    this.inflight--;
                    try {
                        await unlink(path);
                    } catch {
                        // temp file already gone
                    }
                    this.pump();
                });
        }
    }

    private async processQueuedFile(path: string) {
        let datamineFile: s_datamine_file;
        try {
            datamineFile = await readDatamineZip(path);
        } catch (error) {
            this.logger.error(`[DatamineUpload] Unsupported datamine file: ${error}`);
            return;
        }
        const records = datamineRecords(datamineFile);
        const sessionStartDate = date_from_filetime(datamineFile.header.session_start_date);

        await this.prisma.$transaction(async (tx) => {
            let session = await tx.datamine_session.findUnique({
                where: {
                    sessionid_session_start_date: {
                        sessionid: datamineFile.header.sessionid,
                        session_start_date: sessionStartDate,
                    },
                },
            });

            if (!session) {
                session = await tx.datamine_session.create({
                    data: {
                        sessionid: datamineFile.header.sessionid,
                        build_string: datamineFile.header.build_string,
                        build_number: datamineFile.header.build_number,
                        systemid: datamineFile.header.systemid,
                        title: datamineFile.header.title,
                        session_start_date: sessionStartDate,
                    },
                });
            }

            const eventsData = records.map((record) => ({
                event_index: record.event_index,
                session_id: session.id,
                priority: record.priority,
                game_instance: record.game_info.game_instance.toString(),
                map: record.game_info.map,
                event_date: date_from_filetime(record.event_date),
                message: datamine_record_format_text(record) || `<invalid message string: ${record.event_name}>`,
                categories: record.categories,
            }));

            for (let i = 0; i < eventsData.length; i += INSERT_BATCH_SIZE) {
                await tx.datamine_event.createMany({
                    data: eventsData.slice(i, i + INSERT_BATCH_SIZE),
                    skipDuplicates: true,
                });
            }

            const eventIndices = eventsData.map(e => e.event_index);
            if (eventIndices.length > 0) {
                await tx.datamine_event_parameter.deleteMany({
                    where: {
                        session_id: session.id,
                        event_index: { in: eventIndices },
                    },
                });
            }

            const allParameters = records.flatMap((record) =>
                record.parameters
                    .filter(parameter => parameter.name)
                    .map((parameter) => {
                        const { numericValue, stringValue } = parameterValues(parameter);
                        return {
                            event_index: record.event_index,
                            session_id: session.id,
                            key: parameter.name,
                            type: convertParameterType(parameter.type),
                            numeric_value: numericValue,
                            string_value: stringValue,
                        };
                    })
            );

            for (let i = 0; i < allParameters.length; i += INSERT_BATCH_SIZE) {
                await tx.datamine_event_parameter.createMany({
                    data: allParameters.slice(i, i + INSERT_BATCH_SIZE),
                });
            }
        }, {
            maxWait: 10000,
            timeout: 30000,
        });
    }
}
