// src/models/Notebook.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface INotebook extends Document {
  title: string;
  lessons: { title: string }[];
  user: mongoose.Schema.Types.ObjectId;
}

const NotebookSchema: Schema = new Schema<INotebook>({
  title: { type: String, required: true },
  lessons: [{
    title: { type: String, required: true }
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
  },
}, { timestamps: true });

const Notebook: Model<INotebook> = mongoose.model<INotebook>('Notebook', NotebookSchema);

export default Notebook;