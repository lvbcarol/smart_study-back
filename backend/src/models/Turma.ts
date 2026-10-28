// src/models/Turma.ts
import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { generateJoinCode } from '../utils/joinCode';

export interface ITurma extends Document {
  name: string;
  teacher: Types.ObjectId;
  students: Types.ObjectId[];
  // E-mails convidados que ainda não têm conta; são matriculados no registro
  pendingEmails: string[];
  // Código para o aluno entrar na turma sozinho (o professor pode gerar outro)
  joinCode?: string;
}

const TurmaSchema: Schema = new Schema<ITurma>({
  name: { type: String, required: true, trim: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  students: [{ type: Schema.Types.ObjectId, ref: 'Usuario' }],
  pendingEmails: [{ type: String, lowercase: true, trim: true }],
  joinCode: { type: String, uppercase: true, trim: true },
}, { timestamps: true });

TurmaSchema.index({ students: 1 });
TurmaSchema.index({ pendingEmails: 1 });
// único, mas turmas antigas ainda sem código não entram no índice
TurmaSchema.index({ joinCode: 1 }, { unique: true, partialFilterExpression: { joinCode: { $type: 'string' } } });

/** Gera um código que nenhuma turma usa ainda. */
export async function newUniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode();
    if (!(await Turma.exists({ joinCode: code }))) return code;
  }
  throw new Error('Could not generate a unique join code.');
}

// toda turma nova já nasce com código (o hook precisa ser registrado antes de compilar o model)
TurmaSchema.pre<ITurma>('validate', async function (next) {
  try {
    if (!this.joinCode) this.joinCode = await newUniqueJoinCode();
    next();
  } catch (err) {
    next(err as Error);
  }
});

const Turma: Model<ITurma> = mongoose.models.Turma || mongoose.model<ITurma>('Turma', TurmaSchema);

export default Turma;
