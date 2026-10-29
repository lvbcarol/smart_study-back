// src/models/Competency.ts — competências que o professor trabalha em uma matéria (caderno)
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICompetency extends Document {
  notebook: Types.ObjectId;
  name: string;
  createdBy: Types.ObjectId;
}

const CompetencySchema: Schema = new Schema<ICompetency>({
  notebook: { type: Schema.Types.ObjectId, ref: 'Notebook', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
}, { timestamps: true });

// nomes únicos por matéria, sem diferenciar maiúsculas
CompetencySchema.index({ notebook: 1, name: 1 }, { unique: true, collation: { locale: 'pt', strength: 2 } });

const Competency: Model<ICompetency> = mongoose.models.Competency || mongoose.model<ICompetency>('Competency', CompetencySchema);

export default Competency;
