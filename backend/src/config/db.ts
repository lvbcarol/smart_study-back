// src/config/db.ts
import mongoose from 'mongoose';

let memoryServer: { stop: () => Promise<boolean> } | null = null;

/**
 * Conecta ao MongoDB.
 * - MONGO_URI com uma connection string real (ex.: Atlas): usa ela.
 * - MONGO_URI ausente ou "memory": sobe um MongoDB em memoria (somente dev, dados somem ao reiniciar).
 */
export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI;

  if (uri && uri !== 'memory') {
    await mongoose.connect(uri);
    console.log('🟢 MongoDB conectado (MONGO_URI)');
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGO_URI deve ser definida em producao.');
  }

  // import dinamico: mongodb-memory-server e devDependency
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  memoryServer = server;
  await mongoose.connect(server.getUri('smartstudy'));
  console.log('🟡 MongoDB EM MEMORIA conectado (os dados somem ao reiniciar o servidor)');
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
