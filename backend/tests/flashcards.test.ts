import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import Usuario from '../src/models/Usuario';
import FlashcardDeck from '../src/models/FlashcardDeck';
import { BOX_INTERVAL_MS } from '../src/flashcards/leitner';

let mongod: MongoMemoryServer;
const app = createApp();

let teacher: string, ana: string, bia: string, outsider: string;
let notebookId: string, lessonId: string, otherLessonId: string;
let deckId: string;

async function signup(email: string, extra: Record<string, unknown> = {}) {
  await request(app).post('/api/usuario/register').send({ name: email.split('@')[0], email, password: 'secret123', ...extra });
  const res = await request(app).post('/api/usuario/login').send({ email, password: 'secret123' });
  return `Bearer ${res.body.token}`;
}

const generate = (auth: string, body: Record<string, unknown> = {}) =>
  request(app).post('/api/flashcards/decks/generate').set('Authorization', auth).send({ lessonId, topic: 'Derivadas', language: 'pt-BR', count: 6, ...body });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('flash'));
  await Usuario.init();
  await FlashcardDeck.init();

  teacher = await signup('prof@f.com', { role: 'teacher', inviteCode: 'invite-123' });
  ana = await signup('ana@f.com');
  bia = await signup('bia@f.com');
  outsider = await signup('fora@f.com');

  const turma = (await request(app).post('/api/turmas').set('Authorization', teacher).send({ name: '3A' })).body._id;
  await request(app).post(`/api/turmas/${turma}/students`).set('Authorization', teacher).send({ emails: 'ana@f.com, bia@f.com' });
  notebookId = (await request(app).post('/api/notebooks').set('Authorization', teacher).send({ title: 'Cálculo', turma })).body._id;
  await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', teacher).send({ title: 'Derivadas' });
  const withTwo = await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', teacher).send({ title: 'Integrais' });
  lessonId = withTwo.body.lessons[0]._id;
  otherLessonId = withTwo.body.lessons[1]._id;
  await request(app).post(`/api/notebooks/${notebookId}/materials/text`).set('Authorization', teacher).send({ title: 'Resumo', text: 'Derivada é a taxa de variação.' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('gerar baralho', () => {
  it('exige login, acesso à aula e dados válidos', async () => {
    expect((await request(app).post('/api/flashcards/decks/generate').send({ lessonId, topic: 'x' })).status).toBe(401);
    expect((await generate(outsider)).status).toBe(404);
    expect((await generate(ana, { topic: '' })).status).toBe(400);
    expect((await generate(ana, { count: 99 })).status).toBe(400);
    expect((await generate(ana, { lessonId: 'invalido' })).status).toBe(404);
  });

  it('cria o baralho da aula com cartões novos, já disponíveis para estudo', async () => {
    const res = await generate(ana);
    expect(res.status).toBe(201);
    deckId = res.body.deck._id;
    expect(res.body.added).toBe(6);
    expect(res.body.materialsUsed).toBeGreaterThanOrEqual(1); // materiais do professor entram no contexto
    expect(res.body.deck).toMatchObject({ lessonTitle: 'Derivadas', notebookTitle: 'Cálculo', total: 6, due: 6, new: 6, learned: 0 });
  });

  it('gerar de novo acrescenta ao mesmo baralho e não duplica cartões', async () => {
    const again = await generate(ana, { count: 6 }); // o mock repete os mesmos 6 cartões
    expect(again.body.added).toBe(0);
    expect(again.body.deck._id).toBe(deckId);
    const more = await generate(ana, { count: 10 }); // 4 cartões novos além dos 6 existentes
    expect(more.body.added).toBe(4);
    expect(more.body.deck.total).toBe(10);
  });

  it('cada aluno tem o seu baralho, e baralhos de aulas diferentes são separados', async () => {
    const mine = await request(app).get('/api/flashcards/decks').set('Authorization', ana);
    expect(mine.body).toHaveLength(1);
    expect((await request(app).get('/api/flashcards/decks').set('Authorization', bia)).body).toEqual([]);

    const bias = await generate(bia);
    expect(bias.body.deck._id).not.toBe(deckId);
    await generate(ana, { lessonId: otherLessonId, topic: 'Integrais' });
    expect((await request(app).get('/api/flashcards/decks').set('Authorization', ana)).body).toHaveLength(2);
    const filtered = await request(app).get(`/api/flashcards/decks?lessonId=${otherLessonId}`).set('Authorization', ana);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].lessonTitle).toBe('Integrais');
  });
});

