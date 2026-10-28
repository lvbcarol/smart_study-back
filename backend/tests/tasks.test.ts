import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import Usuario from '../src/models/Usuario';
import Task from '../src/models/Task';
import QuizAttempt from '../src/models/QuizAttempt';
import QuizDraft from '../src/models/QuizDraft';
import { answerFor, takeQuiz } from './helpers';

let mongod: MongoMemoryServer;
const app = createApp();

let teacher: string, teacher2: string, ana: string, bia: string, carla: string, dani: string;
let anaId: string, biaId: string, carlaId: string, daniId: string;
let turmaId: string, notebookId: string, lessonId: string, loneNotebookId: string, loneLessonId: string;
let taskId: string;
let generated: any[];

async function signup(email: string, extra: Record<string, unknown> = {}) {
  await request(app).post('/api/usuario/register').send({ name: email.split('@')[0], email, password: 'secret123', ...extra });
  const res = await request(app).post('/api/usuario/login').send({ email, password: 'secret123' });
  return { auth: `Bearer ${res.body.token}`, id: res.body.usuario._id as string };
}

/** O aluno responde a tarefa inteira (certo/errado por pergunta) lendo o gabarito do banco. */
async function submitTask(auth: string, id: string, mode: 'right' | 'wrong' | ((q: any, i: number) => 'right' | 'wrong')) {
  const start = await request(app).post(`/api/tasks/${id}/start`).set('Authorization', auth).send({ language: 'pt-BR' });
  expect(start.status).toBe(200);
  const task = await Task.findById(id);
  const questions = task!.questions as any[];
  for (let i = start.body.answeredCount; i < questions.length; i++) {
    const m = typeof mode === 'function' ? mode(questions[i], i) : mode;
    const res = await request(app).post(`/api/quizz/drafts/${start.body.draftId}/answer`).set('Authorization', auth).send({ index: i, answer: answerFor(questions[i], m) });
    expect(res.status).toBe(200);
  }
  return request(app).post(`/api/quizz/drafts/${start.body.draftId}/finish`).set('Authorization', auth);
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('tasks'));
  await Usuario.init();
  await QuizAttempt.init();
  await QuizDraft.init();

  teacher = (await signup('prof@k.com', { role: 'teacher', inviteCode: 'invite-123' })).auth;
  teacher2 = (await signup('prof2@k.com', { role: 'teacher', inviteCode: 'invite-123' })).auth;
  ({ auth: ana, id: anaId } = await signup('ana@k.com'));
  ({ auth: bia, id: biaId } = await signup('bia@k.com'));
  ({ auth: carla, id: carlaId } = await signup('carla@k.com'));
  ({ auth: dani, id: daniId } = await signup('dani@k.com'));

  const turma = await request(app).post('/api/turmas').set('Authorization', teacher).send({ name: '3A' });
  turmaId = turma.body._id;
  await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: 'ana@k.com, bia@k.com, dani@k.com' });

  const nb = await request(app).post('/api/notebooks').set('Authorization', teacher).send({ title: 'Cálculo', turma: turmaId });
  notebookId = nb.body._id;
  const withLesson = await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', teacher).send({ title: 'Derivadas' });
  lessonId = withLesson.body.lessons[0]._id;
  loneNotebookId = (await request(app).post('/api/notebooks').set('Authorization', teacher).send({ title: 'Sem turma' })).body._id;
  const loneWithLesson = await request(app).post(`/api/notebooks/${loneNotebookId}/lessons`).set('Authorization', teacher).send({ title: 'Aula' });
  loneLessonId = loneWithLesson.body.lessons[0]._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('geração de perguntas pelo professor', () => {
  const body = () => ({ notebookId, lessonId, topic: 'Derivadas', language: 'pt-BR', count: 6 });

  it('só professor dono da matéria gera, e a matéria precisa ter turma', async () => {
    expect((await request(app).post('/api/tasks/generate').send(body())).status).toBe(401);
    expect((await request(app).post('/api/tasks/generate').set('Authorization', ana).send(body())).status).toBe(403);
    expect((await request(app).post('/api/tasks/generate').set('Authorization', teacher2).send(body())).status).toBe(404);
    expect((await request(app).post('/api/tasks/generate').set('Authorization', teacher).send({ ...body(), notebookId: loneNotebookId, lessonId: loneLessonId })).status).toBe(400);
    expect((await request(app).post('/api/tasks/generate').set('Authorization', teacher).send({ ...body(), lessonId: String(new mongoose.Types.ObjectId()) })).status).toBe(400);
    expect((await request(app).post('/api/tasks/generate').set('Authorization', teacher).send({ ...body(), count: 99 })).status).toBe(400);
  });

  it('devolve perguntas completas (com gabarito) só dos tipos escolhidos', async () => {
    const res = await request(app).post('/api/tasks/generate').set('Authorization', teacher).send({ ...body(), types: ['multiple_choice', 'fill_blank'] });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(6);
    expect(new Set(res.body.questions.map((q: any) => q.type))).toEqual(new Set(['multiple_choice', 'fill_blank']));
    expect(res.body.questions.find((q: any) => q.type === 'multiple_choice').correctAnswerIndex).toBeGreaterThanOrEqual(0);

    const all = await request(app).post('/api/tasks/generate').set('Authorization', teacher).send(body());
    generated = all.body.questions;
    expect(new Set(generated.map((q: any) => q.type)).size).toBeGreaterThanOrEqual(5 - 1);
  });
});

