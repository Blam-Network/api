import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import * as dgram from 'dgram';
import {
    PeerInfo,
    MessageType,
    NatType,
    MessageHeaderSchema,
    RegisterPeerMessageSchema,
    RegisterResponseMessageSchema,
    RequestConnectionMessageSchema,
    ConnectionResponseMessageSchema,
    PunchSignalMessageSchema,
    KeepaliveMessageSchema,
    s_peer_address,
} from './types';
import { NAT_SIGNALLING_UDP_PORT } from './constants';
import ILogger, { ILoggerSymbol } from 'src/ILogger';

@Injectable()
export class NatSignallingService implements OnModuleInit, OnModuleDestroy {
    private server: dgram.Socket;
    private peers: Map<string, PeerInfo> = new Map();
    private readonly PEER_TIMEOUT_MS = 60000;
    private readonly PUNCH_COORDINATION_DELAY_MS = 100;

    constructor(
        @Inject(ILoggerSymbol) private readonly logger: ILogger,
    ) {
        this.server = dgram.createSocket('udp4');
        this.setupServer();
    }

    onModuleInit(): void {
        this.server.bind(NAT_SIGNALLING_UDP_PORT);
        this.logger.log(`NAT Signalling UDP server bound to port ${NAT_SIGNALLING_UDP_PORT}`);
    }

    private setupServer(): void {
        this.server.on('message', (msg, rinfo) => {
            try {
                this.handleMessage(msg, rinfo);
            } catch (error) {
                this.logger.error('Failed to parse UDP message', error);
            }
        });

        this.server.on('error', (err) => {
            this.logger.error('UDP server error', err);
        });

        this.server.on('listening', () => {
            const address = this.server.address();
            this.logger.log(`UDP server listening on ${address.address}:${address.port}`);
        });

        setInterval(() => this.cleanupStaleConnections(), 30000);
    }

    private handleMessage(buffer: Buffer, rinfo: dgram.RemoteInfo): void {
        if (buffer.length < 1) {
            return;
        }

        const messageType = buffer[0];

        switch (messageType) {
            case MessageType.REGISTER_PEER:
                this.handleRegisterPeer(buffer, rinfo);
                break;

            case MessageType.REQUEST_CONNECTION:
                this.handleConnectionRequest(buffer, rinfo);
                break;

            case MessageType.KEEPALIVE:
                this.handleKeepalive(buffer);
                break;

            case MessageType.UNREGISTER_PEER:
                this.handleUnregisterPeer(buffer);
                break;

            default:
                this.logger.warn(`Unknown message type: 0x${messageType.toString(16)}`);
        }
    }

    private handleRegisterPeer(buffer: Buffer, rinfo: dgram.RemoteInfo): void {
        const message = RegisterPeerMessageSchema.read(buffer);
        const peerId = message.header.peerId.toString();

        const ipBytes = Buffer.from(rinfo.address.split('.').map(x => parseInt(x)));
        message.address.publicIp = [ipBytes[0], ipBytes[1], ipBytes[2], ipBytes[3]];
        message.address.publicPort = rinfo.port;

        const peerInfo: PeerInfo = {
            peerId: message.header.peerId,
            address: message.address,
            timestamp: Date.now(),
            natType: message.natType,
        };

        this.peers.set(peerId, peerInfo);

        const publicIpStr = message.address.publicIp.join('.');
        this.logger.log(`Registered peer ${peerId} at ${publicIpStr}:${message.address.publicPort}`);

        const response = RegisterResponseMessageSchema.write({
            header: {
                messageType: MessageType.REGISTER_RESPONSE,
                peerId: message.header.peerId,
            },
            success: 1,
            confirmedAddress: message.address,
        });

        this.sendBuffer(rinfo, RegisterResponseMessageSchema.write(response));
    }

