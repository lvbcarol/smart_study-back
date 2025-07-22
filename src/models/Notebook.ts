// src/models/Notebook.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface para definir a estrutura de uma única mensagem no histórico do chat
interface IChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

// Interface principal para o documento do Caderno
export interface INotebook extends Document {
  title: string;
  lessons: { 
    _id: mongoose.Types.ObjectId;
    title: string;
    chatHistory?: IChatMessage[];
    quizzAttempts?: { 
      score: number; 
      date: Date;
      mistakes: {
        question: string;
        explanation: string;
      }[];
    }[];
    quizzChatHistory?: { sender: 'user' | 'bot'; text: string; quizzOptions?: any }[];
  }[];
  user: mongoose.Schema.Types.ObjectId;
}

// Schema do Mongoose
const NotebookSchema: Schema = new Schema<INotebook>({
  title: { type: String, required: true },
  lessons: [{
    title: { type: String, required: true },
    chatHistory: [{
      sender: { type: String, enum: ['user', 'bot'], required: true },
      text: { type: String, required: true },
    }],
    quizzAttempts: [{
      score: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      mistakes: [{
        question: { type: String },
        explanation: { type: String },
      }]
    }],
    quizzChatHistory: [{
      sender: { type: String, enum: ['user', 'bot'], required: true },
      text: { type: String, required: true },
      quizzOptions: { type: Schema.Types.Mixed }
    }]
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
  },
}, { 
  timestamps: true
});

// Compila e exporta o modelo
const Notebook: Model<INotebook> = mongoose.model<INotebook>('Notebook', NotebookSchema);

export default Notebook;