import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { 
    randomNonce, 
    randomTransportSessionId, 
    randomTransportSessionKey, 
    SBlfFileSessionCreateSchema,
    SBlfFileSessionModifySchema,
    SBlfFileSessionCreateResponseSchema,
    SBlfFileSessionSearchResponseSchema,
    SBlfFileSessionDeleteSchema,
    SBlfFileSessionMigrateHostSchema,
    SBlfFileSessionMigrateHostResponseSchema,
    SBlfFileSessionGetByIdSchema,
    SBlfFileSessionGetByIdResponseSchema,
    s_online_session_search_result,
} from './session.chunks';
import { ARES_LIVE_AUTHOR, DEFAULT_BLF_CHUNK, DEFAULT_EOF_CHUNK } from '../chunks';
import { z } from 'zod';

/**
 * Formats a session ID (8 bytes) as uppercase hex with a colon in the middle
 * Example: E0B4722A:24253947
 */
function transport_secure_identifier_get_string(sessionIdBytes: number[] | Buffer | Uint8Array): string {
    const bytes = Array.from(sessionIdBytes);
    if (bytes.length !== 8) {
        return 'INVALID';
    }
    const firstPart = Buffer.from(bytes.slice(0, 4)).toString('hex').toUpperCase();
    const secondPart = Buffer.from(bytes.slice(4, 8)).toString('hex').toUpperCase();
    return `${firstPart}:${secondPart}`;
}

const ipOctetSchema = z.coerce.number().positive().max(255).int();
const usableAddressSchema = z
    .preprocess((val) => {
        if (typeof val === 'string') {
            return val.split('.');
        }
        return val;
    }, z.tuple([ipOctetSchema, ipOctetSchema, ipOctetSchema, ipOctetSchema]))
    .transform(([a, b, c, d]) => (a << 24) | (b << 16) | (c << 8) | d);

