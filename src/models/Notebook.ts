// src/models/Notebook.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface para definir a estrutura de uma única mensagem no histórico do chat
interface IChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

// Interface principal para o documento do Caderno, garantindo a tipagem com TypeScript
export interface INotebook extends Document {
  title: string;
  lessons: { 
    _id: mongoose.Types.ObjectId;
    title: string;
    chatHistory?: IChatMessage[];
    quizzAttempts?: { 
      attemptNumber: number;
      score: number; 
      date: Date;
      chatHistory: { 
        sender: 'user' | 'bot'; 
        text: string; 
        quizzOptions?: any 
      }[];
    }[];
    quizzChatHistory?: { sender: 'user' | 'bot'; text: string; quizzOptions?: any }[];
  }[];
  user: mongoose.Schema.Types.ObjectId; // Referência ao usuário dono do caderno
}

// Schema do Mongoose que será usado pelo banco de dados
const NotebookSchema: Schema = new Schema<INotebook>({
  title: { 
    type: String, 
    required: true 
  },
  lessons: [{
    title: { 
      type: String, 
      required: true 
    },
    chatHistory: [{
      sender: { 
        type: String, 
        enum: ['user', 'bot'], 
        required: true 
      },
      text: { 
        type: String, 
        required: true 
      },
    }],
    quizzAttempts: [{
      attemptNumber: { type: Number, required: true },
      score: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      chatHistory: [{
        sender: { type: String, enum: ['user', 'bot'], required: true },
        text: { type: String, required: true },
        quizzOptions: { type: Schema.Types.Mixed }
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
    ref: 'Usuario', // Cria um vínculo com o modelo 'Usuario'
    required: true,
  },
}, { 
  timestamps: true // Adiciona os campos 'createdAt' e 'updatedAt' automaticamente
});

// Verifica se o modelo "Notebook" já existe antes de compilá-lo para evitar erros
const Notebook: Model<INotebook> = mongoose.models.Notebook || mongoose.model<INotebook>('Notebook', NotebookSchema);

export default Notebook;