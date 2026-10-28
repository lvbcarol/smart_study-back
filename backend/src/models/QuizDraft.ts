// src/models/QuizDraft.ts
// Quiz em andamento. As perguntas COM gabarito ficam só no servidor; o aluno recebe a versão pública.
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IQuizDraft extends Document {
  user: Types.ObjectId;
  notebook: Types.ObjectId;
  lesson: Types.ObjectId;
  /** se definido, é a resolução de uma tarefa (sem correção imediata ao aluno) */
  task?: Types.ObjectId;
  topic: string;
  language: string;
  questions: any[];
  answers: any[]; // null enquanto não respondida
  results: any[]; // null enquanto não respondida
  expiresAt: Date;
}

const mixedArray = { type: [Schema.Types.Mixed] as any, default: [] };

const QuizDraftSchema: Schema = new Schema<IQuizDraft>({
  user: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  notebook: { type: Schema.Types.ObjectId, ref: 'Notebook', required: true },
  lesson: { type: Schema.Types.ObjectId, required: true },
  task: { type: Schema.Types.ObjectId, ref: 'Task' },
  topic: { type: String, required: true },
  language: { type: String, default: 'pt' },
  questions: mixedArray,
  answers: mixedArray,
  results: mixedArray,
  // some sozinho após 6h (índice TTL)
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

// um rascunho por aluno e tarefa
QuizDraftSchema.index({ user: 1, task: 1 }, { unique: true, partialFilterExpression: { task: { $type: 'objectId' } } });

const QuizDraft: Model<IQuizDraft> = mongoose.models.QuizDraft || mongoose.model<IQuizDraft>('QuizDraft', QuizDraftSchema);

export default QuizDraft;
