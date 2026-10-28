// src/models/Turma.ts
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ITurma extends Document {
  name: string;
  teacher: Types.ObjectId;
  students: Types.ObjectId[];
  // E-mails convidados que ainda não têm conta; são matriculados no registro
  pendingEmails: string[];
}

const TurmaSchema: Schema = new Schema<ITurma>({
  name: { type: String, required: true, trim: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  students: [{ type: Schema.Types.ObjectId, ref: 'Usuario' }],
  pendingEmails: [{ type: String, lowercase: true, trim: true }],
}, { timestamps: true });

TurmaSchema.index({ students: 1 });
TurmaSchema.index({ pendingEmails: 1 });

const Turma: Model<ITurma> = mongoose.models.Turma || mongoose.model<ITurma>('Turma', TurmaSchema);

export default Turma;
