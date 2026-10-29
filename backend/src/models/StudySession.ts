// src/models/StudySession.ts — tempo de estudo registrado (automático nas telas do app ou cronômetro manual)
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const SESSION_KINDS = ['summary', 'quiz', 'task', 'flashcards', 'manual'] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export interface IStudySession extends Document {
  user: Types.ObjectId;
  kind: SessionKind;
  notebook?: Types.ObjectId;
  lesson?: Types.ObjectId;
  startedAt: Date;
  seconds: number;
  /** dia local do aluno (YYYY-MM-DD), calculado com o fuso informado pelo app */
  day: string;
}

const StudySessionSchema: Schema = new Schema<IStudySession>({
  user: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  kind: { type: String, enum: SESSION_KINDS, required: true },
  notebook: { type: Schema.Types.ObjectId, ref: 'Notebook' },
  lesson: { type: Schema.Types.ObjectId },
  startedAt: { type: Date, required: true },
  seconds: { type: Number, required: true, min: 1 },
  day: { type: String, required: true },
});

StudySessionSchema.index({ user: 1, day: 1 });

const StudySession: Model<IStudySession> = mongoose.models.StudySession || mongoose.model<IStudySession>('StudySession', StudySessionSchema);

export default StudySession;
