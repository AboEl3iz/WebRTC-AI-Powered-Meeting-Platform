import ChatMessage, { IChatMessage } from '../models/ChatMessage';

/**
 * ChatService
 * Handles all chat-related operations following OOP principles
 */
export interface ChatMessagePayload {
    roomId: string;
    senderId: string;
    senderName: string;
    senderEmail: string;
    content: string;
    messageType?: 'text' | 'system' | 'file';
}

export interface ChatMessageResponse {
    id: string;
    senderId: string;
    senderName: string;
    senderEmail: string;
    content: string;
    timestamp: Date;
    messageType: string;
}

export class ChatService {
    /**
     * Save a new chat message to the database
     */
    public async saveMessage(payload: ChatMessagePayload): Promise<ChatMessageResponse> {
        const message = new ChatMessage({
            roomId: payload.roomId,
            senderId: payload.senderId,
            senderName: payload.senderName,
            senderEmail: payload.senderEmail,
            content: payload.content,
            messageType: payload.messageType || 'text'
        });

        await message.save();

        return this.formatMessage(message);
    }

    /**
     * Get chat history for a room
     * @param roomId - The room ID
     * @param limit - Maximum number of messages to return (default: 50)
     * @param before - Get messages before this timestamp (for pagination)
     */
    public async getChatHistory(
        roomId: string,
        limit: number = 50,
        before?: Date
    ): Promise<ChatMessageResponse[]> {
        const query: any = { roomId };

        if (before) {
            query.timestamp = { $lt: before };
        }

        const messages = await ChatMessage
            .find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .exec();

        // Return in chronological order
        return messages.reverse().map((msg: IChatMessage) => this.formatMessage(msg));
    }

    /**
     * Delete all messages for a room (cleanup after meeting ends)
     */
    public async deleteRoomMessages(roomId: string): Promise<number> {
        const result = await ChatMessage.deleteMany({ roomId });
        return result.deletedCount || 0;
    }

    /**
     * Get message count for a room
     */
    public async getMessageCount(roomId: string): Promise<number> {
        return ChatMessage.countDocuments({ roomId });
    }

    /**
     * Create a system message (e.g., "User joined", "Recording started")
     */
    public async createSystemMessage(roomId: string, content: string): Promise<ChatMessageResponse> {
        return this.saveMessage({
            roomId,
            senderId: 'system',
            senderName: 'System',
            senderEmail: 'system@meeting.local',
            content,
            messageType: 'system'
        });
    }

    /**
     * Format a message document for API response
     */
    private formatMessage(message: IChatMessage): ChatMessageResponse {
        return {
            id: message.id,
            senderId: message.senderId,
            senderName: message.senderName,
            senderEmail: message.senderEmail,
            content: message.content,
            timestamp: message.timestamp,
            messageType: message.messageType
        };
    }
}

// Export singleton instance
export const chatService = new ChatService();
