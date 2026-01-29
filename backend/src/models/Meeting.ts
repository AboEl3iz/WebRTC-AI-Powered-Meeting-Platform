import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IParticipant {
  name: string;
  email: string;
}

export interface IMeeting extends Document {
  id: string;
  roomId: string;
  videoPath?: string;
  participants: IParticipant[];
  status: 'recording' | 'processing' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema: Schema = new Schema({
  id: { type: String, default: uuidv4, unique: true },
  roomId: { type: String, required: true },
  videoPath: { type: String },
  participants: [{
    name: { type: String, required: true },
    email: { type: String, required: true }
  }],
  status: { 
    type: String, 
    enum: ['recording', 'processing', 'completed'], 
    default: 'recording' 
  }
}, { timestamps: true });

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);