describe('criação e publicação', () => {
  const payload = () => ({ notebookId, lessonId, title: 'Lista de derivadas', description: 'Valendo nota', dueDate: new Date(Date.now() + 7 * 864e5).toISOString(), questions: generated });

  it('valida o conteúdo', async () => {
    expect((await request(app).post('/api/tasks').set('Authorization', teacher).send({ ...payload(), questions: [] })).status).toBe(400);
    expect((await request(app).post('/api/tasks').set('Authorization', teacher).send({ ...payload(), title: '' })).status).toBe(400);
    const badMc = [{ type: 'multiple_choice', topic: 'T', question: 'Pergunta?', options: ['a', 'b'], correctAnswerIndex: 0 }];
    expect((await request(app).post('/api/tasks').set('Authorization', teacher).send({ ...payload(), questions: badMc })).status).toBe(400);
    expect((await request(app).post('/api/tasks').set('Authorization', teacher).send({ ...payload(), notebookId: loneNotebookId, lessonId: loneLessonId })).status).toBe(400); // matéria sem turma
    expect((await request(app).post('/api/tasks').set('Authorization', teacher).send({ ...payload(), notebookId: loneNotebookId })).status).toBe(400); // aula de outra matéria
    expect((await request(app).post('/api/tasks').set('Authorization', teacher2).send(payload())).status).toBe(404);
    expect((await request(app).post('/api/tasks').set('Authorization', ana).send(payload())).status).toBe(403);
  });

  it('nasce como rascunho: o aluno não vê nem acessa', async () => {
    const created = await request(app).post('/api/tasks').set('Authorization', teacher).send(payload());
    expect(created.status).toBe(201);
    taskId = created.body._id;

    expect((await request(app).get('/api/tasks/mine').set('Authorization', ana)).body).toEqual([]);
    expect((await request(app).get(`/api/tasks/${taskId}`).set('Authorization', ana)).status).toBe(404);
    expect((await request(app).post(`/api/tasks/${taskId}/start`).set('Authorization', ana)).status).toBe(404);

    const list = await request(app).get('/api/tasks').set('Authorization', teacher);
    expect(list.body[0]).toMatchObject({ title: 'Lista de derivadas', published: false, submitted: 0, total: 3, turmaName: '3A', lessonTitle: 'Derivadas', questionsCount: generated.length });
  });

  it('publicada, aparece só para alunos da turma', async () => {
    expect((await request(app).put(`/api/tasks/${taskId}`).set('Authorization', teacher2).send({ published: true })).status).toBe(404);
    expect((await request(app).put(`/api/tasks/${taskId}`).set('Authorization', teacher).send({ published: true })).status).toBe(200);

    const mine = await request(app).get('/api/tasks/mine').set('Authorization', ana);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ title: 'Lista de derivadas', status: 'pending', score: null, overdue: false, notebookTitle: 'Cálculo', lessonTitle: 'Derivadas' });

    expect((await request(app).get('/api/tasks/mine').set('Authorization', carla)).body).toEqual([]); // fora da turma
    expect((await request(app).get(`/api/tasks/${taskId}`).set('Authorization', carla)).status).toBe(404);
    expect((await request(app).post(`/api/tasks/${taskId}/start`).set('Authorization', carla)).status).toBe(404);
    expect((await request(app).get('/api/tasks/mine').set('Authorization', teacher)).status).toBe(403);

    // o aluno vê o resumo, nunca as perguntas
    const summary = await request(app).get(`/api/tasks/${taskId}`).set('Authorization', ana);
    expect(summary.body).toMatchObject({ title: 'Lista de derivadas', status: 'pending', questionsCount: generated.length });
    expect(summary.body.questions).toBeUndefined();
  });
});

