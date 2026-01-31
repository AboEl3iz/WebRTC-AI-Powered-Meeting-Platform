import { Device, Transport, Producer, Consumer } from 'mediasoup-client/lib/types';

export interface Participant {
    userId: string;
    userName: string;
    userEmail?: string;
    stream?: MediaStream;
    isLocal: boolean;
    isScreen?: boolean;
    micEnabled: boolean;
    camEnabled: boolean;
}

export interface MeetingState {
    roomId: string | null;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    isJoined: boolean;
    participants: Map<string, Participant>;
    isRecording: boolean;
    isConnected: boolean;
}

export type MediasoupEvent =
    | 'join_room'
    | 'router-rtp-capabilities'
    | 'create-transport'
    | 'transport-created'
    | 'connect-transport'
    | 'produce'
    | 'produced'
    | 'new-producer'
    | 'consume'
    | 'consumer-created'
    | 'producer-closed'
    | 'peer-left'
    | 'recording-started'
    | 'recording-stopped';
