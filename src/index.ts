import dotenv from 'dotenv';
dotenv.config(); // ← Isso carrega as variáveis do .env

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import usuarioRoutes from './routes/usuario.routes';
import notebookRoutes from './routes/notebook.routes';

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI!)
  .then(() => console.log('🟢 MongoDB conectado'))
  .catch((err) => console.error('🔴 Erro MongoDB:', err));

app.use('/usuario', usuarioRoutes);
app.use('/notebooks', notebookRoutes);

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
