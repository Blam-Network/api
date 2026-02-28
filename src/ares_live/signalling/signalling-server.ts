/**
 * WebSocket signalling server for Ares Live WebRTC NAT.
 * Clients connect, register their peer_id (32-char hex), then exchange offer/answer by target_peer_id.
 * Protocol:
 * - Client must send first: {"type":"register","peer_id":"<32 hex>"}
 * - Offer: {"type":"offer","target_peer_id":"<answerer>","local_peer_id":"<offerer>","sdp":"..."} → forwarded to answerer as {"type":"offer","from_peer_id":"<offerer>","sdp":"..."}
 * - Answer: {"type":"answer","target_peer_id":"<offerer>","sdp":"..."} → forwarded to offerer as {"type":"answer","from_peer_id":"<this connection's peer_id>","sdp":"..."}
 */

import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';

const SIGNALLING_PATH = '/signalling';
const PEER_ID_LEN = 32;

const logger = new Logger('WebSocket');

interface SignallingMessage {
    type: string;
    peer_id?: string;
    target_peer_id?: string;
    local_peer_id?: string;
    from_peer_id?: string;
    sdp?: string;
}

function isValidPeerId(s: string): boolean {
    return /^[0-9a-fA-F]{32}$/.test(s);
}

function parseMessage(data: Buffer | string): SignallingMessage | null {
    try {
        const raw = typeof data === 'string' ? data : data.toString('utf8');
        return JSON.parse(raw) as SignallingMessage;
    } catch {
        return null;
    }
}

function send(ws: WebSocket, obj: object): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
}

export function attachSignallingWebSocket(httpServer: http.Server): void {
    const wss = new WebSocketServer({ noServer: true });
    const peerToWs = new Map<string, WebSocket>();
    const wsToPeer = new Map<WebSocket, string>();

    function unregister(ws: WebSocket): void {
        const peerId = wsToPeer.get(ws);
        if (peerId) {
            peerToWs.delete(peerId);
            wsToPeer.delete(ws);
        }
    }

    function clientIp(request: http.IncomingMessage): string {
        return request.socket?.remoteAddress ?? 'unknown';
    }

    httpServer.on('upgrade', (request, socket, head) => {
        const path = request.url?.split('?')[0] ?? '';
        if (path !== SIGNALLING_PATH) {
            socket.destroy();
            return;
        }
        logger.log(`WS ${SIGNALLING_PATH} upgrade - ${clientIp(request)}`);
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });

    wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
        const ip = clientIp(request);

        ws.on('message', (data: Buffer | Buffer[] | ArrayBuffer) => {
            const buf = Buffer.isBuffer(data) ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data)]);
            const msg = parseMessage(buf);
            if (!msg || typeof msg.type !== 'string') return;

            if (msg.type === 'register') {
                const peerId = msg.peer_id?.trim();
                if (!peerId || !isValidPeerId(peerId)) {
                    logger.warn(`register invalid_peer_id - ${ip}`);
                    send(ws, { type: 'error', error: 'invalid_peer_id' });
                    return;
                }
                const existing = peerToWs.get(peerId);
                if (existing && existing !== ws) {
                    existing.close();
                    peerToWs.delete(peerId);
                    wsToPeer.delete(existing);
                }
                peerToWs.set(peerId, ws);
                wsToPeer.set(ws, peerId);
                logger.log(`register peer_id=${peerId} - ${ip}`);
                send(ws, { type: 'registered', peer_id: peerId });
                return;
            }

            const senderPeerId = wsToPeer.get(ws);
            if (!senderPeerId) {
                logger.warn(`message register_first - ${ip}`);
                send(ws, { type: 'error', error: 'register_first' });
                return;
            }

            if (msg.type === 'offer') {
                const target = msg.target_peer_id?.trim();
                const sdp = msg.sdp;
                if (!target || !isValidPeerId(target) || typeof sdp !== 'string') {
                    logger.warn(`offer invalid_offer from=${senderPeerId} - ${ip}`);
                    send(ws, { type: 'error', error: 'invalid_offer' });
                    return;
                }
                const targetWs = peerToWs.get(target);
                if (!targetWs || targetWs.readyState !== WebSocket.OPEN) {
                    logger.warn(`offer peer_unavailable from=${senderPeerId} target=${target} - ${ip}`);
                    send(ws, { type: 'error', error: 'peer_unavailable', target_peer_id: target });
                    return;
                }
                const fromPeerId = msg.local_peer_id?.trim() || senderPeerId;
                logger.log(`offer from=${fromPeerId} target=${target} - ${ip}`);
                send(targetWs, {
                    type: 'offer',
                    from_peer_id: fromPeerId,
                    sdp,
                });
                return;
            }

            if (msg.type === 'answer') {
                const target = msg.target_peer_id?.trim();
                const sdp = msg.sdp;
                if (!target || !isValidPeerId(target) || typeof sdp !== 'string') {
                    logger.warn(`answer invalid_answer from=${senderPeerId} - ${ip}`);
                    send(ws, { type: 'error', error: 'invalid_answer' });
                    return;
                }
                const targetWs = peerToWs.get(target);
                if (!targetWs || targetWs.readyState !== WebSocket.OPEN) {
                    logger.warn(`answer peer_unavailable from=${senderPeerId} target=${target} - ${ip}`);
                    send(ws, { type: 'error', error: 'peer_unavailable', target_peer_id: target });
                    return;
                }
                logger.log(`answer from=${senderPeerId} target=${target} - ${ip}`);
                send(targetWs, {
                    type: 'answer',
                    from_peer_id: senderPeerId,
                    sdp,
                });
                return;
            }
        });

        ws.on('close', () => {
            const peerId = wsToPeer.get(ws);
            if (peerId) logger.log(`close peer_id=${peerId} - ${ip}`);
            unregister(ws);
        });
        ws.on('error', () => {
            const peerId = wsToPeer.get(ws);
            if (peerId) logger.warn(`error peer_id=${peerId} - ${ip}`);
            unregister(ws);
        });
    });
}
