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
    chatHistory?: IChatMessage[]; // O histórico do chat é opcional para cada aula
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
    // Definindo a estrutura do histórico do chat dentro de cada aula
    chatHistory: [{
      sender: { 
        type: String, 
        enum: ['user', 'bot'], // O remetente só pode ser 'user' ou 'bot'
        required: true 
      },
      text: { 
        type: String, 
        required: true 
      },
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

const Notebook: Model<INotebook> = mongoose.model<INotebook>('Notebook', NotebookSchema);

export default Notebook;