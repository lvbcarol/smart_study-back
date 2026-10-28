import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import Usuario from '../src/models/Usuario';
import Turma from '../src/models/Turma';
import { JOIN_CODE_LENGTH, normalizeJoinCode } from '../src/utils/joinCode';

let mongod: MongoMemoryServer;
const app = createApp();

let teacher: string, teacher2: string, ana: string, bia: string;
let turmaId: string, joinCode: string, lessonId: string;

async function signup(email: string, extra: Record<string, unknown> = {}) {
  await request(app).post('/api/usuario/register').send({ name: email.split('@')[0], email, password: 'secret123', ...extra });
  const res = await request(app).post('/api/usuario/login').send({ email, password: 'secret123' });
  return `Bearer ${res.body.token}`;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('vinculo'));
  await Usuario.init();
  await Turma.init();
  teacher = await signup('prof@v.com', { role: 'teacher', inviteCode: 'invite-123' });
  teacher2 = await signup('prof2@v.com', { role: 'teacher', inviteCode: 'invite-123' });
  ana = await signup('ana@v.com');
  bia = await signup('bia@v.com');

  const turma = await request(app).post('/api/turmas').set('Authorization', teacher).send({ name: '3º Ano A' });
  turmaId = turma.body._id;
  joinCode = turma.body.joinCode;
  const nb = await request(app).post('/api/notebooks').set('Authorization', ana).send({ title: 'Meu caderno' });
  const lesson = await request(app).post(`/api/notebooks/${nb.body._id}/lessons`).set('Authorization', ana).send({ title: 'Aula' });
  lessonId = lesson.body.lessons.at(-1)._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('código da turma', () => {
  it('toda turma nasce com um código curto e sem caracteres ambíguos', () => {
    expect(joinCode).toMatch(new RegExp(`^[A-HJ-NP-Z2-9]{${JOIN_CODE_LENGTH}}$`));
  });

  it('normaliza o que o aluno digita', () => {
    expect(normalizeJoinCode(' ab-c 234 ')).toBe('ABC234');
  });

  it('o professor vê o código na lista e no detalhe, e pode gerar outro', async () => {
    const list = await request(app).get('/api/turmas').set('Authorization', teacher);
    expect(list.body[0].joinCode).toBe(joinCode);
    const detail = await request(app).get(`/api/turmas/${turmaId}`).set('Authorization', teacher);
    expect(detail.body.joinCode).toBe(joinCode);

    const other = await request(app).post(`/api/turmas/${turmaId}/code`).set('Authorization', teacher2);
    expect(other.status).toBe(404); // só o dono
    const fresh = await request(app).post(`/api/turmas/${turmaId}/code`).set('Authorization', teacher);
    expect(fresh.status).toBe(200);
    expect(fresh.body.joinCode).not.toBe(joinCode);
    joinCode = fresh.body.joinCode;
  });

  it('turma antiga, sem código, ganha um na primeira consulta do professor', async () => {
    const old = await Turma.collection.insertOne({
      name: 'Antiga', teacher: new mongoose.Types.ObjectId((await Usuario.findOne({ email: 'prof@v.com' }))!.id), students: [], pendingEmails: [],
    });
    const detail = await request(app).get(`/api/turmas/${old.insertedId}`).set('Authorization', teacher);
    expect(detail.body.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe('aluno avulso x vinculado', () => {
  it('sem turma o aluno é avulso', async () => {
    const me = await request(app).get('/api/usuario/me').set('Authorization', ana);
    expect(me.body.linked).toBe(false);
    expect(me.body.turmas).toEqual([]);
    expect((await request(app).get('/api/turmas/mine').set('Authorization', ana)).body).toEqual([]);
  });

  it('código inexistente ou vazio devolve a mesma resposta 404', async () => {
    expect((await request(app).post('/api/turmas/join').set('Authorization', ana).send({ code: 'ZZZZZZ' })).status).toBe(404);
    expect((await request(app).post('/api/turmas/join').set('Authorization', ana).send({ code: '--' })).status).toBe(404);
    expect((await request(app).post('/api/turmas/join').set('Authorization', ana).send({})).status).toBe(400);
  });

  it('professor não entra em turma com código', async () => {
    expect((await request(app).post('/api/turmas/join').set('Authorization', teacher2).send({ code: joinCode })).status).toBe(403);
  });

  it('entra com o código (qualquer caixa/formatação) e passa a ser vinculado', async () => {
    const spaced = `${joinCode.slice(0, 3)}-${joinCode.slice(3)}`.toLowerCase();
    const res = await request(app).post('/api/turmas/join').set('Authorization', ana).send({ code: spaced });
    expect(res.status).toBe(200);
    expect(res.body.already).toBe(false);
    expect(res.body.turma).toMatchObject({ name: '3º Ano A', teacherName: 'prof' });

    const again = await request(app).post('/api/turmas/join').set('Authorization', ana).send({ code: joinCode });
    expect(again.body.already).toBe(true);

    const me = await request(app).get('/api/usuario/me').set('Authorization', ana);
    expect(me.body.linked).toBe(true);
    expect(me.body.turmas).toHaveLength(1);
    const detail = await request(app).get(`/api/turmas/${turmaId}`).set('Authorization', teacher);
    expect(detail.body.students.map((s: any) => s.email)).toEqual(['ana@v.com']);
  });

  it('entrar com o código tira o e-mail da lista de pendentes', async () => {
    await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: 'bia@v.com' });
    // bia já tem conta, então foi matriculada direto; simulamos um pendente antigo
    await Turma.updateOne({ _id: turmaId }, { $pull: { students: (await Usuario.findOne({ email: 'bia@v.com' }))!._id }, $addToSet: { pendingEmails: 'bia@v.com' } });
    await request(app).post('/api/turmas/join').set('Authorization', bia).send({ code: joinCode });
    const t = await Turma.findById(turmaId).lean();
    expect(t!.pendingEmails).not.toContain('bia@v.com');
    expect(t!.students).toHaveLength(2);
  });

  it('o aluno sai da turma e volta a ser avulso; só quem está na turma consegue sair', async () => {
    expect((await request(app).delete(`/api/turmas/${turmaId}/leave`).set('Authorization', ana)).status).toBe(204);
    expect((await request(app).delete(`/api/turmas/${turmaId}/leave`).set('Authorization', ana)).status).toBe(404);
    expect((await request(app).delete('/api/turmas/invalido/leave').set('Authorization', ana)).status).toBe(404);
    const me = await request(app).get('/api/usuario/me').set('Authorization', ana);
    expect(me.body.linked).toBe(false);
  });

  it('o professor não aparece como vinculado e o /me dele não tem turmas de aluno', async () => {
    const me = await request(app).get('/api/usuario/me').set('Authorization', teacher);
    expect(me.body.linked).toBe(false);
    expect(me.body.turmas).toEqual([]);
  });

  it('aluno avulso continua criando e estudando nos próprios cadernos', async () => {
    const summary = await request(app).post('/api/ai/summarize').set('Authorization', ana).send({ topic: 'Derivadas', lessonId });
    expect(summary.status).toBe(200);
    const quiz = await request(app).post('/api/quizz/drafts').set('Authorization', ana).send({ lessonId, topic: 'Derivadas', language: 'pt-BR', count: 4 });
    expect(quiz.status).toBe(201);
    expect(quiz.body.questions).toHaveLength(4);
  });
});

describe('professor não estuda com IA, só cria tarefas', () => {
  it('resumo, chat, quiz de estudo e flashcards respondem 403', async () => {
    const t = (method: 'get' | 'post', url: string, body: object = {}) => request(app)[method](url).set('Authorization', teacher).send(body);
    expect((await t('post', '/api/ai/summarize', { topic: 'x', lessonId })).status).toBe(403);
    expect((await t('post', '/api/ai/chat', { lessonId, message: 'oi' })).status).toBe(403);
    expect((await t('post', '/api/quizz/drafts', { lessonId, topic: 'x' })).status).toBe(403);
    expect((await t('get', '/api/quizz/weakness')).status).toBe(403);
    expect((await t('get', '/api/flashcards/decks')).status).toBe(403);
    expect((await t('post', '/api/flashcards/decks/generate', { lessonId, topic: 'x' })).status).toBe(403);
  });

  it('sem login continua 401', async () => {
    expect((await request(app).post('/api/ai/summarize').send({ topic: 'x' })).status).toBe(401);
  });

  it('o professor continua criando tarefas com IA', async () => {
    const nb = await request(app).post('/api/notebooks').set('Authorization', teacher).send({ title: 'Matemática', turma: turmaId });
    expect(nb.status).toBe(201);
    const l = await request(app).post(`/api/notebooks/${nb.body._id}/lessons`).set('Authorization', teacher).send({ title: 'Derivadas' });
    const gen = await request(app).post('/api/tasks/generate').set('Authorization', teacher).send({
      notebookId: nb.body._id, lessonId: l.body.lessons.at(-1)._id, topic: 'Derivadas', count: 4, language: 'pt-BR',
    });
    expect(gen.status).toBe(200);
  });
});
