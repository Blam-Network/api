import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import * as yauzl from 'yauzl';
import * as BLF from '@blam-network/blf_lsp';

const DATAMINE_MIME_TYPE = 'application/x-bungie-datamine';
const DATAMINE_COMPRESSED_FILE_NAME = "compressed.dat";

async function readDatamineZip(buffer: Buffer<ArrayBufferLike>): Promise<BLF.common.s_datamine_file | undefined> {
    const zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
            if (err) reject(err);
            else resolve(zipfile);
        });
    });
    
    const datamineBuffer = await new Promise<Buffer>((resolve, reject) => {
      let foundDatamineFile = false;
      
      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName !== DATAMINE_COMPRESSED_FILE_NAME) {
          zipfile.readEntry(); // Continue reading next entry
          return;
        }
        
        foundDatamineFile = true;
        
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            reject(err);
            return;
          }
          
          const chunks: Buffer[] = [];
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          readStream.on('end', () => {
            resolve(Buffer.concat(chunks));
          });
          readStream.on('error', reject);
        });
      });
      
      zipfile.on('end', () => {
        if (!foundDatamineFile) {
          reject(new Error('No compressed.dat found in zip'));
        }
      });
      zipfile.on('error', reject);
      
      zipfile.readEntry();
    });

    return BLF.common.read_datamine_file(datamineBuffer);
  }


@Injectable()
export class DatamineUploadService {
    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
        private readonly prisma: PrismaService,
    ) {}

    private isDatamineUpload = (
        upload: Express.Multer.File
    ) => upload.mimetype === DATAMINE_MIME_TYPE
    

    public handleUpload = async (
        upload: Express.Multer.File
    ) => {
        if (!this.isDatamineUpload(upload)) {
            return;
        }

        // datamine files are ZIPs, so we need to unzip
        const datamineFile = await readDatamineZip(upload.buffer);

        if (!datamineFile) {
            this.logger.error(`[DatamineUpload] Unsupported datamine file.`);
            return;
        }

        try {
            await this.prisma.$transaction(async (tx) => {
                // Helper function to convert BLF parameter type to Prisma enum
                const convertParameterType = (blfType: number): 'LONG' | 'INT64' | 'FLOAT' | 'STRING' => {
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
                };

                // Upsert session - unique constraint on (sessionid, session_start_date)
                // Find existing session first, or create if it doesn't exist
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

                // Prepare events data
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

                // Insert events - skip duplicates
                await tx.datamine_event.createMany({
                    data: eventsData,
                    skipDuplicates: true,
                });

                // Delete existing parameters for these events, then recreate them all
                const eventIndices = eventsData.map(e => e.event_index);
                if (eventIndices.length > 0) {
                    await tx.datamine_event_parameter.deleteMany({
                        where: {
                            session_id: session.id,
                            event_index: { in: eventIndices },
                        },
                    });
                }

                // Create parameters for all events
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

                if (allParameters.length > 0) {
                    await tx.datamine_event_parameter.createMany({
                        data: allParameters,
                    });
                }
            }, {
                maxWait: 10000, // 10 seconds
                timeout: 30000, // 30 seconds
            });
        } catch (error) {
            this.logger.error(`[DatamineUpload] Error processing datamine file: ${error}`);
            throw error;
        }
    }
}