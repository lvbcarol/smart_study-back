// src/models/ChatSession.ts
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Conversa do resumo/chat de uma aula, por aluno.
export interface IChatSession extends Document {
  user: Types.ObjectId;
  lesson: Types.ObjectId;
  messages: { sender: 'user' | 'bot'; text: string }[];
}

const ChatSessionSchema: Schema = new Schema<IChatSession>({
  user: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  lesson: { type: Schema.Types.ObjectId, required: true },
  messages: [{
    _id: false,
    sender: { type: String, enum: ['user', 'bot'], required: true },
    text: { type: String, required: true },
  }],
}, { timestamps: true });

ChatSessionSchema.index({ user: 1, lesson: 1 }, { unique: true });

const ChatSession: Model<IChatSession> = mongoose.models.ChatSession || mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);

export default ChatSession;