describe('o aluno resolve a tarefa', () => {
  it('recebe perguntas sem gabarito e não vê correção até enviar', async () => {
    const start = await request(app).post(`/api/tasks/${taskId}/start`).set('Authorization', ana).send({ language: 'pt-BR' });
    expect(start.status).toBe(200);
    expect(start.body.questions).toHaveLength(generated.length);
    expect(start.body.answeredCount).toBe(0);
    const json = JSON.stringify(start.body);
    for (const secret of ['correctAnswerIndex', 'acceptedAnswers', 'expectedAnswer', 'rubric', 'explanation']) expect(json).not.toContain(secret);

    const task = await Task.findById(taskId);
    const answered = await request(app).post(`/api/quizz/drafts/${start.body.draftId}/answer`).set('Authorization', ana).send({ index: 0, answer: answerFor(task!.questions[0], 'right') });
    expect(answered.status).toBe(200);
    expect(answered.body).toEqual({ saved: true }); // sem resultado nem gabarito
  });

  it('pode sair e retomar de onde parou, e não envia pela metade', async () => {
    const again = await request(app).post(`/api/tasks/${taskId}/start`).set('Authorization', ana).send({});
    expect(again.body.answeredCount).toBe(1);
    expect((await request(app).post(`/api/quizz/drafts/${again.body.draftId}/finish`).set('Authorization', ana)).status).toBe(400);
    expect((await request(app).get('/api/tasks/mine').set('Authorization', ana)).body[0].status).toBe('in_progress');
  });

  it('envia uma única vez; vê nota e revisão depois', async () => {
    const finished = await submitTask(ana, taskId, 'right');
    expect(finished.status).toBe(201);
    expect(finished.body).toMatchObject({ score: 100, source: 'task', attemptNumber: 1 });

    expect((await request(app).post(`/api/tasks/${taskId}/start`).set('Authorization', ana)).status).toBe(409);

    const mine = await request(app).get('/api/tasks/mine').set('Authorization', ana);
    expect(mine.body[0]).toMatchObject({ status: 'submitted', score: 100, late: false });
    const summary = await request(app).get(`/api/tasks/${taskId}`).set('Authorization', ana);
    expect(summary.body).toMatchObject({ status: 'submitted', score: 100 });
    expect(summary.body.attemptId).toBeTruthy();

    const review = await request(app).get(`/api/tasks/${taskId}/my-attempt`).set('Authorization', ana);
    expect(review.status).toBe(200);
    expect(review.body.results).toHaveLength(generated.length);
    expect(review.body.questions[0].explanation).toBeDefined(); // depois de enviar, o gabarito é liberado
    expect((await request(app).get(`/api/tasks/${taskId}/my-attempt`).set('Authorization', bia)).status).toBe(404);
  });

  it('a nota da tarefa não bagunça a numeração dos treinos', async () => {
    const practice = await takeQuiz(app, ana, lessonId, 'right');
    expect(practice.finished.body.attemptNumber).toBe(1);
  });

  it('entrega depois do prazo fica marcada como atrasada', async () => {
    await request(app).put(`/api/tasks/${taskId}`).set('Authorization', teacher).send({ dueDate: new Date(Date.now() - 864e5).toISOString() });
    const mine = await request(app).get('/api/tasks/mine').set('Authorization', bia);
    expect(mine.body[0]).toMatchObject({ status: 'pending', overdue: true });

    // bia acerta só a primeira metade
    const finished = await submitTask(bia, taskId, (_q, i) => (i < generated.length / 2 ? 'right' : 'wrong'));
    expect(finished.status).toBe(201);
    expect(finished.body.score).toBeGreaterThan(0);
    expect(finished.body.score).toBeLessThan(100);
    expect((await request(app).get('/api/tasks/mine').set('Authorization', bia)).body[0]).toMatchObject({ status: 'submitted', late: true, overdue: false });
  });
});