    private handleConnectionRequest(buffer: Buffer, rinfo: dgram.RemoteInfo): void {
        const message = RequestConnectionMessageSchema.read(buffer);
        const requesterId = message.header.peerId.toString();
        const targetId = message.targetId.toString();

        const targetPeer = this.peers.get(targetId);

        if (!targetPeer) {
            const response = ConnectionResponseMessageSchema.write({
                header: {
                    messageType: MessageType.CONNECTION_RESPONSE,
                    peerId: message.header.peerId,
                },
                success: 0,
                targetAddress: this.createEmptyAddress(),
            });

            this.sendBuffer(rinfo, ConnectionResponseMessageSchema.write(response));
            this.logger.warn(`Connection request failed: target peer ${targetId} not found`);
            return;
        }

        this.logger.log(`Connection request from ${requesterId} to ${targetId}`);

        const requesterPeer = this.peers.get(requesterId);
        const requesterAddress = requesterPeer?.address || message.requesterAddress;

        const coordinatedTime = BigInt(Date.now() + this.PUNCH_COORDINATION_DELAY_MS);

        this.sendPunchSignal(targetPeer, message.header.peerId, requesterAddress, coordinatedTime);
        this.sendPunchSignal(requesterPeer || { peerId: message.header.peerId, address: requesterAddress, timestamp: Date.now(), natType: NatType.UNKNOWN }, targetPeer.peerId, targetPeer.address, coordinatedTime);

        const response = ConnectionResponseMessageSchema.write({
            header: {
                messageType: MessageType.CONNECTION_RESPONSE,
                peerId: message.header.peerId,
            },
            success: 1,
            targetAddress: targetPeer.address,
        });

        this.sendBuffer(rinfo, ConnectionResponseMessageSchema.write(response));
    }

    private sendPunchSignal(
        toPeer: PeerInfo,
        fromPeerId: bigint,
        fromAddress: s_peer_address,
        coordinatedTime: bigint,
    ): void {
        const publicIpStr = toPeer.address.publicIp.join('.');
        
        const punchMessage = PunchSignalMessageSchema.write({
            header: {
                messageType: MessageType.PUNCH_SIGNAL,
                peerId: fromPeerId,
            },
            peerAddress: fromAddress,
            coordinatedTimeMs: coordinatedTime,
        });

        const targetRinfo = {
            address: publicIpStr,
            port: toPeer.address.publicPort,
        };

        this.sendBuffer(targetRinfo, PunchSignalMessageSchema.write(punchMessage));

        this.logger.log(`Sent punch signal from ${fromPeerId} to ${toPeer.peerId}`);
    }

    private handleKeepalive(buffer: Buffer): void {
        const message = KeepaliveMessageSchema.read(buffer);
        const peerId = message.header.peerId.toString();
        const peer = this.peers.get(peerId);

        if (peer) {
            peer.timestamp = Date.now();
        }
    }

    private handleUnregisterPeer(buffer: Buffer): void {
        const message = KeepaliveMessageSchema.read(buffer);
        const peerId = message.header.peerId.toString();
        
        this.peers.delete(peerId);
        this.logger.log(`Unregistered peer ${peerId}`);
    }

    private sendBuffer(rinfo: { address: string; port: number }, buffer: Buffer): void {
        this.server.send(buffer, rinfo.port, rinfo.address, (err) => {
            if (err) {
                this.logger.error(`Failed to send to ${rinfo.address}:${rinfo.port}`, err);
            }
        });
    }

    private createEmptyAddress(): s_peer_address {
        return {
            publicIp: [0, 0, 0, 0],
            publicPort: 0,
            localIp: [0, 0, 0, 0],
            localPort: 0,
        };
    }

    private cleanupStaleConnections(): void {
        const now = Date.now();
        const staleIds: string[] = [];

        for (const [peerId, peer] of this.peers.entries()) {
            if (now - peer.timestamp > this.PEER_TIMEOUT_MS) {
                staleIds.push(peerId);
            }
        }

        for (const peerId of staleIds) {
            this.peers.delete(peerId);
            this.logger.log(`Cleaned up stale peer ${peerId}`);
        }
    }

    getPeerCount(): number {
        return this.peers.size;
    }

    getPeerInfo(peerId: string): PeerInfo | undefined {
        return this.peers.get(peerId);
    }

    getAllPeers(): PeerInfo[] {
        return Array.from(this.peers.values());
    }

    onModuleDestroy(): void {
        if (this.server) {
            this.server.close();
            this.logger.log('NAT Signalling UDP server closed');
        }
    }
}
