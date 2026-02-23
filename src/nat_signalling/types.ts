import { c } from 'src/cstruct';

export const PeerAddressSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'publicIp', type: 'u8', count: 4 },
        { name: 'publicPort', type: 'u16' },
        { name: 'localIp', type: 'u8', count: 4 },
        { name: 'localPort', type: 'u16' },
    ],
});

export type s_peer_address = c.infer<typeof PeerAddressSchema>;

export const MessageHeaderSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'messageType', type: 'u8' },
        { name: 'peerId', type: 'u64' },
    ],
});

export type s_message_header = c.infer<typeof MessageHeaderSchema>;

export const RegisterPeerMessageSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'header', type: MessageHeaderSchema },
        { name: 'address', type: PeerAddressSchema },
        { name: 'natType', type: 'u8' },
    ],
});

export type s_register_peer_message = c.infer<typeof RegisterPeerMessageSchema>;

export const RegisterResponseMessageSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'header', type: MessageHeaderSchema },
        { name: 'success', type: 'u8' },
        { name: 'confirmedAddress', type: PeerAddressSchema },
    ],
});

export type s_register_response_message = c.infer<typeof RegisterResponseMessageSchema>;

export const RequestConnectionMessageSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'header', type: MessageHeaderSchema },
        { name: 'targetId', type: 'u64' },
        { name: 'requesterAddress', type: PeerAddressSchema },
    ],
});

export type s_request_connection_message = c.infer<typeof RequestConnectionMessageSchema>;

export const ConnectionResponseMessageSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'header', type: MessageHeaderSchema },
        { name: 'success', type: 'u8' },
        { name: 'targetAddress', type: PeerAddressSchema },
    ],
});

export type s_connection_response_message = c.infer<typeof ConnectionResponseMessageSchema>;

export const PunchSignalMessageSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'header', type: MessageHeaderSchema },
        { name: 'peerAddress', type: PeerAddressSchema },
        { name: 'coordinatedTimeMs', type: 'u64' },
    ],
});

export type s_punch_signal_message = c.infer<typeof PunchSignalMessageSchema>;

export const KeepaliveMessageSchema = c.createCStruct({
    endian: 'little',
    pack: 1,
    fields: [
        { name: 'header', type: MessageHeaderSchema },
    ],
});

export type s_keepalive_message = c.infer<typeof KeepaliveMessageSchema>;

export enum MessageType {
    REGISTER_PEER = 0x01,
    REGISTER_RESPONSE = 0x02,
    REQUEST_CONNECTION = 0x03,
    CONNECTION_RESPONSE = 0x04,
    PUNCH_SIGNAL = 0x05,
    KEEPALIVE = 0x06,
    UNREGISTER_PEER = 0x07,
}

export enum NatType {
    UNKNOWN = 0x00,
    OPEN = 0x01,
    MODERATE = 0x02,
    STRICT = 0x03,
}

export interface PeerInfo {
    peerId: bigint;
    address: s_peer_address;
    timestamp: number;
    natType: NatType;
}