describe('edição e acompanhamento do professor', () => {
  it('depois de entregas, as perguntas ficam travadas, mas o resto pode mudar', async () => {
    const locked = await request(app).put(`/api/tasks/${taskId}`).set('Authorization', teacher).send({ questions: generated.slice(0, 2) });
    expect(locked.status).toBe(409);
    expect((await request(app).put(`/api/tasks/${taskId}`).set('Authorization', teacher).send({ title: 'Lista de derivadas (revisada)' })).status).toBe(200);
    const detail = await request(app).get(`/api/tasks/${taskId}`).set('Authorization', teacher);
    expect(detail.body).toMatchObject({ title: 'Lista de derivadas (revisada)', submitted: 2, turmaName: '3A', published: true });
    expect(detail.body.questions[0].explanation).toBeDefined(); // professor vê o gabarito
    expect((await request(app).get(`/api/tasks/${taskId}`).set('Authorization', teacher2)).status).toBe(404);
  });

  it('lista quem entregou, quem está no meio e quem não começou', async () => {
    // dani começa e responde uma pergunta
    const start = await request(app).post(`/api/tasks/${taskId}/start`).set('Authorization', dani).send({});
    const task = await Task.findById(taskId);
    await request(app).post(`/api/quizz/drafts/${start.body.draftId}/answer`).set('Authorization', dani).send({ index: 0, answer: answerFor(task!.questions[0], 'wrong') });

    const subs = await request(app).get(`/api/tasks/${taskId}/submissions`).set('Authorization', teacher);
    const byName = Object.fromEntries(subs.body.map((s: any) => [s.student.name, s]));
    expect(subs.body).toHaveLength(3);
    expect(byName.ana).toMatchObject({ status: 'submitted', score: 100, late: false });
    expect(byName.bia).toMatchObject({ status: 'submitted', late: true });
    expect(byName.dani.status).toBe('in_progress');
    expect((await request(app).get(`/api/tasks/${taskId}/submissions`).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).get(`/api/tasks/${taskId}/submissions`).set('Authorization', ana)).status).toBe(403);

    const list = await request(app).get('/api/tasks').set('Authorization', teacher);
    expect(list.body[0]).toMatchObject({ submitted: 2, total: 3 });
    expect(list.body[0].average).toBe(Math.round((100 + byName.bia.score) / 2));
  });
});

