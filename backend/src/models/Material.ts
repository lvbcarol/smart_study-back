// src/models/Material.ts — material de apoio do professor (guardamos só o texto extraído)
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IMaterial extends Document {
  notebook: Types.ObjectId;
  /** se definido, o material vale só para essa aula; senão vale para o caderno todo */
  lesson?: Types.ObjectId;
  title: string;
  kind: 'file' | 'text';
  fileName?: string;
  extractedText: string;
  charCount: number;
  truncated: boolean;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

const MaterialSchema: Schema = new Schema<IMaterial>({
  notebook: { type: Schema.Types.ObjectId, ref: 'Notebook', required: true, index: true },
  lesson: { type: Schema.Types.ObjectId },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  kind: { type: String, enum: ['file', 'text'], required: true },
  fileName: { type: String },
  extractedText: { type: String, required: true },
  charCount: { type: Number, required: true },
  truncated: { type: Boolean, default: false },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
}, { timestamps: true });

const Material: Model<IMaterial> = mongoose.models.Material || mongoose.model<IMaterial>('Material', MaterialSchema);

export default Material;
