// src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB, disconnectDB } from './config/db';
import usuarioRoutes from './routes/usuario.routes';
import notebookRoutes from './routes/notebook.routes';
import lessonRoutes from './routes/lesson.routes';
import aiRoutes from './routes/ai.routes';
import progressRoutes from './routes/progress.routes';

const app = express();
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined));
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] REQUISIÇÃO RECEBIDA: ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', aiMode: process.env.AI_MODE || 'mock' });
});

// Rotas da API
app.use('/api/usuario', usuarioRoutes);
app.use('/api/notebooks', notebookRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/progress', progressRoutes);

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT} (IA: ${process.env.AI_MODE || 'mock'})`));
  })
  .catch((err) => {
    console.error('🔴 Erro MongoDB:', err);
    process.exit(1);
  });

process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});