describe('painel de resultados', () => {
  it('visão da turma: médias por aluno, aula e tarefa', async () => {
    const res = await request(app).get(`/api/results/turmas/${turmaId}`).set('Authorization', teacher);
    expect(res.status).toBe(200);
    expect(res.body.turma.name).toBe('3A');
    expect(res.body.students.map((s: any) => s.name)).toEqual(['ana', 'bia', 'dani']);

    const byName = Object.fromEntries(res.body.students.map((s: any) => [s.name, s]));
    // ana: tarefa (100) + treino (100); bia: só a tarefa; dani: nada entregue
    expect(byName.ana).toMatchObject({ average: 100, attempts: 2 });
    expect(byName.bia.attempts).toBe(1);
    expect(byName.dani).toMatchObject({ average: null, attempts: 0 });

    const lesson = res.body.notebooks[0].lessons[0];
    expect(lesson).toMatchObject({ title: 'Derivadas', attempts: 3, participation: 2 });
    expect(lesson.average).toBe(Math.round((100 + 100 + byName.bia.average) / 3));

    expect(res.body.cells).toHaveLength(2); // ana e bia na aula
    expect(res.body.cells.find((c: any) => c.student === anaId)).toMatchObject({ average: 100, count: 2 });

    expect(res.body.tasks[0]).toMatchObject({ title: 'Lista de derivadas (revisada)', submitted: 2, late: 1, total: 3 });
  });

  it('não vaza dados de quem não está na turma nem de outro professor', async () => {
    // carla nunca entrou na turma, mas treina uma matéria própria: não aparece
    await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: 'carla@k.com' });
    await request(app).delete(`/api/turmas/${turmaId}/students/${carlaId}`).set('Authorization', teacher);
    const res = await request(app).get(`/api/results/turmas/${turmaId}`).set('Authorization', teacher);
    expect(res.body.students.map((s: any) => s.name)).not.toContain('carla');

    expect((await request(app).get(`/api/results/turmas/${turmaId}`).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).get(`/api/results/turmas/${turmaId}`).set('Authorization', ana)).status).toBe(403);
    expect((await request(app).get(`/api/results/turmas/${turmaId}`)).status).toBe(401);
    expect((await request(app).get('/api/results/turmas/invalido').set('Authorization', teacher)).status).toBe(404);
  });

  it('detalhe do aluno: histórico, médias por aula e pontos fracos', async () => {
    const res = await request(app).get(`/api/results/turmas/${turmaId}/students/${biaId}`).set('Authorization', teacher);
    expect(res.status).toBe(200);
    expect(res.body.student.name).toBe('bia');
    expect(res.body.attemptsCount).toBe(1);
    expect(res.body.attempts[0]).toMatchObject({ source: 'task', taskTitle: 'Lista de derivadas (revisada)', late: true, lesson: 'Derivadas', notebook: 'Cálculo' });
    expect(res.body.lessons[0]).toMatchObject({ lesson: 'Derivadas', attempts: 1 });
    expect(res.body.weakness.types.length).toBeGreaterThan(0);
    expect(res.body.weakness.topics.some((t: any) => t.needsReview)).toBe(true); // errou metade: tópicos em aberto

    expect((await request(app).get(`/api/results/turmas/${turmaId}/students/${carlaId}`).set('Authorization', teacher)).status).toBe(404); // não matriculada
    expect((await request(app).get(`/api/results/turmas/${turmaId}/students/${biaId}`).set('Authorization', teacher2)).status).toBe(404);
    const empty = await request(app).get(`/api/results/turmas/${turmaId}/students/${daniId}`).set('Authorization', teacher);
    expect(empty.body).toMatchObject({ average: null, attemptsCount: 0 });
  });

  it('o professor abre as respostas completas de uma tentativa', async () => {
    const subs = await request(app).get(`/api/tasks/${taskId}/submissions`).set('Authorization', teacher);
    const attemptId = subs.body.find((s: any) => s.student.name === 'bia').attemptId;
    const res = await request(app).get(`/api/results/attempts/${attemptId}`).set('Authorization', teacher);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ source: 'task', late: true, taskTitle: 'Lista de derivadas (revisada)', lessonTitle: 'Derivadas', notebookTitle: 'Cálculo' });
    expect(res.body.student.name).toBe('bia');
    expect(res.body.answers).toHaveLength(generated.length);
    expect(res.body.results[0].correctAnswer).toBeTruthy();

    expect((await request(app).get(`/api/results/attempts/${attemptId}`).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).get(`/api/results/attempts/${attemptId}`).set('Authorization', bia)).status).toBe(403);
    expect((await request(app).get(`/api/results/attempts/${new mongoose.Types.ObjectId()}`).set('Authorization', teacher)).status).toBe(404);
  });
});

describe('apagar', () => {
  it('apagar a tarefa leva as respostas dos alunos', async () => {
    expect(await QuizAttempt.countDocuments({ task: taskId })).toBe(2);
    expect((await request(app).delete(`/api/tasks/${taskId}`).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).delete(`/api/tasks/${taskId}`).set('Authorization', teacher)).status).toBe(204);
    expect(await QuizAttempt.countDocuments({ task: taskId })).toBe(0);
    expect(await QuizDraft.countDocuments({ task: taskId })).toBe(0);
    expect((await request(app).get('/api/tasks/mine').set('Authorization', ana)).body).toEqual([]);
    // os treinos da ana continuam
    expect(await QuizAttempt.countDocuments({ user: anaId, source: 'practice' })).toBe(1);
  });
});
