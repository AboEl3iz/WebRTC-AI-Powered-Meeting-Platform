import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * ChatMessage Model
 * Represents a chat message sent in a meeting room
 */
export interface IChatMessage extends Document {
    id: string;
    roomId: string;
    senderId: string;
    senderName: string;
    senderEmail: string;
    content: string;
    timestamp: Date;
    messageType: 'text' | 'system' | 'file';
}

const ChatMessageSchema = new Schema<IChatMessage>({
    id: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    roomId: {
        type: String,
        required: true,
        index: true
    },
    senderId: {
        type: String,
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    senderEmail: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true,
        maxlength: 2000
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    messageType: {
        type: String,
        enum: ['text', 'system', 'file'],
        default: 'text'
    }
});

// Index for efficient message retrieval by room
ChatMessageSchema.index({ roomId: 1, timestamp: -1 });

export default mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
