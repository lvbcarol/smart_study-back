// src/models/AgendaItem.ts — tarefas e lembretes pessoais do aluno (as tarefas do professor vêm de Task)
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const AGENDA_KINDS = ['task', 'reminder'] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];

export interface IAgendaItem extends Document {
  user: Types.ObjectId;
  kind: AgendaKind;
  title: string;
  notes?: string;
  dueAt?: Date;
  done: boolean;
  doneAt?: Date;
  createdAt: Date;
}

const AgendaItemSchema: Schema = new Schema<IAgendaItem>({
  user: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  kind: { type: String, enum: AGENDA_KINDS, required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  notes: { type: String, trim: true, maxlength: 500 },
  dueAt: { type: Date },
  done: { type: Boolean, default: false },
  doneAt: { type: Date },
}, { timestamps: true });

AgendaItemSchema.index({ user: 1, dueAt: 1 });

const AgendaItem: Model<IAgendaItem> = mongoose.models.AgendaItem || mongoose.model<IAgendaItem>('AgendaItem', AgendaItemSchema);

export default AgendaItem;
