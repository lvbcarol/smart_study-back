// src/models/Usuario.ts
import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Role } from '../types';

export interface IUsuario extends Document {
  name: string;
  email: string;
  password: string;
  role: Role;
  language: 'en-US' | 'pt-BR' | 'es-ES';
  accessibility: {
    audioDescription: boolean;
    signLanguage: boolean;
  };
  // Personalização visual (aplicada no front via tokens de tema)
  theme: 'light' | 'dark' | 'system';
  palette: string;
  fontScale: number;
  avatarColor: string;
  /** meta de estudo da semana, em minutos (0 = sem meta) */
  weeklyGoalMinutes: number;
}

const UsuarioSchema: Schema = new Schema<IUsuario>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  language: {
    type: String,
    enum: ['en-US', 'pt-BR', 'es-ES'],
    default: 'en-US', // Inglês como padrão
  },
  accessibility: {
    audioDescription: { type: Boolean, default: false },
    signLanguage: { type: Boolean, default: false },
  },
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  palette: { type: String, default: 'indigo' },
  fontScale: { type: Number, default: 1, min: 0.85, max: 1.4 },
  avatarColor: { type: String, default: '' },
  weeklyGoalMinutes: { type: Number, default: 0, min: 0, max: 6000 },
}, { timestamps: true });

// Hook para criptografar a senha antes de salvar
UsuarioSchema.pre<IUsuario>('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const hash = await bcrypt.hash(this.password, 10);
  this.password = hash;
  next();
});

const Usuario: Model<IUsuario> = mongoose.models.Usuario || mongoose.model<IUsuario>('Usuario', UsuarioSchema);

export default Usuario;
