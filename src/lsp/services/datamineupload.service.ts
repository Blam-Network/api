import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import { UPLOADS_FOLDER } from "src/constants";
import * as yauzl from 'yauzl';
import * as BLF from '@blam-network/blf_lsp';

const DATAMINE_MIME_TYPE = 'application/x-bungie-datamine';
const DATAMINE_COMPRESSED_FILE_NAME = "compressed.dat";
const DATAMINE_QUEUE_FOLDER = join(UPLOADS_FOLDER, 'datamine-queue');
const MAX_CONCURRENT = 2;
const MAX_QUEUED = 32;
const INSERT_BATCH_SIZE = 500;

function closeZip(zipfile: yauzl.ZipFile): void {
    try {
        zipfile.removeAllListeners();
        zipfile.close();
    } catch {
        // already closed or ended
    }
}

async function openDatamineZip(path: string): Promise<yauzl.ZipFile> {
    return new Promise((resolve, reject) => {
        yauzl.open(path, { lazyEntries: true }, (err, zipfile) => {
            if (err || !zipfile) {
                reject(err ?? new Error('Failed to open datamine zip'));
            } else {
                resolve(zipfile);
            }
        });
    });
}

async function readCompressedDat(zipfile: yauzl.ZipFile): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const succeed = (buf: Buffer) => {
            if (settled) return;
            settled = true;
            resolve(buf);
        };
        const fail = (err: Error) => {
            if (settled) return;
            settled = true;
            reject(err);
        };

        zipfile.on('error', fail);
        zipfile.on('end', () => fail(new Error('No compressed.dat found in zip')));
        zipfile.on('entry', (entry: yauzl.Entry) => {
            if (entry.fileName !== DATAMINE_COMPRESSED_FILE_NAME) {
                zipfile.readEntry();
                return;
            }

            zipfile.openReadStream(entry, (err, readStream) => {
                if (err || !readStream) {
                    fail(err ?? new Error('Failed to open compressed.dat'));
                    return;
                }

                const chunks: Buffer[] = [];
                readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
                readStream.on('end', () => succeed(Buffer.concat(chunks)));
                readStream.on('error', fail);
            });
        });

        zipfile.readEntry();
    });
}

async function readDatamineZip(path: string): Promise<BLF.common.s_datamine_file | undefined> {
    const zipfile = await openDatamineZip(path);
    try {
        const datamineBuffer = await readCompressedDat(zipfile);
        return BLF.common.read_datamine_file(datamineBuffer);
    } finally {
        closeZip(zipfile);
    }
}

function convertParameterType(blfType: number): 'LONG' | 'INT64' | 'FLOAT' | 'STRING' {
    switch (blfType) {
        case BLF.common.e_datamine_parameter_type._datamine_parameter_type_long:
            return 'LONG';
        case BLF.common.e_datamine_parameter_type._datamine_parameter_type_int64:
            return 'INT64';
        case BLF.common.e_datamine_parameter_type._datamine_parameter_type_float:
            return 'FLOAT';
        case BLF.common.e_datamine_parameter_type._datamine_parameter_type_string:
            return 'STRING';
        default:
            throw new Error(`Unknown parameter type: ${blfType}`);
    }
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
        const datamineFile = await readDatamineZip(path);

        if (!datamineFile) {
            this.logger.error(`[DatamineUpload] Unsupported datamine file.`);
            return;
        }

        await this.prisma.$transaction(async (tx) => {
            let session = await tx.datamine_session.findUnique({
                where: {
                    sessionid_session_start_date: {
                        sessionid: datamineFile.header.sessionid,
                        session_start_date: datamineFile.header.session_start_date,
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
                        session_start_date: datamineFile.header.session_start_date,
                    },
                });
            }

            const eventsData = datamineFile.events.map((event) => ({
                event_index: event.header.event_index,
                session_id: session.id,
                priority: event.header.priority,
                game_instance: event.header.game_info.game_instance.toString(),
                map: event.header.game_info.map,
                event_date: event.header.event_date,
                message: BLF.common.get_formatted_event_string(event) || `<invalid message string: ${event.header.event_name}>`,
                categories: event.categories,
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

            const allParameters = datamineFile.events.flatMap((event) => {
                return event.parameters
                    .filter(parameter => parameter.name)
                    .map((parameter) => {
                        let numericValue: string | undefined = undefined;
                        let stringValue: string;

                        switch (parameter.parameter_type) {
                            case BLF.common.e_datamine_parameter_type._datamine_parameter_type_long:
                                if (parameter.value_long === undefined) return null;
                                numericValue = parameter.value_long.toString();
                                stringValue = parameter.value_long.toString();
                                break;
                            case BLF.common.e_datamine_parameter_type._datamine_parameter_type_int64:
                                if (parameter.value_int64 === undefined) return null;
                                numericValue = parameter.value_int64.toString();
                                stringValue = parameter.value_int64.toString();
                                break;
                            case BLF.common.e_datamine_parameter_type._datamine_parameter_type_float:
                                if (parameter.value_float === undefined) return null;
                                numericValue = parameter.value_float.toString();
                                stringValue = parameter.value_float.toString();
                                break;
                            case BLF.common.e_datamine_parameter_type._datamine_parameter_type_string:
                                if (parameter.value_string === undefined) return null;
                                stringValue = parameter.value_string.string;
                                break;
                            default:
                                return null;
                        }

                        return {
                            event_index: event.header.event_index,
                            session_id: session.id,
                            key: parameter.name,
                            type: convertParameterType(parameter.parameter_type),
                            numeric_value: numericValue,
                            string_value: stringValue,
                        };
                    })
                    .filter((param): param is NonNullable<typeof param> => param !== null);
            });

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
