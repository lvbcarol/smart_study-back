// src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import usuarioRoutes from './routes/usuario.routes';
import notebookRoutes from './routes/notebook.routes'; 
import lessonRoutes from './routes/lesson.routes';
import aiRoutes from './routes/ai.routes';
import progressRoutes from './routes/progress.routes'; // ✅ 1. IMPORTE A ROTA QUE FALTAVA

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] REQUISIÇÃO RECEBIDA: ${req.method} ${req.originalUrl}`);
  next();
});

// Validação para garantir que a URI do Mongo existe
if (!process.env.MONGO_URI) {
  console.error('🔴 Erro: MONGO_URI não definida no arquivo .env');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🟢 MongoDB conectado'))
  .catch((err) => console.error('🔴 Erro MongoDB:', err));

// Rotas da API
app.use('/api/usuario', usuarioRoutes);
app.use('/api/notebooks', notebookRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/progress', progressRoutes); // ✅ 2. ADICIONE O USO DA ROTA AQUI

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));