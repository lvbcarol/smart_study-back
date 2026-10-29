// src/models/StudyPlan.ts — plano de estudo do dia (um por aluno e por dia)
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const BLOCK_KINDS = ['task', 'agenda', 'weakness', 'flashcards', 'explore', 'kolb'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export interface PlanBlock {
  id: string;
  kind: BlockKind;
  title: string;
  minutes: number;
  /** o "por quê?": explica a sugestão ao aluno */
  reason: string;
  /** para onde o app leva o aluno ao tocar no bloco */
  link: { type: 'task' | 'quiz' | 'flashcards' | 'lesson' | 'summary' | 'agenda'; id?: string };
  done: boolean;
}

export interface IStudyPlan extends Document {
  user: Types.ObjectId;
  day: string;
  minutes: number;
  intro: string;
  blocks: PlanBlock[];
}

const StudyPlanSchema: Schema = new Schema<IStudyPlan>({
  user: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  day: { type: String, required: true },
  minutes: { type: Number, required: true },
  intro: { type: String, default: '' },
  blocks: [{
    _id: false,
    id: { type: String, required: true },
    kind: { type: String, enum: BLOCK_KINDS, required: true },
    title: { type: String, required: true },
    minutes: { type: Number, required: true },
    reason: { type: String, required: true },
    link: { type: { type: String, required: true }, id: String, _id: false },
    done: { type: Boolean, default: false },
  }],
}, { timestamps: true });

StudyPlanSchema.index({ user: 1, day: 1 }, { unique: true });

const StudyPlan: Model<IStudyPlan> = mongoose.models.StudyPlan || mongoose.model<IStudyPlan>('StudyPlan', StudyPlanSchema);

export default StudyPlan;
