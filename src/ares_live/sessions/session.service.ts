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
    s_online_session_search_result,
} from './session.chunks';
import { ARES_LIVE_AUTHOR, DEFAULT_BLF_CHUNK, DEFAULT_EOF_CHUNK } from '../chunks';

@Injectable()
export class SessionService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    async createSessionAsync(
        file: Express.Multer.File,
        usableAddress: string,
    ): Promise<{ buffer: Buffer; size: number }> {
        this.logger.log(`Creating session - file size: ${file.buffer.length}, buffer preview: ${file.buffer.slice(0, 16).toString('hex')}`);
        this.logger.log(`Full buffer hex dump (${file.buffer.length} bytes): ${file.buffer.toString('hex')}`);
        
        let fileData;
        try {
            fileData = SBlfFileSessionCreateSchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse session create BLF: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Buffer length: ${file.buffer.length}, first 64 bytes: ${file.buffer.slice(0, 64).toString('hex')}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }
        const request = fileData.xscc;
        const { flags, secureAddress, maxPublicSlots, maxPrivateSlots, userXuid } = request;

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

        this.logger.log(
            `Created session with ID ${identifierHexString}, Nonce: ${sessionNonce}`,
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
        return { buffer, size: buffer.length };
    }

    async modifySessionAsync(file: Express.Multer.File): Promise<void> {
        let fileData;
        try {
            fileData = SBlfFileSessionModifySchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse session modify BLF: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }
        const request = fileData.xscm;
        const { identifier, flags, maxPublicSlots, maxPrivateSlots } = request;

        const identifierHexString = Buffer.from(identifier.data).toString('hex');

        // Find the session by identifier
        const sessions = await this.prisma.ares_session.findMany();
        const session = sessions.find((s) => s.identifier === identifierHexString);

        if (!session) {
            this.logger.warn(`Session not found for identifier: ${identifierHexString}`);
            throw new Error('Session not found');
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

        this.logger.log(
            `Modified session with ID ${session.identifier}, MaxPublicSlots=${maxPublicSlots}, MaxPrivateSlots=${maxPrivateSlots}`,
        );
    }

    async searchSessionsAsync(): Promise<{ buffer: Buffer; size: number }> {
        // Query sessions with matchmaking flag set
        const sessions = await this.prisma.ares_session.findMany({
            where: {
                uses_matchmaking: true,
            },
            orderBy: {
                created_at: 'desc',
            },
            take: 50, // Max 50 results per schema
        });

        this.logger.log(`Found ${sessions.length} sessions with matchmaking flag`);

        // Build results array
        const results: s_online_session_search_result[] = [];
        const usableAddresses: number[] = [];

        // Convert sessions to search results
        for (let i = 0; i < sessions.length && i < 50; i++) {
            const session = sessions[i];

            // Parse usable address to IPv4 in network byte order
            let usableAddress = 0;
            if (session.usable_address) {
                const parts = session.usable_address.split('.');
                if (parts.length === 4) {
                    // Convert to network byte order (big-endian)
                    usableAddress =
                        (parseInt(parts[0]) << 24) |
                        (parseInt(parts[1]) << 16) |
                        (parseInt(parts[2]) << 8) |
                        parseInt(parts[3]);
                }
            }
            usableAddresses.push(usableAddress);

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

        while (usableAddresses.length < 50) {
            usableAddresses.push(0);
        }

        const buffer = SBlfFileSessionSearchResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xssr: {
                resultCount: sessions.length,
                results: results as any,
                usableAddresses: usableAddresses.slice(0, 50) as any,
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

        // Find the session by identifier
        const sessions = await this.prisma.ares_session.findMany();
        const session = sessions.find((s) => s.identifier === sessionIdHexString);

        if (!session) {
            this.logger.warn(`Session not found for identifier during delete: ${sessionIdHexString}`);
            return false;
        }

        if (session.usable_address !== requesterIpAddress) {
            this.logger.warn(
                `IP address mismatch during session delete. Session UsableAddress=${session.usable_address}, Requester IP=${requesterIpAddress}, SessionId=${sessionIdHexString}`,
            );
            return false;
        }

        await this.prisma.ares_session.delete({
            where: { identifier: sessionIdHexString },
        });

        this.logger.log(
            `Deleted session with ID ${sessionIdHexString} (verified IP: ${requesterIpAddress})`,
        );

        return true;
    }
}

