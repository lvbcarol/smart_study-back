import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import Usuario from '../src/models/Usuario';
import StudySession from '../src/models/StudySession';
import { localDay } from '../src/study/dates';
import { takeQuiz } from './helpers';

let mongod: MongoMemoryServer;
const app = createApp();

let teacher: string, ana: string, bia: string, outsider: string;
let turmaId: string, notebookId: string, lessonId: string, anaLessonId: string, taskId: string;

async function signup(email: string, extra: Record<string, unknown> = {}) {
  await request(app).post('/api/usuario/register').send({ name: email.split('@')[0], email, password: 'secret123', ...extra });
  const res = await request(app).post('/api/usuario/login').send({ email, password: 'secret123' });
  return `Bearer ${res.body.token}`;
}

const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * 3600_000).toISOString();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('agenda'));
  await Usuario.init();
  await StudySession.init();
  teacher = await signup('prof@a.com', { role: 'teacher', inviteCode: 'invite-123' });
  ana = await signup('ana@a.com');
  bia = await signup('bia@a.com');
  outsider = await signup('out@a.com');

  turmaId = (await request(app).post('/api/turmas').set('Authorization', teacher).send({ name: '3A' })).body._id;
  await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: 'ana@a.com, bia@a.com' });
  notebookId = (await request(app).post('/api/notebooks').set('Authorization', teacher).send({ title: 'Cálculo', turma: turmaId })).body._id;
  lessonId = (await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', teacher).send({ title: 'Derivadas' })).body.lessons[0]._id;
  const nb = await request(app).post('/api/notebooks').set('Authorization', ana).send({ title: 'Física' });
  anaLessonId = (await request(app).post(`/api/notebooks/${nb.body._id}/lessons`).set('Authorization', ana).send({ title: 'Cinemática' })).body.lessons[0]._id;

  const gen = await request(app).post('/api/tasks/generate').set('Authorization', teacher).send({ notebookId, lessonId, topic: 'Derivadas', language: 'pt-BR', count: 4 });
  const created = await request(app).post('/api/tasks').set('Authorization', teacher).send({
    notebookId, lessonId, title: 'Lista de derivadas', dueDate: iso(20), questions: gen.body.questions,
  });
  taskId = created.body._id;
  await request(app).put(`/api/tasks/${taskId}`).set('Authorization', teacher).send({ published: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('agenda', () => {
  let reminderId: string;

  it('é só para alunos e exige login', async () => {
    expect((await request(app).get('/api/agenda')).status).toBe(401);
    expect((await request(app).get('/api/agenda').set('Authorization', teacher)).status).toBe(403);
    expect((await request(app).post('/api/agenda').set('Authorization', teacher).send({ kind: 'task', title: 'x' })).status).toBe(403);
  });

  it('valida os campos', async () => {
    const post = (b: object) => request(app).post('/api/agenda').set('Authorization', ana).send(b);
    expect((await post({ kind: 'task', title: '' })).status).toBe(400);
    expect((await post({ kind: 'outro', title: 'x' })).status).toBe(400);
    expect((await post({ kind: 'reminder', title: 'Sem data' })).status).toBe(400);
    expect((await post({ kind: 'task', title: 'x', dueAt: 'amanhã' })).status).toBe(400);
    expect((await post({ kind: 'task', title: 'x'.repeat(121) })).status).toBe(400);
  });

  it('cria tarefa e lembrete pessoais e mistura com a tarefa do professor, em ordem de data', async () => {
    const personalTask = await request(app).post('/api/agenda').set('Authorization', ana).send({ kind: 'task', title: 'Ler capítulo 3', notes: 'páginas 40–60', dueAt: iso(48) });
    expect(personalTask.status).toBe(201);
    expect(personalTask.body).toMatchObject({ source: 'personal', kind: 'task', title: 'Ler capítulo 3', done: false });
    const reminder = await request(app).post('/api/agenda').set('Authorization', ana).send({ kind: 'reminder', title: 'Levar calculadora', dueAt: iso(5) });
    reminderId = reminder.body.id;
    await request(app).post('/api/agenda').set('Authorization', ana).send({ kind: 'task', title: 'Sem data ainda' });

    const list = await request(app).get('/api/agenda').set('Authorization', ana);
    const titles = list.body.items.map((i: any) => i.title);
    expect(titles).toEqual(['Levar calculadora', 'Lista de derivadas', 'Ler capítulo 3', 'Sem data ainda']);
    expect(list.body.items[1]).toMatchObject({ source: 'teacher', status: 'pending', done: false, notebookTitle: 'Cálculo', lessonTitle: 'Derivadas' });
  });

  it('filtra por período (itens sem data aparecem sempre)', async () => {
    const week = await request(app).get('/api/agenda').query({ from: iso(0), to: iso(10) }).set('Authorization', ana);
    expect(week.body.items.map((i: any) => i.title)).toEqual(['Levar calculadora', 'Sem data ainda']);
    expect((await request(app).get('/api/agenda').query({ from: 'ontem' }).set('Authorization', ana)).status).toBe(400);
  });

  it('cada aluno só vê e mexe nos próprios itens', async () => {
    const biaList = await request(app).get('/api/agenda').set('Authorization', bia);
    expect(biaList.body.items.map((i: any) => i.title)).toEqual(['Lista de derivadas']); // só a tarefa da turma
    expect((await request(app).put(`/api/agenda/${reminderId}`).set('Authorization', bia).send({ done: true })).status).toBe(404);
    expect((await request(app).delete(`/api/agenda/${reminderId}`).set('Authorization', bia)).status).toBe(404);
    expect((await request(app).get('/api/agenda').set('Authorization', outsider)).body.items).toEqual([]); // avulso sem nada
    expect((await request(app).put('/api/agenda/invalido').set('Authorization', ana).send({ done: true })).status).toBe(404);
  });

  it('edita, conclui e apaga', async () => {
    const edited = await request(app).put(`/api/agenda/${reminderId}`).set('Authorization', ana).send({ title: 'Levar a calculadora científica', done: true });
    expect(edited.body).toMatchObject({ title: 'Levar a calculadora científica', done: true });
    expect((await request(app).put(`/api/agenda/${reminderId}`).set('Authorization', ana).send({ dueAt: null })).status).toBe(400); // lembrete sem data
    const list = await request(app).get('/api/agenda').query({ from: iso(0), to: iso(10) }).set('Authorization', ana);
    expect(list.body.items.find((i: any) => i.id === reminderId)).toMatchObject({ done: true });
    expect((await request(app).put(`/api/agenda/${reminderId}`).set('Authorization', ana).send({ done: false })).body.done).toBe(false);
    expect((await request(app).delete(`/api/agenda/${reminderId}`).set('Authorization', ana)).status).toBe(204);
    expect((await request(app).delete(`/api/agenda/${reminderId}`).set('Authorization', ana)).status).toBe(404);
  });

  it('item sem data concluído continua na lista (dá para desfazer)', async () => {
    const items = (await request(app).get('/api/agenda').set('Authorization', ana)).body.items;
    const undated = items.find((i: any) => i.title === 'Sem data ainda');
    await request(app).put(`/api/agenda/${undated.id}`).set('Authorization', ana).send({ done: true });
    const after = (await request(app).get('/api/agenda').set('Authorization', ana)).body.items;
    expect(after.find((i: any) => i.id === undated.id)).toMatchObject({ done: true });
  });

  it('a tarefa do professor aparece como feita depois de entregue', async () => {
    const start = await request(app).post(`/api/tasks/${taskId}/start`).set('Authorization', ana).send({ language: 'pt-BR' });
    expect(start.status).toBe(200);
    const items = (await request(app).get('/api/agenda').set('Authorization', ana)).body.items;
    expect(items.find((i: any) => i.source === 'teacher').status).toBe('pending');
  });
});

describe('tempo de estudo', () => {
  const post = (auth: string, body: object) => request(app).post('/api/study/sessions').set('Authorization', auth).send(body);

  it('valida o registro de sessões', async () => {
    expect((await request(app).post('/api/study/sessions').send({ kind: 'quiz', seconds: 60 })).status).toBe(401);
    expect((await post(teacher, { kind: 'manual', seconds: 60 })).status).toBe(403);
    expect((await post(ana, { kind: 'dormir', seconds: 60 })).status).toBe(400);
    expect((await post(ana, { kind: 'manual', seconds: 0 })).status).toBe(400);
    expect((await post(ana, { kind: 'manual', seconds: 4 * 3600 + 1 })).status).toBe(400);
    expect((await post(ana, { kind: 'manual', seconds: 60, startedAt: iso(2) })).status).toBe(400); // no futuro
    expect((await post(ana, { kind: 'manual', seconds: 60, startedAt: iso(-48) })).status).toBe(400); // antiga demais
  });

  it('registra por aula (própria ou da turma), ignora aula sem acesso', async () => {
    expect((await post(ana, { kind: 'summary', seconds: 600, lessonId: anaLessonId })).status).toBe(201);
    expect((await post(ana, { kind: 'quiz', seconds: 60, lessonId })).status).toBe(201); // aula do professor, da turma dela
    expect((await post(outsider, { kind: 'quiz', seconds: 60, lessonId })).status).toBe(404); // fora da turma
    expect((await post(outsider, { kind: 'summary', seconds: 600, lessonId: anaLessonId })).status).toBe(404); // caderno da Ana
    expect((await post(outsider, { kind: 'summary', seconds: 600, lessonId: 'invalido' })).status).toBe(404);
  });

  it('soma por dia, atividade e matéria nos últimos 7 dias e mostra a meta', async () => {
    await post(bia, { kind: 'manual', seconds: 30 * 60 });
    await post(bia, { kind: 'flashcards', seconds: 15 * 60 });
    await post(bia, { kind: 'task', seconds: 20 * 60, lessonId });
    const old = new Date(Date.now() - 10 * 86400_000);
    await StudySession.create({ user: (await Usuario.findOne({ email: 'bia@a.com' }))!._id, kind: 'manual', startedAt: old, seconds: 3600, day: localDay(old, 0) });

    expect((await request(app).put('/api/usuario/me').set('Authorization', bia).send({ weeklyGoalMinutes: 300 })).body.weeklyGoalMinutes).toBe(300);
    expect((await request(app).put('/api/usuario/me').set('Authorization', bia).send({ weeklyGoalMinutes: -5 })).status).toBe(400);
    expect((await request(app).put('/api/usuario/me').set('Authorization', bia).send({ weeklyGoalMinutes: 7000 })).status).toBe(400);

    const week = await request(app).get('/api/study/week').query({ tzOffset: 0 }).set('Authorization', bia);
    expect(week.status).toBe(200);
    expect(week.body.days).toHaveLength(7);
    expect(week.body.totalMinutes).toBe(65); // a sessão de 10 dias atrás não conta
    expect(week.body.goalMinutes).toBe(300);
    expect(week.body.byKind).toMatchObject({ manual: 30, flashcards: 15, task: 20 });
    expect(week.body.bySubject).toEqual([{ notebookId, title: 'Cálculo', minutes: 20 }]);
    expect(week.body.days.at(-1).minutes).toBe(65);
  });

  it('um aluno não vê o tempo do outro', async () => {
    const week = await request(app).get('/api/study/week').set('Authorization', outsider);
    expect(week.body.totalMinutes).toBe(0);
    expect(week.body.goalMinutes).toBe(0);
  });
});

describe('plano de estudo do dia', () => {
  let blockId: string;

  it('valida o tempo', async () => {
    const post = (b: object) => request(app).post('/api/study/plan').set('Authorization', ana).send(b);
    expect((await post({ minutes: 2 })).status).toBe(400);
    expect((await post({ minutes: 999 })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await request(app).post('/api/study/plan').set('Authorization', teacher).send({ minutes: 30 })).status).toBe(403);
  });

  it('ainda não há plano hoje', async () => {
    expect((await request(app).get('/api/study/plan').set('Authorization', ana)).body.plan).toBeNull();
  });

  it('monta o plano com a tarefa do professor, a agenda e os pontos fracos, e explica cada bloco', async () => {
    await request(app).post('/api/agenda').set('Authorization', ana).send({ kind: 'task', title: 'Resolver exercícios', dueAt: iso(10) });
    await takeQuiz(app, ana, anaLessonId, 'wrong', 'Cinemática'); // gera pontos fracos na aula da Ana

    const res = await request(app).post('/api/study/plan').set('Authorization', ana).send({ minutes: 60, language: 'pt-BR', tzOffset: 180 });
    expect(res.status).toBe(201);
    const { plan } = res.body;
    expect(plan.minutes).toBe(60);
    expect(plan.intro).toContain('60 minutos');
    const kinds = plan.blocks.map((b: any) => b.kind);
    expect(kinds).toContain('task');
    expect(kinds).toContain('agenda');
    expect(kinds).toContain('weakness');
    expect(plan.blocks.reduce((s: number, b: any) => s + b.minutes, 0)).toBeLessThanOrEqual(60);
    expect(plan.blocks.every((b: any) => b.reason && !b.done)).toBe(true);
    expect(plan.blocks.find((b: any) => b.kind === 'task').link).toEqual({ type: 'task', id: taskId });
    const weak = plan.blocks.find((b: any) => b.kind === 'weakness');
    expect(weak.link).toEqual({ type: 'quiz', id: anaLessonId });
    blockId = plan.blocks[0].id;
  });

  it('refazer o plano no mesmo dia substitui o anterior; GET devolve o de hoje', async () => {
    const again = await request(app).post('/api/study/plan').set('Authorization', ana).send({ minutes: 15, tzOffset: 180 });
    expect(again.status).toBe(201);
    expect(again.body.plan.minutes).toBe(15);
    expect(again.body.plan.blocks.reduce((s: number, b: any) => s + b.minutes, 0)).toBeLessThanOrEqual(15);
    const today = await request(app).get('/api/study/plan').query({ tzOffset: 180 }).set('Authorization', ana);
    expect(today.body.plan.minutes).toBe(15);
    blockId = today.body.plan.blocks[0].id;
  });

  it('marca e desmarca blocos, só do próprio plano', async () => {
    const done = await request(app).put(`/api/study/plan/blocks/${encodeURIComponent(blockId)}`).set('Authorization', ana).send({ done: true, tzOffset: 180 });
    expect(done.status).toBe(200);
    expect(done.body.plan.blocks.find((b: any) => b.id === blockId).done).toBe(true);
    expect((await request(app).put(`/api/study/plan/blocks/${encodeURIComponent(blockId)}`).set('Authorization', bia).send({ done: true, tzOffset: 180 })).status).toBe(404);
    expect((await request(app).put('/api/study/plan/blocks/nao-existe').set('Authorization', ana).send({ done: true, tzOffset: 180 })).status).toBe(404);
    expect((await request(app).put(`/api/study/plan/blocks/${encodeURIComponent(blockId)}`).set('Authorization', ana).send({ done: 'sim' })).status).toBe(400);
    const undone = await request(app).put(`/api/study/plan/blocks/${encodeURIComponent(blockId)}`).set('Authorization', ana).send({ done: false, tzOffset: 180 });
    expect(undone.body.plan.blocks.find((b: any) => b.id === blockId).done).toBe(false);
  });

  it('aluno sem nada recebe um plano vazio com orientação (e o avulso com caderno recebe sugestão de revisão)', async () => {
    const empty = await request(app).post('/api/study/plan').set('Authorization', outsider).send({ minutes: 30, language: 'pt-BR' });
    expect(empty.body.plan.blocks).toEqual([]);
    expect(empty.body.plan.intro).toContain('Ainda não há');

    const nb = await request(app).post('/api/notebooks').set('Authorization', outsider).send({ title: 'Inglês' });
    await request(app).post(`/api/notebooks/${nb.body._id}/lessons`).set('Authorization', outsider).send({ title: 'Present Simple' });
    const free = await request(app).post('/api/study/plan').set('Authorization', outsider).send({ minutes: 30, language: 'en-US' });
    expect(free.body.plan.blocks).toHaveLength(1);
    expect(free.body.plan.blocks[0]).toMatchObject({ kind: 'explore', title: 'Review Present Simple' });
  });
});
