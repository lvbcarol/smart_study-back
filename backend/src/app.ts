// src/app.ts
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import usuarioRoutes from './routes/usuario.routes';
import notebookRoutes from './routes/notebook.routes';
import lessonRoutes from './routes/lesson.routes';
import aiRoutes from './routes/ai.routes';
import quizzRoutes from './routes/quizz.routes';
import progressRoutes from './routes/progress.routes';

export function createApp() {
  const app = express();
  app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined));
  app.use(express.json());

  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      console.log(`[${new Date().toLocaleTimeString()}] REQUISIÇÃO RECEBIDA: ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', aiMode: process.env.AI_MODE || 'mock' });
  });

  // Chamadas de IA custam dinheiro/cota: limita por IP
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.AI_RATE_LIMIT) || 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many AI requests. Try again in a minute.' },
  });

  app.use('/api/usuario', usuarioRoutes);
  app.use('/api/notebooks', notebookRoutes);
  app.use('/api/lessons', lessonRoutes);
  app.use('/api/ai', aiLimiter, aiRoutes);
  app.use('/api/quizz', aiLimiter, quizzRoutes);
  app.use('/api/progress', progressRoutes);

  return app;
}
