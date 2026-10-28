// src/models/Usuario.ts
import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUsuario extends Document {
  name: string;
  email: string;
  password: string;
  // ✅ NOVOS CAMPOS
  language: 'en-US' | 'pt-BR';
  accessibility: {
    audioDescription: boolean;
    signLanguage: boolean;
  };
}

const UsuarioSchema: Schema = new Schema<IUsuario>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  // ✅ DEFINIÇÃO DOS NOVOS CAMPOS NO SCHEMA
  language: {
    type: String,
    enum: ['en-US', 'pt-BR'],
    default: 'en-US', // Inglês como padrão
  },
  accessibility: {
    audioDescription: { type: Boolean, default: false },
    signLanguage: { type: Boolean, default: false },
  },
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

const Usuario: Model<IUsuario> = mongoose.model<IUsuario>('Usuario', UsuarioSchema);

export default Usuario;