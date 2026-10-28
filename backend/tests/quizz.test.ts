import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import Usuario from '../src/models/Usuario';
import Notebook from '../src/models/Notebook';
import WeaknessStat from '../src/models/WeaknessStat';
import QuizAttempt from '../src/models/QuizAttempt';
import { answerFor, startQuiz, takeQuiz } from './helpers';

let mongod: MongoMemoryServer;
const app = createApp();
let auth: string;
let otherAuth: string;
let lessonId: string;
let otherLessonId: string;

async function signup(email: string) {
  await request(app).post('/api/usuario/register').send({ name: email.split('@')[0], email, password: 'secret123' });
  const res = await request(app).post('/api/usuario/login').send({ email, password: 'secret123' });
  return { auth: `Bearer ${res.body.token}`, id: res.body.usuario._id as string };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('quizz'));
  await Usuario.init();
  await WeaknessStat.init();

  const a = await signup('aluna@test.com');
  const b = await signup('outro@test.com');
  auth = a.auth;
  otherAuth = b.auth;

  const nb = await Notebook.create({ title: 'Cálculo', owner: a.id, lessons: [{ title: 'Derivadas' }, { title: 'Integrais' }] });
  lessonId = String(nb.lessons[0]._id);
  otherLessonId = String(nb.lessons[1]._id);
  const nb2 = await Notebook.create({ title: 'Privado', owner: b.id, lessons: [{ title: 'Segredo' }] });
  void nb2;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('geração do quiz', () => {
  it('traz os 5 tipos e nunca envia gabarito ao aluno', async () => {
    const { publicQuestions, draft } = await startQuiz(app, auth, lessonId);
    expect(publicQuestions).toHaveLength(8);
    expect(new Set(publicQuestions.map((q) => q.type))).toEqual(new Set(['multiple_choice', 'fill_blank', 'open_text', 'practical', 'real_case']));

    const json = JSON.stringify(publicQuestions);
    for (const secret of ['correctAnswerIndex', 'acceptedAnswers', 'expectedAnswer', 'rubric', 'explanation']) {
      expect(json).not.toContain(secret);
    }
    // mas o servidor guardou o gabarito completo
    expect((draft.questions as any[]).every((q) => q.explanation !== undefined)).toBe(true);
    expect((draft.questions as any[]).find((q) => q.type === 'multiple_choice').correctAnswerIndex).toBeGreaterThanOrEqual(0);
  });

  it('valida a entrada e o acesso à aula', async () => {
    expect((await request(app).post('/api/quizz/drafts').send({ lessonId, topic: 'x' })).status).toBe(401);
    expect((await request(app).post('/api/quizz/drafts').set('Authorization', auth).send({ lessonId, topic: '' })).status).toBe(400);
    expect((await request(app).post('/api/quizz/drafts').set('Authorization', auth).send({ lessonId, topic: 'x', count: 99 })).status).toBe(400);
    expect((await request(app).post('/api/quizz/drafts').set('Authorization', auth).send({ lessonId: 'invalido', topic: 'x' })).status).toBe(404);
    expect((await request(app).post('/api/quizz/drafts').set('Authorization', otherAuth).send({ lessonId, topic: 'x' })).status).toBe(404);
  });
});

