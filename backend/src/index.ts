// src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { seedDemo } from './seed';

const app = createApp();
const PORT = process.env.PORT || 3000;

connectDB()
  .then(async () => {
    if (process.env.SEED_DEMO === 'true') await seedDemo();
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