describe('sessão de estudo e revisão', () => {
  it('a sessão traz os cartões que vencem e respeita o limite', async () => {
    const res = await request(app).get(`/api/flashcards/decks/${deckId}/session?limit=4`).set('Authorization', ana);
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(4);
    expect(res.body.cards[0]).toMatchObject({ box: 0 });
    expect(res.body.cards[0].front).toBeTruthy();
    expect(res.body.cards[0].back).toBeTruthy();
    expect(res.body.stats).toMatchObject({ total: 10, due: 10 });
  });

  it('"lembrei" espaça o cartão para o futuro e ele sai da sessão', async () => {
    const session = await request(app).get(`/api/flashcards/decks/${deckId}/session`).set('Authorization', ana);
    const cardId = session.body.cards[0]._id;
    const res = await request(app).post(`/api/flashcards/decks/${deckId}/review`).set('Authorization', ana).send({ cardId, remembered: true });
    expect(res.status).toBe(200);
    expect(res.body.box).toBe(2);
    expect(new Date(res.body.dueAt).getTime()).toBeGreaterThan(Date.now() + BOX_INTERVAL_MS[2] - 5000);

    const after = await request(app).get(`/api/flashcards/decks/${deckId}/session`).set('Authorization', ana);
    expect(after.body.cards.map((c: any) => c._id)).not.toContain(cardId);
    expect(after.body.stats.due).toBe(9);
  });

  it('"não lembrei" manda o cartão para a caixa 1 e ele volta em alguns minutos', async () => {
    const session = await request(app).get(`/api/flashcards/decks/${deckId}/session`).set('Authorization', ana);
    const cardId = session.body.cards[0]._id;
    const res = await request(app).post(`/api/flashcards/decks/${deckId}/review`).set('Authorization', ana).send({ cardId, remembered: false });
    expect(res.body.box).toBe(1);
    const soon = new Date(res.body.dueAt).getTime() - Date.now();
    expect(soon).toBeGreaterThan(9 * 60_000);
    expect(soon).toBeLessThanOrEqual(10 * 60_000);

    // passam-se 11 minutos: o cartão reaparece, antes dos novos
    await FlashcardDeck.updateOne({ _id: deckId, 'cards._id': cardId }, { $set: { 'cards.$.dueAt': new Date(Date.now() - 1000) } });
    const later = await request(app).get(`/api/flashcards/decks/${deckId}/session`).set('Authorization', ana);
    expect(later.body.cards[0]._id).toBe(cardId);
    expect(later.body.cards[0].box).toBe(1);

    const deck = await request(app).get(`/api/flashcards/decks/${deckId}`).set('Authorization', ana);
    expect(deck.body.cards.find((c: any) => c._id === cardId).lapses).toBe(1);
  });

  it('valida a revisão e o dono do baralho', async () => {
    const session = await request(app).get(`/api/flashcards/decks/${deckId}/session`).set('Authorization', ana);
    const cardId = session.body.cards[0]._id;
    const url = `/api/flashcards/decks/${deckId}/review`;
    expect((await request(app).post(url).set('Authorization', ana).send({ cardId, remembered: 'sim' })).status).toBe(400);
    expect((await request(app).post(url).set('Authorization', ana).send({ cardId: String(new mongoose.Types.ObjectId()), remembered: true })).status).toBe(404);
    expect((await request(app).post(url).set('Authorization', bia).send({ cardId, remembered: true })).status).toBe(404);
    expect((await request(app).get(`/api/flashcards/decks/${deckId}/session`).set('Authorization', bia)).status).toBe(404);
    expect((await request(app).get(`/api/flashcards/decks/${deckId}`).set('Authorization', teacher)).status).toBe(403); // professor não usa flashcards
    expect((await request(app).get('/api/flashcards/decks/invalido/session').set('Authorization', ana)).status).toBe(404);
  });

  it('revisões seguidas no mesmo baralho não se atropelam', async () => {
    const session = await request(app).get(`/api/flashcards/decks/${deckId}/session`).set('Authorization', ana);
    const ids: string[] = session.body.cards.slice(0, 4).map((c: any) => c._id);
    const results = await Promise.all(ids.map((cardId) => request(app).post(`/api/flashcards/decks/${deckId}/review`).set('Authorization', ana).send({ cardId, remembered: true })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const deck = await FlashcardDeck.findById(deckId);
    for (const id of ids) expect(deck!.cards.find((c) => String(c._id) === id)!.reps).toBeGreaterThanOrEqual(1);
  });
});

describe('resumo, exclusão e atualização', () => {
  it('o resumo soma o que há para revisar em todos os baralhos', async () => {
    const summary = await request(app).get('/api/flashcards/summary').set('Authorization', ana);
    expect(summary.status).toBe(200);
    expect(summary.body.decks).toBe(2);
    const decks = await request(app).get('/api/flashcards/decks').set('Authorization', ana);
    expect(summary.body.due).toBe(decks.body.reduce((s: number, d: any) => s + d.due, 0));
    expect((await request(app).get('/api/flashcards/summary').set('Authorization', bia)).body.decks).toBe(1);
    expect((await request(app).get('/api/flashcards/summary')).status).toBe(401);
  });

  it('exclui um cartão e o baralho inteiro', async () => {
    const deck = await request(app).get(`/api/flashcards/decks/${deckId}`).set('Authorization', ana);
    const total = deck.body.cards.length;
    const cardId = deck.body.cards[0]._id;
    expect((await request(app).delete(`/api/flashcards/decks/${deckId}/cards/${cardId}`).set('Authorization', bia)).status).toBe(404);
    expect((await request(app).delete(`/api/flashcards/decks/${deckId}/cards/${cardId}`).set('Authorization', ana)).status).toBe(204);
    expect((await request(app).get(`/api/flashcards/decks/${deckId}`).set('Authorization', ana)).body.cards).toHaveLength(total - 1);
    expect((await request(app).delete(`/api/flashcards/decks/${deckId}/cards/${cardId}`).set('Authorization', ana)).status).toBe(404);

    expect((await request(app).delete(`/api/flashcards/decks/${deckId}`).set('Authorization', bia)).status).toBe(404);
    expect((await request(app).delete(`/api/flashcards/decks/${deckId}`).set('Authorization', ana)).status).toBe(204);
    expect((await request(app).get(`/api/flashcards/decks/${deckId}`).set('Authorization', ana)).status).toBe(404);
  });
});
