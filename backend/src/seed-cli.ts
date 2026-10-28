// src/seed-cli.ts — npm run seed (para um MongoDB real; no modo "memory" use SEED_DEMO=true)
import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from './config/db';
import { seedDemo } from './seed';

async function main() {
  if (!process.env.MONGO_URI || process.env.MONGO_URI === 'memory') {
    console.error('Defina MONGO_URI para um MongoDB real, ou use SEED_DEMO=true com o banco em memória.');
    process.exit(1);
  }
  await connectDB();
  await seedDemo();
  await disconnectDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