@Injectable()
export class SessionService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    async createSessionAsync(
        file: Express.Multer.File,
        usableAddress: string,
    ): Promise<{ buffer: Buffer; size: number; sessionId: string }> {
        let fileData;
        try {
            fileData = SBlfFileSessionCreateSchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse session create BLF: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }
        const request = fileData.xscc;
        const { flags, secureAddress, maxPublicSlots, maxPrivateSlots, userXuid } = request;

        // Validate secure address length
        if (!secureAddress || secureAddress.data.length !== 320) {
            throw new Error('Secure address must be exactly 320 bytes');
        }

        // Delete existing matchmaking sessions from the same IP if usesMatchmaking is true
        if (flags.uses_matchmaking && usableAddress) {
            const existingMatchmakingSessions = await this.prisma.ares_session.findMany({
                where: {
                    uses_matchmaking: true,
                    usable_address: usableAddress,
                },
            });

            if (existingMatchmakingSessions.length > 0) {
                this.logger.log(
                    `Found ${existingMatchmakingSessions.length} existing matchmaking session(s) from IP ${usableAddress}, deleting them`,
                );
                
                await this.prisma.ares_session.deleteMany({
                    where: {
                        uses_matchmaking: true,
                        usable_address: usableAddress,
                    },
                });

                this.logger.log(
                    `Deleted ${existingMatchmakingSessions.length} existing matchmaking session(s) from IP ${usableAddress}`,
                );
            }
        }

        const sessionIdentifier = randomTransportSessionId();
        const sessionKey = randomTransportSessionKey();
        const sessionNonce = randomNonce();
        
        const secureAddressHexString = Buffer.from(secureAddress.data).toString('hex');
        const identifierHexString = Buffer.from(sessionIdentifier.data).toString('hex');
        const keyHexString = Buffer.from(sessionKey.data).toString('hex');

        // Store in database
        await this.prisma.ares_session.create({
            data: {
                secure_address: secureAddressHexString,
                identifier: identifierHexString,
                key: keyHexString,
                nonce: sessionNonce.toString(),
                usable_address: usableAddress,
                uses_presence: flags.uses_presence,
                uses_stats: flags.uses_stats,
                uses_matchmaking: flags.uses_matchmaking,
                uses_arbitration: flags.uses_arbitration,
                multiplayer: flags.multiplayer,
                invites_disabled: flags.invites_disabled,
                join_via_presence_disabled: flags.join_via_presence_disabled,
                join_in_progress_disabled: flags.join_in_progress_disabled,
                join_via_presence_friends_only: flags.join_via_presence_friends_only,
                max_public_slots: maxPublicSlots,
                max_private_slots: maxPrivateSlots,
                creator_xuid: userXuid.toString(),
            },
        });

        const formattedSessionId = transport_secure_identifier_get_string(sessionIdentifier.data);
        this.logger.log(
            `Created session ${formattedSessionId}, Nonce: ${sessionNonce}`,
        );

        const buffer = SBlfFileSessionCreateResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xscr: {
                sessionDescription: {
                    id: sessionIdentifier,
                    hostAddress: request.secureAddress,
                    key: sessionKey,
                },
                nonce: sessionNonce,
            },
            _eof: DEFAULT_EOF_CHUNK,
        });
        return { buffer, size: buffer.length, sessionId: formattedSessionId };
    }

    async modifySessionAsync(file: Express.Multer.File): Promise<boolean> {
        let fileData;
        try {
            fileData = SBlfFileSessionModifySchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse session modify BLF: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }
        const request = fileData.xscm;
        const { identifier, flags, maxPublicSlots, maxPrivateSlots } = request;

        // Validate identifier length
        if (!identifier || identifier.data.length !== 8) {
            throw new Error('Identifier must be exactly 8 bytes');
        }

        const identifierHexString = Buffer.from(identifier.data).toString('hex');

        // Find the session by identifier
        const sessions = await this.prisma.ares_session.findMany();
        const session = sessions.find((s) => s.identifier === identifierHexString);

        if (!session) {
            const formattedId = transport_secure_identifier_get_string(identifier.data);
            this.logger.warn(`Session not found: ${formattedId}`);
            return false;
        }

        // Update the session
        await this.prisma.ares_session.update({
            where: { identifier: session.identifier },
            data: {
                uses_presence: flags.uses_presence,
                uses_stats: flags.uses_stats,
                uses_matchmaking: flags.uses_matchmaking,
                uses_arbitration: flags.uses_arbitration,
                multiplayer: flags.multiplayer,
                invites_disabled: flags.invites_disabled,
                join_via_presence_disabled: flags.join_via_presence_disabled,
                join_in_progress_disabled: flags.join_in_progress_disabled,
                join_via_presence_friends_only: flags.join_via_presence_friends_only,
                max_public_slots: maxPublicSlots,
                max_private_slots: maxPrivateSlots,
            },
        });

        const formattedSessionId = transport_secure_identifier_get_string(identifier.data);
        this.logger.log(
            `Modified session ${formattedSessionId}, MaxPublicSlots=${maxPublicSlots}, MaxPrivateSlots=${maxPrivateSlots}`,
        );

        return true;
    }

    async searchSessionsAsync(): Promise<{ buffer: Buffer; size: number }> {
        // Use DISTINCT ON to get the most recent session per IP in a single flat query
        // DISTINCT ON requires ORDER BY to start with the DISTINCT ON column(s)
        // This returns the most recent session per IP, ordered by IP then creation date
        const sessions = await this.prisma.$queryRaw<Array<{
            secure_address: string;
            identifier: string;
            key: string;
            max_public_slots: number;
            max_private_slots: number;
            created_at: Date;
        }>>`
            SELECT DISTINCT ON (secure_address)
                secure_address,
                identifier,
                key,
                max_public_slots,
                max_private_slots,
                created_at
            FROM ares.sessions
            WHERE uses_matchmaking = true
                AND usable_address != '127.0.0.1'
            ORDER BY secure_address, created_at DESC
            LIMIT 50
        `;


        // Build results array
        const results: s_online_session_search_result[] = [];

        // Convert sessions to search results
        for (let i = 0; i < sessions.length && i < 50; i++) {
            const session = sessions[i];
            

            // Build s_online_session_search_result structure
            const result: s_online_session_search_result = {
                sessionName: '',
                description: {
                    id: { data: Array.from(Buffer.from(session.identifier || '0000000000000000', 'hex')) as any },
                    hostAddress: { data: Array.from(Buffer.from(session.secure_address || '0'.repeat(640), 'hex')) as any },
                    key: { data: Array.from(Buffer.from(session.key || '0'.repeat(32), 'hex')) as any },
                },
                openPublicSlots: session.max_public_slots,
                openPrivateSlots: session.max_private_slots,
                filledPublicSlots: 0, // TODO: Calculate from actual player count
                filledPrivateSlots: 0, // TODO: Calculate from actual player count
                propertyCount: 0,
                properties: Array(3).fill(null).map(() => ({
                    id: 0,
                    value: {
                        type: 'null' as const,
                        data: {
                            data_as_null: {
                                padding: Array(16).fill(0) as any,
                            },
                        },
                    },
                })) as any,
                contextCount: 0,
                contexts: Array(2).fill(null).map(() => ({
                    id: 0,
                    value: 0,
                })) as any,
            };

            results.push(result);
        }

        // Pad arrays to required lengths
        while (results.length < 50) {
            results.push({
                sessionName: '',
                description: {
                    id: { data: Array(8).fill(0) as any },
                    hostAddress: { data: Array(320).fill(0) as any },
                    key: { data: Array(16).fill(0) as any },
                },
                openPublicSlots: 0,
                openPrivateSlots: 0,
                filledPublicSlots: 0,
                filledPrivateSlots: 0,
                propertyCount: 0,
                properties: Array(3).fill(null).map(() => ({
                    id: 0,
                    value: {
                        type: 'null' as const,
                        data: {
                            data_as_null: {
                                padding: Array(16).fill(0) as any,
                            },
                        },
                    },
                })) as any,
                contextCount: 0,
                contexts: Array(2).fill(null).map(() => ({
                    id: 0,
                    value: 0,
                })) as any,
            });
        }

        const buffer = SBlfFileSessionSearchResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xssr: {
                resultCount: sessions.length,
                results: results as any,
            },
            _eof: DEFAULT_EOF_CHUNK,
        });
        return { buffer, size: buffer.length };
    }

    async deleteSessionAsync(file: Express.Multer.File, requesterIpAddress: string): Promise<boolean> {
        let fileData;
        try {
            fileData = SBlfFileSessionDeleteSchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse session delete BLF: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }
        const request = fileData.xsdl;
        const { sessionId } = request;

        if (!sessionId || sessionId.data.length !== 8) {
            this.logger.warn('Session delete request has invalid session ID');
            return false;
        }

        if (!requesterIpAddress) {
            this.logger.warn('Requester IP address is null or empty during delete');
            return false;
        }

        const sessionIdHexString = Buffer.from(sessionId.data).toString('hex');
        const formattedSessionId = transport_secure_identifier_get_string(sessionId.data);

        // Find the session by identifier
        const sessions = await this.prisma.ares_session.findMany();
        const session = sessions.find((s) => s.identifier === sessionIdHexString);
        
        if (!session) {
            this.logger.warn(`Session not found: ${formattedSessionId}`);
            return false;
        }

        if (session.usable_address !== requesterIpAddress) {
            return false;
        }

        await this.prisma.ares_session.delete({
            where: { identifier: sessionIdHexString },
        });

        this.logger.log(
            `Deleted session ${formattedSessionId} (verified IP: ${requesterIpAddress})`,
        );

        return true;
    }

    async migrateHostAsync(file: Express.Multer.File, usableAddress: string): Promise<{ buffer: Buffer; size: number } | null> {
        let fileData;
        try {
            fileData = SBlfFileSessionMigrateHostSchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse session migrate host BLF: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }
        const request = fileData.xsmh;
        const { sessionId, secureAddress } = request;

        if (!sessionId || sessionId.data.length !== 8) {
            this.logger.warn('Session migrate host request has invalid session ID');
            return null;
        }

        if (!secureAddress || secureAddress.data.length !== 320) {
            this.logger.warn('Session migrate host request has invalid secure address');
            return null;
        }

        const sessionIdHexString = Buffer.from(sessionId.data).toString('hex');
        const formattedSessionId = transport_secure_identifier_get_string(sessionId.data);

        // Find the session by identifier
        const sessions = await this.prisma.ares_session.findMany();
        const session = sessions.find((s) => s.identifier === sessionIdHexString);

        if (!session) {
            this.logger.warn(`Session not found: ${formattedSessionId}`);
            return null;
        }

        // Check if secure address is all zeros (user index zero case)
        const secureAddressIsZero = secureAddress.data.every((b: number) => b === 0);

        if (!secureAddressIsZero) {
            // Update session with new secure address and usable address
            const secureAddressHexString = Buffer.from(secureAddress.data).toString('hex');
            await this.prisma.ares_session.update({
                where: { identifier: sessionIdHexString },
                data: {
                    secure_address: secureAddressHexString,
                    usable_address: usableAddress,
                },
            });

            this.logger.log(
                `Host migration completed: SessionId=${formattedSessionId}, SecureAddress updated, Nonce=${session.nonce}`,
            );
        } else {
            this.logger.log(
                `Host migration (user index zero): SessionId=${formattedSessionId}, returning latest session description, Nonce=${session.nonce}`,
            );
        }

        // Parse session data from database
        const sessionIdentifier = { data: Array.from(Buffer.from(session.identifier, 'hex')) as any };
        const sessionKey = { data: Array.from(Buffer.from(session.key, 'hex')) as any };
        const sessionHostAddress = { data: Array.from(Buffer.from(session.secure_address, 'hex')) as any };
        const sessionNonce = BigInt(session.nonce.toString());

        const buffer = SBlfFileSessionMigrateHostResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xsmr: {
                sessionDescription: {
                    id: sessionIdentifier,
                    hostAddress: sessionHostAddress,
                    key: sessionKey,
                },
                nonce: sessionNonce,
            },
            _eof: DEFAULT_EOF_CHUNK,
        });
        return { buffer, size: buffer.length };
    }

    async getSessionByIdAsync(file: Express.Multer.File): Promise<{ buffer: Buffer; size: number } | null> {
        let fileData;
        try {
            fileData = SBlfFileSessionGetByIdSchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse session get by id BLF: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }
        const request = fileData.xsgi;
        const { sessionId } = request;

        if (!sessionId || sessionId.data.length !== 8) {
            this.logger.warn('Session get by id request has invalid session ID');
            return null;
        }

        const sessionIdHexString = Buffer.from(sessionId.data).toString('hex');
        const formattedSessionId = transport_secure_identifier_get_string(sessionId.data);

        // Find the session by identifier
        const sessions = await this.prisma.ares_session.findMany();
        const session = sessions.find((s) => s.identifier === sessionIdHexString);

        if (!session) {
            this.logger.warn(`Session not found: ${formattedSessionId}`);
            return null;
        }

        // Parse usable address to IPv4 in network byte order
        let usableAddress = 0;
        if (session.usable_address) {
            // Use proper IP parsing like C# does
            const parts = session.usable_address.split('.');
            if (parts.length === 4) {
                const bytes = parts.map(p => parseInt(p, 10));
                if (bytes.every(b => !isNaN(b) && b >= 0 && b <= 255)) {
                    // Convert to network byte order (big-endian)
                    usableAddress = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
                }
            }
        }

        // Parse session data from database
        const secureAddress = { data: Array.from(Buffer.from(session.secure_address, 'hex')) as any };
        const sessionKey = { data: Array.from(Buffer.from(session.key, 'hex')) as any };

        const buffer = SBlfFileSessionGetByIdResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xsir: {
                secureAddress,
                sessionKey,
                usableAddress,
            },
            _eof: DEFAULT_EOF_CHUNK,
        });
        return { buffer, size: buffer.length };
    }
}

