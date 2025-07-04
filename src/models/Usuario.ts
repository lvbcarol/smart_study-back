// src/models/Usuario.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IUsuario extends Document {
  nomeCompleto: string;
  email: string;
  senha: string;
}

const UsuarioSchema: Schema = new Schema<IUsuario>({
  nomeCompleto: { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  senha:        { type: String, required: true }
}, {
  timestamps: true
});

const Usuario: Model<IUsuario> = mongoose.model<IUsuario>('Usuario', UsuarioSchema);

export default Usuario;
