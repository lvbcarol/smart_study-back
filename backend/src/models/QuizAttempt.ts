// src/models/QuizAttempt.ts
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Tentativa de quiz de um aluno. Fica fora do caderno para não estourar o limite
// de 16MB do documento e para permitir consultas por aluno/turma/tarefa.
export interface IQuizAttempt extends Document {
  user: Types.ObjectId;
  notebook: Types.ObjectId;
  lesson: Types.ObjectId;
  task?: Types.ObjectId;
  source: 'practice' | 'task';
  attemptNumber: number;
  score: number; // 0..100
  questions: any[]; // perguntas congeladas no momento da tentativa
  answers: any[];
  results: any[]; // por pergunta: GradeResult { type, topic, score, correct, feedback, correctAnswer, explanation }
  createdAt: Date;
  updatedAt: Date;
}

const mixedArray = { type: [Schema.Types.Mixed] as any, default: [] };

const QuizAttemptSchema: Schema = new Schema<IQuizAttempt>({
  user: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  notebook: { type: Schema.Types.ObjectId, ref: 'Notebook', required: true },
  lesson: { type: Schema.Types.ObjectId, required: true },
  task: { type: Schema.Types.ObjectId, ref: 'Task' },
  source: { type: String, enum: ['practice', 'task'], default: 'practice' },
  attemptNumber: { type: Number, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  questions: mixedArray,
  answers: mixedArray,
  results: mixedArray,
}, { timestamps: true });

QuizAttemptSchema.index({ user: 1, createdAt: 1 });
QuizAttemptSchema.index({ lesson: 1, user: 1 });
QuizAttemptSchema.index({ task: 1, user: 1 });

const QuizAttempt: Model<IQuizAttempt> = mongoose.models.QuizAttempt || mongoose.model<IQuizAttempt>('QuizAttempt', QuizAttemptSchema);

export default QuizAttempt;
