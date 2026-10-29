import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import Usuario from '../src/models/Usuario';
import StudySession from '../src/models/StudySession';
import { buildStudentDashboard, streakDays } from '../src/study/dashboard';
import { localDay } from '../src/study/dates';
import { takeQuiz } from './helpers';

const now = new Date('2026-03-10T15:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400_000);

describe('sequência de dias', () => {
  const day = (n: number) => localDay(daysAgo(n), 0);
  it('conta os dias seguidos até hoje', () => {
    expect(streakDays(new Set([day(0), day(1), day(2), day(4)]), now, 0)).toBe(3);
  });
  it('se hoje ainda não teve atividade, conta a partir de ontem', () => {
    expect(streakDays(new Set([day(1), day(2)]), now, 0)).toBe(2);
  });
  it('quebra no primeiro dia sem atividade e zera sem nada', () => {
    expect(streakDays(new Set([day(3), day(4)]), now, 0)).toBe(0);
    expect(streakDays(new Set(), now, 0)).toBe(0);
  });
});

describe('cálculo do dashboard do aluno', () => {
  const week = { days: [], totalMinutes: 90, goalMinutes: 300, byKind: {}, bySubject: [] };
  const base = {
    now, tzOffset: 0, range: 30, weaknesses: [], tasks: { submitted: 2, pending: 1 }, flashcards: { due: 4, learned: 7 }, week, activeDays: new Set<string>(),
    notebooks: new Map([['nb1', { title: 'Cálculo', lessons: new Map([['l1', 'Derivadas'], ['l2', 'Integrais']]) }], ['nb2', { title: 'Física', lessons: new Map([['l3', 'Cinemática']]) }]]),
  };
  const attempt = (notebook: string, lesson: string, score: number, ago: number, types: string[], scores: number[]) => ({ notebook, lesson, score, createdAt: daysAgo(ago), types, scores });

  it('sem tentativas: média nula e listas vazias', () => {
    const d = buildStudentDashboard({ ...base, attempts: [] });
    expect(d.kpis).toMatchObject({ average: null, attempts: 0, tasksSubmitted: 2, tasksPending: 1, flashcardsDue: 4, flashcardsLearned: 7, studyMinutesWeek: 90, goalMinutes: 300 });
    expect(d.timeline).toEqual([]);
    expect(d.subjects).toEqual([]);
    expect(d.byType.every((t) => t.accuracy === null && t.answered === 0)).toBe(true);
  });

  it('agrega por dia, matéria, aula e tipo de pergunta', () => {
    const d = buildStudentDashboard({
      ...base,
      attempts: [
        attempt('nb1', 'l1', 40, 5, ['multiple_choice', 'open_text'], [1, 0]),
        attempt('nb1', 'l1', 80, 5, ['multiple_choice', 'open_text'], [1, 0.5]),
        attempt('nb1', 'l2', 90, 1, ['fill_blank'], [0.9]),
        attempt('nb2', 'l3', 50, 0, ['practical', 'multiple_choice'], [0, 1]),
      ],
    });
    expect(d.kpis.average).toBe(65);
    expect(d.kpis.attempts).toBe(4);
    expect(d.timeline).toEqual([
      { date: '2026-03-05', average: 60, attempts: 2 },
      { date: '2026-03-09', average: 90, attempts: 1 },
      { date: '2026-03-10', average: 50, attempts: 1 },
    ]);
    expect(d.subjects.map((s) => [s.title, s.average, s.attempts])).toEqual([['Cálculo', 70, 3], ['Física', 50, 1]]);
    // aulas da matéria, da mais fraca para a mais forte
    expect(d.subjects[0].lessons.map((l) => [l.title, l.average])).toEqual([['Derivadas', 60], ['Integrais', 90]]);
    const type = (t: string) => d.byType.find((x) => x.type === t)!;
    expect(type('multiple_choice')).toMatchObject({ answered: 3, accuracy: 100 });
    expect(type('open_text')).toMatchObject({ answered: 2, accuracy: 25 });
    expect(type('fill_blank')).toMatchObject({ answered: 1, accuracy: 90 });
    expect(type('practical')).toMatchObject({ answered: 1, accuracy: 0 });
    expect(type('real_case')).toMatchObject({ answered: 0, accuracy: null });
  });

  it('só os 8 pontos fracos mais fortes e a taxa em %', () => {
    const weaknesses = Array.from({ length: 10 }, (_, i) => ({ lessonId: 'l1', lessonTitle: 'Derivadas', notebookTitle: 'Cálculo', topic: `T${i}`, rate: 0.9 - i * 0.05 }));
    const d = buildStudentDashboard({ ...base, attempts: [], weaknesses });
    expect(d.weakTopics).toHaveLength(8);
    expect(d.weakTopics[0]).toMatchObject({ topic: 'T0', errorRate: 90, lesson: 'Derivadas', notebook: 'Cálculo' });
  });

  it('a sequência usa os dias ativos informados', () => {
    const d = buildStudentDashboard({ ...base, attempts: [], activeDays: new Set(['2026-03-10', '2026-03-09']) });
    expect(d.kpis.streakDays).toBe(2);
  });
});

describe('dashboards pela API', () => {
  let mongod: MongoMemoryServer;
  const app = createApp();
  let teacher: string, teacher2: string, ana: string, bia: string, outsider: string;
  let turmaId: string, notebookId: string, lessonId: string, anaLessonId: string, anaNotebookId: string;

  async function signup(email: string, extra: Record<string, unknown> = {}) {
    await request(app).post('/api/usuario/register').send({ name: email.split('@')[0], email, password: 'secret123', ...extra });
    const res = await request(app).post('/api/usuario/login').send({ email, password: 'secret123' });
    return `Bearer ${res.body.token}`;
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri('dash'));
    await Usuario.init();
    teacher = await signup('prof@d.com', { role: 'teacher', inviteCode: 'invite-123' });
    teacher2 = await signup('prof2@d.com', { role: 'teacher', inviteCode: 'invite-123' });
    ana = await signup('ana@d.com');
    bia = await signup('bia@d.com');
    outsider = await signup('out@d.com');

    turmaId = (await request(app).post('/api/turmas').set('Authorization', teacher).send({ name: '3A' })).body._id;
    await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: 'ana@d.com, bia@d.com' });
    notebookId = (await request(app).post('/api/notebooks').set('Authorization', teacher).send({ title: 'Cálculo', turma: turmaId })).body._id;
    lessonId = (await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', teacher).send({ title: 'Derivadas' })).body.lessons[0]._id;
    const nb = await request(app).post('/api/notebooks').set('Authorization', ana).send({ title: 'Física' });
    anaNotebookId = nb.body._id;
    anaLessonId = (await request(app).post(`/api/notebooks/${anaNotebookId}/lessons`).set('Authorization', ana).send({ title: 'Cinemática' })).body.lessons[0]._id;

    await takeQuiz(app, ana, lessonId, 'wrong', 'Derivadas');
    await takeQuiz(app, ana, lessonId, (_q, i) => (i % 2 ? 'right' : 'wrong'), 'Derivadas');
    await takeQuiz(app, ana, anaLessonId, 'right', 'Cinemática');
    await takeQuiz(app, bia, lessonId, 'right', 'Derivadas');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe('aluno', () => {
    it('exige login e papel de aluno', async () => {
      expect((await request(app).get('/api/dashboard/student')).status).toBe(401);
      expect((await request(app).get('/api/dashboard/student').set('Authorization', teacher)).status).toBe(403);
    });

    it('resume o desempenho da Ana, com pontos fracos e tempo de estudo', async () => {
      await request(app).post('/api/study/sessions').set('Authorization', ana).send({ kind: 'quiz', seconds: 25 * 60, lessonId, tzOffset: 0 });
      const res = await request(app).get('/api/dashboard/student').query({ range: 30, tzOffset: 0 }).set('Authorization', ana);
      expect(res.status).toBe(200);
      expect(res.body.range).toBe(30);
      expect(res.body.kpis.attempts).toBe(3);
      expect(res.body.kpis.average).toBeGreaterThan(0);
      expect(res.body.kpis.studyMinutesWeek).toBe(25);
      expect(res.body.kpis.streakDays).toBe(1);
      expect(res.body.subjects.map((s: any) => s.title).sort()).toEqual(['Cálculo', 'Física']);
      expect(res.body.byType).toHaveLength(5);
      expect(res.body.byType.some((t: any) => t.accuracy !== null)).toBe(true);
      expect(res.body.timeline).toHaveLength(1);
      expect(res.body.weakTopics.length).toBeGreaterThan(0);
      expect(res.body.weakTopics[0]).toMatchObject({ notebook: 'Cálculo', lesson: 'Derivadas' });
      expect(res.body.study.days).toHaveLength(7);
    });

    it('filtra por matéria e rejeita matéria sem acesso', async () => {
      const fisica = await request(app).get('/api/dashboard/student').query({ notebook: anaNotebookId }).set('Authorization', ana);
      expect(fisica.body.subjects.map((s: any) => s.title)).toEqual(['Física']);
      expect(fisica.body.kpis.attempts).toBe(1);
      expect(fisica.body.weakTopics).toEqual([]);
      expect((await request(app).get('/api/dashboard/student').query({ notebook: anaNotebookId }).set('Authorization', bia)).status).toBe(404);
    });

    it('período inválido cai em 30 dias; aluno sem dados recebe painel vazio', async () => {
      expect((await request(app).get('/api/dashboard/student').query({ range: 5 }).set('Authorization', ana)).body.range).toBe(30);
      const empty = await request(app).get('/api/dashboard/student').set('Authorization', outsider);
      expect(empty.body.kpis).toMatchObject({ average: null, attempts: 0, streakDays: 0 });
      expect(empty.body.subjects).toEqual([]);
    });

    it('o período exclui tentativas antigas', async () => {
      const { default: QuizAttempt } = await import('../src/models/QuizAttempt');
      // createdAt é imutável no Mongoose: recuamos a data direto no driver
      await QuizAttempt.collection.updateMany({ user: (await Usuario.findOne({ email: 'bia@d.com' }))!._id }, { $set: { createdAt: new Date(Date.now() - 20 * 86400_000) } });
      expect((await request(app).get('/api/dashboard/student').query({ range: 7 }).set('Authorization', bia)).body.kpis.attempts).toBe(0);
      expect((await request(app).get('/api/dashboard/student').query({ range: 30 }).set('Authorization', bia)).body.kpis.attempts).toBe(1);
    });
  });

  describe('professor', () => {
    it('só professor, e só da própria turma', async () => {
      expect((await request(app).get('/api/results/overview').set('Authorization', ana)).status).toBe(403);
      expect((await request(app).get(`/api/results/turmas/${turmaId}/timeline`).set('Authorization', teacher2)).status).toBe(404);
      expect((await request(app).get(`/api/results/turmas/${turmaId}/weakness`).set('Authorization', teacher2)).status).toBe(404);
      expect((await request(app).get('/api/results/turmas/invalido/weakness').set('Authorization', teacher)).status).toBe(404);
    });

    it('visão geral por turma', async () => {
      const res = await request(app).get('/api/results/overview').set('Authorization', teacher);
      expect(res.status).toBe(200);
      expect(res.body.turmas).toHaveLength(1);
      expect(res.body.turmas[0]).toMatchObject({ name: '3A', students: 2, attempts: 3, tasksPublished: 0, deliveryRate: null });
      expect(res.body.turmas[0].average).toBeGreaterThan(0);
      expect(res.body.turmas[0].activeStudents).toBe(1); // a Bia tem tentativa antiga
      expect((await request(app).get('/api/results/overview').set('Authorization', teacher2)).body.turmas).toEqual([]);
    });

    it('evolução diária da turma', async () => {
      const res = await request(app).get(`/api/results/turmas/${turmaId}/timeline`).query({ range: 30, tzOffset: 0 }).set('Authorization', teacher);
      expect(res.status).toBe(200);
      expect(res.body.range).toBe(30);
      expect(res.body.days.reduce((s: number, d: any) => s + d.attempts, 0)).toBe(3);
      const today = res.body.days.at(-1);
      expect(today).toMatchObject({ attempts: 2, students: 1 });
      expect(res.body.days[0].students).toBe(1);
    });

    it('onde a turma mais erra, por tópico e por tipo', async () => {
      const res = await request(app).get(`/api/results/turmas/${turmaId}/weakness`).set('Authorization', teacher);
      expect(res.status).toBe(200);
      expect(res.body.studentsTotal).toBe(2);
      expect(res.body.topics.length).toBeGreaterThan(0);
      expect(res.body.topics[0]).toMatchObject({ lesson: 'Cálculo · Derivadas' });
      expect(res.body.topics[0].errorRate).toBeGreaterThan(30);
      expect(res.body.topics[0].students).toBeGreaterThanOrEqual(1);
      expect(res.body.byType).toHaveLength(5);
      expect(res.body.byType.some((t: any) => t.accuracy !== null && t.accuracy < 100)).toBe(true);
    });

    it('o professor não vê o caderno particular do aluno (a Física da Ana fica de fora)', async () => {
      const res = await request(app).get(`/api/results/turmas/${turmaId}/weakness`).set('Authorization', teacher);
      expect(res.body.topics.every((t: any) => t.lesson.startsWith('Cálculo'))).toBe(true);
      await StudySession.deleteMany({});
    });
  });
});
