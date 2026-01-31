export interface ChatMessage {
    id: string;
    roomId: string;
    senderId: string;
    senderName: string;
    senderEmail?: string;
    message: string;
    timestamp: Date;
}

export interface RoomParticipant {
    userId: string;
    userName: string;
    userEmail?: string;
    joinedAt: Date;
    isLocal?: boolean;
}
