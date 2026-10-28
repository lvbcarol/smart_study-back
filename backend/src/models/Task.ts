// src/models/Task.ts — tarefa: um quiz fixo (com gabarito) que o professor publica para a turma
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ITask extends Document {
  turma: Types.ObjectId;
  notebook: Types.ObjectId;
  lesson: Types.ObjectId;
  title: string;
  description?: string;
  questions: any[]; // perguntas completas (com gabarito); o aluno só recebe a versão pública
  dueDate?: Date;
  published: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const TaskSchema: Schema = new Schema<ITask>({
  turma: { type: Schema.Types.ObjectId, ref: 'Turma', required: true, index: true },
  notebook: { type: Schema.Types.ObjectId, ref: 'Notebook', required: true, index: true },
  lesson: { type: Schema.Types.ObjectId, required: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 1000 },
  questions: { type: [Schema.Types.Mixed] as any, default: [] },
  dueDate: { type: Date },
  published: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
}, { timestamps: true });

const Task: Model<ITask> = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);

export default Task;