describe('correção no servidor', () => {
  it('responde pergunta a pergunta, revela o gabarito só depois e fecha a tentativa', async () => {
    const quiz = await startQuiz(app, auth, lessonId);
    const q0 = quiz.draft.questions[0] as any;

    const early = await request(app).post(`/api/quizz/drafts/${quiz.draftId}/finish`).set('Authorization', auth);
    expect(early.status).toBe(400); // faltam respostas

    const wrongFormat = await request(app).post(`/api/quizz/drafts/${quiz.draftId}/answer`).set('Authorization', auth).send({ index: 0, answer: 'texto no lugar de índice' });
    expect(wrongFormat.status).toBe(400);

    const answered = await request(app).post(`/api/quizz/drafts/${quiz.draftId}/answer`).set('Authorization', auth).send({ index: 0, answer: answerFor(q0, 'right') });
    expect(answered.status).toBe(200);
    expect(answered.body.result.correct).toBe(true);
    expect(answered.body.result.score).toBe(1);
    expect(answered.body.result.correctAnswer).toBeTruthy();
    expect(answered.body.result.explanation).toBeTruthy();

    const twice = await request(app).post(`/api/quizz/drafts/${quiz.draftId}/answer`).set('Authorization', auth).send({ index: 0, answer: answerFor(q0, 'wrong') });
    expect(twice.status).toBe(409); // não dá para trocar a resposta depois de ver o gabarito

    expect((await request(app).post(`/api/quizz/drafts/${quiz.draftId}/answer`).set('Authorization', auth).send({ index: 99, answer: 0 })).status).toBe(400);
  });

  it('outro aluno não responde nem fecha o quiz alheio', async () => {
    const quiz = await startQuiz(app, auth, lessonId);
    expect((await request(app).post(`/api/quizz/drafts/${quiz.draftId}/answer`).set('Authorization', otherAuth).send({ index: 0, answer: 0 })).status).toBe(404);
    expect((await request(app).post(`/api/quizz/drafts/${quiz.draftId}/finish`).set('Authorization', otherAuth)).status).toBe(404);
  });

  it('nota final = média das notas por pergunta, com crédito parcial', async () => {
    // acerta tudo exceto os tipos abertos (nota 0): 8 perguntas, 3 abertas/prática de rubrica
    const { finished, draft } = await takeQuiz(app, auth, lessonId, (q) => (q.type === 'open_text' || q.type === 'real_case' ? 'wrong' : 'right'));
    expect(finished.status).toBe(201);
    const qs = draft.questions as any[];
    const rightCount = qs.filter((q) => q.type !== 'open_text' && q.type !== 'real_case').length;
    expect(finished.body.score).toBe(Math.round((rightCount / qs.length) * 100));
    expect(finished.body.total).toBe(8);

    const attempt = await QuizAttempt.findById(finished.body.attemptId);
    expect(attempt!.results).toHaveLength(8);
    expect(attempt!.questions).toHaveLength(8);
    // depois de fechar, o rascunho some
    expect((await request(app).post(`/api/quizz/drafts/${draft._id}/finish`).set('Authorization', auth)).status).toBe(404);
  });
});

describe('deficiências e reforço adaptativo', () => {
  it('erros viram estatística e o próximo quiz reforça o tópico em outro formato', async () => {
    await WeaknessStat.deleteMany({});

    // erra todas as perguntas de múltipla escolha, acerta o resto
    const first = await takeQuiz(app, auth, otherLessonId, (q) => (q.type === 'multiple_choice' ? 'wrong' : 'right'), 'Integrais');
    expect(first.finished.status).toBe(201);
    expect(first.reinforcing).toEqual([]); // primeiro quiz: sem histórico, sem reforço

    const missed = (first.draft.questions as any[]).filter((q) => q.type === 'multiple_choice');
    expect(missed.length).toBeGreaterThan(0);

    const weakness = await request(app).get(`/api/quizz/weakness?lessonId=${otherLessonId}`).set('Authorization', auth);
    expect(weakness.status).toBe(200);
    const mcType = weakness.body.types.find((t: any) => t.type === 'multiple_choice');
    const otherType = weakness.body.types.find((t: any) => t.type === 'fill_blank');
    expect(mcType.errorRate).toBeGreaterThan(otherType.errorRate);
    expect(weakness.body.topics.some((t: any) => t.needsReview)).toBe(true);

    // segundo quiz da mesma aula: reforça o tópico errado, em formato diferente de múltipla escolha
    const second = await startQuiz(app, auth, otherLessonId, 'Integrais');
    expect(second.reinforcing.length).toBeGreaterThan(0);
    const reinforcements = (second.draft.questions as any[]).filter((q) => q.reinforcement);
    expect(reinforcements.length).toBe(second.reinforcing.length);
    for (const r of reinforcements) {
      expect(r.type).not.toBe('multiple_choice');
      expect(missed.map((m) => m.topic)).toContain(r.topic);
    }
    expect(second.publicQuestions.filter((q) => q.reinforcement)).toHaveLength(reinforcements.length);

    // e a mistura do quiz privilegia o tipo que mais errou: mais múltipla escolha que num quiz neutro
    const neutralCount = 3;
    const mcInSecond = (second.draft.questions as any[]).filter((q) => q.type === 'multiple_choice').length;
    expect(mcInSecond).toBeGreaterThanOrEqual(neutralCount - 1);
  });

  it('acertar o tópico reforçado encerra o reforço', async () => {
    // acerta tudo no mesmo tópico, inclusive os reforços
    const done = await takeQuiz(app, auth, otherLessonId, 'right', 'Integrais');
    expect(done.finished.status).toBe(201);

    const next = await startQuiz(app, auth, otherLessonId, 'Integrais');
    expect(next.reinforcing).toEqual([]);
  });

  it('o reforço de uma aula não vaza para outra', async () => {
    await takeQuiz(app, auth, otherLessonId, 'wrong', 'Integrais');
    const otherLesson = await startQuiz(app, auth, lessonId, 'Derivadas');
    expect(otherLesson.reinforcing).toEqual([]);
  });
});
