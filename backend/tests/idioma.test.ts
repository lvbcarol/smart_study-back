import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import Usuario from '../src/models/Usuario';
import { aiLanguageName } from '../src/services/lang';

describe('idioma que a IA recebe', () => {
  it('pt vira português, es vira espanhol e o resto vira inglês', () => {
    expect(aiLanguageName('pt-BR')).toBe('Brazilian Portuguese');
    expect(aiLanguageName('pt')).toBe('Brazilian Portuguese');
    expect(aiLanguageName('es-ES')).toBe('Spanish');
    expect(aiLanguageName('ES')).toBe('Spanish');
    expect(aiLanguageName('en-US')).toBe('English');
    expect(aiLanguageName('fr')).toBe('English');
    expect(aiLanguageName(undefined)).toBe('English');
  });
});

describe('idioma da conta', () => {
  let mongod: MongoMemoryServer;
  const app = createApp();
  let auth: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri('idioma'));
    await Usuario.init();
    await request(app).post('/api/usuario/register').send({ name: 'Ana', email: 'ana@i.com', password: 'secret123' });
    auth = `Bearer ${(await request(app).post('/api/usuario/login').send({ email: 'ana@i.com', password: 'secret123' })).body.token}`;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('aceita pt-BR, es-ES e en-US e rejeita os demais', async () => {
    for (const language of ['es-ES', 'pt-BR', 'en-US']) {
      const res = await request(app).put('/api/usuario/me').set('Authorization', auth).send({ language });
      expect(res.status).toBe(200);
      expect(res.body.language).toBe(language);
    }
    expect((await request(app).put('/api/usuario/me').set('Authorization', auth).send({ language: 'fr-FR' })).status).toBe(400);
    expect((await request(app).get('/api/usuario/me').set('Authorization', auth)).body.language).toBe('en-US');
  });

  it('o resumo em espanhol responde (mock) sem erro', async () => {
    const nb = await request(app).post('/api/notebooks').set('Authorization', auth).send({ title: 'Cálculo' });
    const l = await request(app).post(`/api/notebooks/${nb.body._id}/lessons`).set('Authorization', auth).send({ title: 'Derivadas' });
    const res = await request(app).post('/api/ai/summarize').set('Authorization', auth).send({ topic: 'Derivadas', language: 'es', lessonId: l.body.lessons[0]._id });
    expect(res.status).toBe(200);
    expect(res.body.summary.length).toBeGreaterThan(20);
  });
});
