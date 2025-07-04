// src/models/Notebook.ts
import mongoose, { Document, Schema } from 'mongoose';

interface INotebook extends Document {
  titulo: string;
  aulas: string[];
  usuarioId: mongoose.Types.ObjectId;
}

const NotebookSchema = new Schema<INotebook>({
  titulo: { type: String, required: true },
  aulas: [{ type: String }],
  usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true }
}, { timestamps: true });

export default mongoose.model<INotebook>('Notebook', NotebookSchema);
