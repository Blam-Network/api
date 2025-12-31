import { Injectable, Inject, StreamableFile } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import ILogger, { ILoggerSymbol } from 'src/ILogger';
import { 
    randomNonce, 
    randomTransportSessionId, 
    randomTransportSessionKey, 
    SBlfChunkSessionCreateSchema,
    SBlfChunkSessionModifySchema,
    SBlfChunkSessionJoinSchema,
    SBlfChunkSessionGetBySecureAddressSchema,
    SBlfFileSessionCreateResponseSchema,
    SBlfFileSessionSearchResponseSchema,
    SBlfFileSessionGetBySecureAddressResponseSchema,
    s_online_session_search_result,
} from './session.chunks';
import { Request } from 'express';
import { ARES_LIVE_AUTHOR, DEFAULT_BLF_CHUNK, DEFAULT_EOF_CHUNK } from '../chunks';

@Injectable()
export class SessionService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {}

    async createSessionAsync(
        file: Express.Multer.File,
        req: Request,
    ): Promise<StreamableFile> {
        this.logger.log(`Creating session - file size: ${file.buffer.length}, buffer preview: ${file.buffer.slice(0, 16).toString('hex')}`);
        
        let request;
        try {
            request = SBlfChunkSessionCreateSchema.read(file.buffer);
        } catch (error) {
            this.logger.error(`Failed to parse session create BLF: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error(`Buffer length: ${file.buffer.length}, first 64 bytes: ${file.buffer.slice(0, 64).toString('hex')}`);
            throw new Error(`Invalid BLF format: ${error instanceof Error ? error.message : String(error)}`);
        }

        const { flags, secureAddress, maxPublicSlots, maxPrivateSlots, userXuid } = request;

        const sessionIdentifier = randomTransportSessionId();
        const sessionKey = randomTransportSessionKey();
        const sessionNonce = randomNonce();
        
        const secureAddressHexString = Buffer.from(secureAddress.data).toString('hex');
        const identifierHexString = Buffer.from(sessionIdentifier.data).toString('hex');
        const keyHexString = Buffer.from(sessionKey.data).toString('hex');

        // Extract IPv4 address from the request as string
        let usableAddress = '0.0.0.0';
        const remoteIpAddress = req.ip || req.socket.remoteAddress;
        if (remoteIpAddress) {
            // Handle IPv4-mapped IPv6 addresses
            const ipv4Match = remoteIpAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
            if (ipv4Match) {
                usableAddress = ipv4Match[1];
            } else if (remoteIpAddress.includes('.')) {
                usableAddress = remoteIpAddress;
            }
        }

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

        return new StreamableFile(SBlfFileSessionCreateResponseSchema.write({
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
        }));
    }

    async modifySessionAsync(file: Express.Multer.File): Promise<void> {
        const request = SBlfChunkSessionModifySchema.read(file.buffer);
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

    async searchSessionsAsync(): Promise<StreamableFile> {
        // Query sessions with matchmaking flag set
        const sessions = await this.prisma.ares_session.findMany({
            where: {
                uses_matchmaking: true,
            },
            orderBy: {
                created_at: 'desc',
            },
            take: 10, // Max 10 results per schema
        });

        this.logger.log(`Found ${sessions.length} sessions with matchmaking flag`);

        // Build results array
        const results: s_online_session_search_result[] = [];
        const usableAddresses: number[] = [];

        // Convert sessions to search results
        for (let i = 0; i < sessions.length && i < 10; i++) {
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
                    id: { data: Array.from(Buffer.from(session.identifier, 'hex')) as any },
                    hostAddress: { data: Array.from(Buffer.from(session.secure_address, 'hex')) as any },
                    key: { data: Array.from(Buffer.from(session.key, 'hex')) as any },
                },
                openPublicSlots: session.max_public_slots,
                openPrivateSlots: session.max_private_slots,
                filledPublicSlots: 0, // TODO: Calculate from actual player count
                filledPrivateSlots: 0, // TODO: Calculate from actual player count
                propertyCount: 0,
                properties: Array(10).fill(null).map(() => ({
                    id: 0,
                    padding: 0,
                    value: {
                        type: 0,
                        dataAsLong: BigInt(0),
                        dataAsDouble: 0,
                        extension: BigInt(0),
                    },
                })) as any,
                contextCount: 0,
                contexts: Array(10).fill(null).map(() => ({
                    id: 0,
                    value: 0,
                })) as any,
            };

            results.push(result);
        }

        // Pad arrays to required lengths
        while (results.length < 10) {
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
                properties: Array(10).fill(null).map(() => ({
                    id: 0,
                    padding: 0,
                    value: {
                        type: 0,
                        dataAsLong: BigInt(0),
                        dataAsDouble: 0,
                        extension: BigInt(0),
                    },
                })) as any,
                contextCount: 0,
                contexts: Array(10).fill(null).map(() => ({
                    id: 0,
                    value: 0,
                })) as any,
            });
        }

        while (usableAddresses.length < 16) {
            usableAddresses.push(0);
        }

        return new StreamableFile(SBlfFileSessionSearchResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xssr: {
                resultCount: sessions.length,
                results: results as any,
                usableAddresses: usableAddresses.slice(0, 16) as any,
            },
            _eof: DEFAULT_EOF_CHUNK,
        }));
    }

    async joinSessionAsync(file: Express.Multer.File): Promise<void> {
        const request = SBlfChunkSessionJoinSchema.read(file.buffer);
        const { sessionId, playerCount, players } = request;

        if (playerCount === 0 || playerCount > 16) {
            this.logger.warn(`Invalid player count for join request: ${playerCount}`);
            throw new Error('Invalid player count');
        }

        const sessionIdHexString = Buffer.from(sessionId.data).toString('hex');

        // Upsert each player
        for (let i = 0; i < playerCount; i++) {
            const player = players[i];

            if (player.xuid === BigInt(0)) {
                this.logger.warn(`Skipping player with zero XUID at index ${i}`);
                continue;
            }

            // Convert secure address to hex string
            const secureAddressHex = Buffer.from(player.secureAddress.data).toString('hex');

            if (!secureAddressHex) {
                this.logger.warn(`Skipping player with empty secure address at index ${i}`);
                continue;
            }

            await this.prisma.ares_session_player.upsert({
                where: {
                    secure_address: secureAddressHex,
                },
                update: {
                    session_id: sessionIdHexString,
                    joined_at: new Date(),
                },
                create: {
                    xuid: player.xuid.toString(),
                    session_id: sessionIdHexString,
                    secure_address: secureAddressHex,
                    joined_at: new Date(),
                },
            });

            this.logger.log(
                `Session player: Xuid=${player.xuid}, SecureAddress=${secureAddressHex.substring(0, 32)}, SessionId=${sessionIdHexString}`,
            );
        }

        this.logger.log(
            `Session join completed: SessionId=${sessionIdHexString}, PlayerCount=${playerCount}`,
        );
    }

    async getSessionBySecureAddressAsync(file: Express.Multer.File): Promise<StreamableFile> {
        const request = SBlfChunkSessionGetBySecureAddressSchema.read(file.buffer);
        const { secureAddress } = request;

        // Convert secure address to hex string for database lookup
        const secureAddressHex = Buffer.from(secureAddress.data).toString('hex');

        // Query session_players table for matching secure address
        const sessionPlayer = await this.prisma.ares_session_player.findFirst({
            where: {
                secure_address: secureAddressHex,
            },
        });

        if (!sessionPlayer) {
            this.logger.warn(`No session found for secure address: ${secureAddressHex.substring(0, 32)}`);
            throw new Error('No session found for secure address');
        }

        this.logger.log(
            `Found session for secure address: SessionId=${sessionPlayer.session_id}, Xuid=${sessionPlayer.xuid}`,
        );

        // Parse session ID from hex string
        const sessionIdData = Array.from(Buffer.from(sessionPlayer.session_id, 'hex')) as any;

        return new StreamableFile(SBlfFileSessionGetBySecureAddressResponseSchema.write({
            _blf: DEFAULT_BLF_CHUNK,
            athr: ARES_LIVE_AUTHOR,
            xsgr: {
                sessionId: { data: sessionIdData },
            },
            _eof: DEFAULT_EOF_CHUNK,
        }));
    }
}

