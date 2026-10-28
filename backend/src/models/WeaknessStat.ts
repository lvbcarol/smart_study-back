// src/models/WeaknessStat.ts — desempenho por (aluno, aula, tipo de pergunta, tópico); ver quiz/weakness.ts
import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { QUESTION_TYPES, QuestionType } from '../quiz/questions';

export interface IWeaknessStat extends Document {
  user: Types.ObjectId;
  lesson: Types.ObjectId;
  type: QuestionType;
  topic: string;
  topicKey: string; // topic em minúsculas, para unicidade
  seen: number;
  wrong: number;
  lastAt: Date;
  misses: { question: string; at: Date }[]; // últimos erros "em aberto" do tópico (máx. 3)
}

const WeaknessStatSchema: Schema = new Schema<IWeaknessStat>({
  user: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  lesson: { type: Schema.Types.ObjectId, required: true },
  type: { type: String, enum: QUESTION_TYPES, required: true },
  topic: { type: String, required: true },
  topicKey: { type: String, required: true },
  seen: { type: Number, default: 0 },
  wrong: { type: Number, default: 0 },
  lastAt: { type: Date, default: Date.now },
  misses: [{ _id: false, question: String, at: Date }],
});

WeaknessStatSchema.index({ user: 1, lesson: 1, type: 1, topicKey: 1 }, { unique: true });

const WeaknessStat: Model<IWeaknessStat> = mongoose.models.WeaknessStat || mongoose.model<IWeaknessStat>('WeaknessStat', WeaknessStatSchema);

export default WeaknessStat;
