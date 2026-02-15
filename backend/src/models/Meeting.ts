import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IIntegrations {
  notion?: {
    access_token: string;
    workspace_id: string;
    database_id?: string;
  };
  google_calendar?: {
    access_token: string;
    refresh_token?: string;
    calendar_id?: string;
  };
}

export interface IParticipant {
  name: string;
  email: string;
  aiEnabled: boolean;
  integrations?: IIntegrations;
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
    email: { type: String, required: true },
    aiEnabled: { type: Boolean, default: false },
    integrations: {
      notion: {
        access_token: { type: String },
        workspace_id: { type: String },
        database_id: { type: String },
      },
      google_calendar: {
        access_token: { type: String },
        refresh_token: { type: String },
        calendar_id: { type: String, default: 'primary' },
      },
    },
  }],
  status: {
    type: String,
    enum: ['recording', 'processing', 'completed'],
    default: 'recording'
  }
}, { timestamps: true });

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);
