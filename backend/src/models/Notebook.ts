// src/models/Notebook.ts
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Caderno = uma matéria. Se `turma` estiver definida, é um caderno do professor
// e os alunos matriculados na turma o leem (somente leitura).
// Chat e tentativas de quiz ficam em ChatSession e QuizAttempt.
export interface INotebook extends Document {
  title: string;
  owner: Types.ObjectId;
  turma?: Types.ObjectId;
  lessons: {
    _id: Types.ObjectId;
    title: string;
  }[];
}

const NotebookSchema: Schema = new Schema<INotebook>({
  title: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  turma: { type: Schema.Types.ObjectId, ref: 'Turma', index: true },
  lessons: [{
    title: { type: String, required: true },
  }],
}, {
  timestamps: true
});

const Notebook: Model<INotebook> = mongoose.models.Notebook || mongoose.model<INotebook>('Notebook', NotebookSchema);

export default Notebook;
