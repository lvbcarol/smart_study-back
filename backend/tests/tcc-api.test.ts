import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import Usuario from '../src/models/Usuario';
import Turma from '../src/models/Turma';
import Notebook from '../src/models/Notebook';
import Task from '../src/models/Task';
import QuizAttempt from '../src/models/QuizAttempt';
import { takeQuiz } from './helpers';

let mongod: MongoMemoryServer;
const app = createApp();

let teacher: string, teacher2: string, ana: string, bia: string, cris: string;
let turmaId: string, notebookId: string, lessonId: string, taskId: string;

async function signup(email: string, extra: Record<string, unknown> = {}) {
  await request(app).post('/api/usuario/register').send({ name: email.split('@')[0], email, password: 'secret123', ...extra });
  const res = await request(app).post('/api/usuario/login').send({ email, password: 'secret123' });
  return `Bearer ${res.body.token}`;
}
const me = (auth: string) => request(app).get('/api/usuario/me').set('Authorization', auth);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('tcc'));
  await Usuario.init();
  teacher = await signup('prof@f.com', { role: 'teacher', inviteCode: 'invite-123' });
  teacher2 = await signup('prof2@f.com', { role: 'teacher', inviteCode: 'invite-123' });
  ana = await signup('ana@f.com');
  bia = await signup('bia@f.com');
  cris = await signup('cris@f.com');

  turmaId = (await request(app).post('/api/turmas').set('Authorization', teacher).send({ name: '3A' })).body._id;
  await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: 'ana@f.com, bia@f.com, cris@f.com' });
  notebookId = (await request(app).post('/api/notebooks').set('Authorization', teacher).send({ title: 'Cálculo', turma: turmaId })).body._id;
  lessonId = (await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', teacher).send({ title: 'Derivadas' })).body.lessons[0]._id;

  const gen = await request(app).post('/api/tasks/generate').set('Authorization', teacher).send({ notebookId, lessonId, topic: 'Derivadas', language: 'pt-BR', count: 4 });
  taskId = (await request(app).post('/api/tasks').set('Authorization', teacher).send({
    notebookId, lessonId, title: 'Lista 1', dueDate: new Date(Date.now() + 86400_000).toISOString(), questions: gen.body.questions,
  })).body._id;
  await request(app).put(`/api/tasks/${taskId}`).set('Authorization', teacher).send({ published: true });

  await takeQuiz(app, ana, lessonId, (_q, i) => (i % 2 ? 'right' : 'wrong'), 'Derivadas');
  await takeQuiz(app, ana, lessonId, 'right', 'Derivadas'); // 16 respostas: passa do mínimo para rotular o estilo
  await takeQuiz(app, bia, lessonId, 'right', 'Derivadas');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('consentimento (LGPD)', () => {
  it('com a exigência ligada, não há conta sem aceitar os Termos; o aceite fica registrado', async () => {
    process.env.REQUIRE_CONSENT = 'true';
    try {
      const body = { name: 'Davi', email: 'davi@f.com', password: 'secret123' };
      const refused = await request(app).post('/api/usuario/register').send(body);
      expect(refused.status).toBe(400);
      expect(refused.body.error).toMatch(/Termos/);
      expect((await request(app).post('/api/usuario/register').send({ ...body, acceptTerms: false })).status).toBe(400);
      expect(await Usuario.exists({ email: 'davi@f.com' })).toBeNull();

      expect((await request(app).post('/api/usuario/register').send({ ...body, acceptTerms: true })).status).toBe(201);
      const login = await request(app).post('/api/usuario/login').send({ email: 'davi@f.com', password: 'secret123' });
      const profile = await me(`Bearer ${login.body.token}`);
      expect(profile.body.consent).toMatchObject({ version: '2026-03' });
      expect(new Date(profile.body.consent.at).getTime()).toBeGreaterThan(Date.now() - 60_000);
    } finally {
      process.env.REQUIRE_CONSENT = 'false';
    }
  });
});

describe('privacidade e perfil de aprendizagem', () => {
  it('por padrão o tempo não é compartilhado e o perfil fica visível', async () => {
    const res = await me(ana);
    expect(res.body).toMatchObject({ shareStudyTimeWithTeacher: false, showLearningProfile: true });
  });

  it('o aluno liga e desliga as duas chaves (e só aceita booleanos)', async () => {
    const put = (b: object) => request(app).put('/api/usuario/me').set('Authorization', cris).send(b);
    expect((await put({ shareStudyTimeWithTeacher: true, showLearningProfile: false })).body).toMatchObject({ shareStudyTimeWithTeacher: true, showLearningProfile: false });
    expect((await put({ shareStudyTimeWithTeacher: 'sim' })).status).toBe(400);
    await put({ shareStudyTimeWithTeacher: false, showLearningProfile: true });
  });

  it('o dashboard traz o perfil de Kolb e o acerto por nível de Bloom; ocultar remove o perfil', async () => {
    const dash = await request(app).get('/api/dashboard/student').set('Authorization', ana);
    expect(dash.body.kolb.quadrants).toHaveLength(4);
    expect(dash.body.kolb.enough).toBe(true); // 16 respostas passam do mínimo
    expect(['diverging', 'assimilating', 'converging', 'accommodating']).toContain(dash.body.kolb.style);
    expect(dash.body.byBloom).toHaveLength(6);
    expect(dash.body.byBloom.some((b: any) => b.accuracy !== null)).toBe(true);
    const understand = dash.body.byBloom.find((b: any) => b.level === 'understand');
    expect(understand.answered).toBeGreaterThan(0); // dissertativas (nível padrão)

    await request(app).put('/api/usuario/me').set('Authorization', ana).send({ showLearningProfile: false });
    expect((await request(app).get('/api/dashboard/student').set('Authorization', ana)).body.kolb).toBeNull();
    await request(app).put('/api/usuario/me').set('Authorization', ana).send({ showLearningProfile: true });
  });
});

describe('competências', () => {
  let compId: string;

  it('o professor cria, lista e apaga; nomes repetidos dão 409', async () => {
    const post = (auth: string, name: string) => request(app).post(`/api/notebooks/${notebookId}/competencies`).set('Authorization', auth).send({ name });
    const created = await post(teacher, 'Pensamento crítico');
    expect(created.status).toBe(201);
    compId = created.body._id;
    expect((await post(teacher, 'pensamento CRÍTICO')).status).toBe(409);
    expect((await post(teacher, '')).status).toBe(400);
    await post(teacher, 'Resolução de problemas');
    const list = await request(app).get(`/api/notebooks/${notebookId}/competencies`).set('Authorization', teacher);
    expect(list.body.map((c: any) => c.name)).toEqual(['Pensamento crítico', 'Resolução de problemas']);
  });

  it('aluno da turma lê, mas não cria; quem não tem acesso não vê', async () => {
    expect((await request(app).get(`/api/notebooks/${notebookId}/competencies`).set('Authorization', ana)).body).toHaveLength(2);
    expect((await request(app).post(`/api/notebooks/${notebookId}/competencies`).set('Authorization', ana).send({ name: 'Hack' })).status).toBe(404);
    expect((await request(app).get(`/api/notebooks/${notebookId}/competencies`).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).delete(`/api/notebooks/${notebookId}/competencies/${compId}`).set('Authorization', ana)).status).toBe(404);
  });

  it('apaga só a do próprio caderno', async () => {
    expect((await request(app).delete(`/api/notebooks/${notebookId}/competencies/${compId}`).set('Authorization', teacher)).status).toBe(204);
    expect((await request(app).delete(`/api/notebooks/${notebookId}/competencies/${compId}`).set('Authorization', teacher)).status).toBe(404);
    expect((await request(app).delete(`/api/notebooks/${notebookId}/competencies/invalido`).set('Authorization', teacher)).status).toBe(404);
  });

  it('a pergunta da tarefa guarda a competência e o nível de Bloom, e o painel da turma agrega', async () => {
    const task = await Task.findById(taskId);
    const questions = (task!.questions as any[]).map((q, i) => ({ ...q, competency: i % 2 ? 'Resolução de problemas' : 'Pensamento crítico', bloomLevel: i % 2 ? 'apply' : 'evaluate' }));
    const updated = await request(app).put(`/api/tasks/${taskId}`).set('Authorization', teacher).send({ questions });
    expect(updated.status).toBe(200);
    const stored = (await Task.findById(taskId))!.questions as any[];
    expect(stored.map((q) => q.competency)).toEqual(['Pensamento crítico', 'Resolução de problemas', 'Pensamento crítico', 'Resolução de problemas']);
    expect(stored.map((q) => q.bloomLevel)).toEqual(['evaluate', 'apply', 'evaluate', 'apply']);

    // Ana entrega a tarefa (cada resposta certa/errada alternada) e o painel passa a mostrar os desfechos
    const start = await request(app).post(`/api/tasks/${taskId}/start`).set('Authorization', ana).send({ language: 'pt-BR' });
    const { answerFor } = await import('./helpers');
    for (let i = 0; i < stored.length; i++) {
      await request(app).post(`/api/quizz/drafts/${start.body.draftId}/answer`).set('Authorization', ana).send({ index: i, answer: answerFor(stored[i], i % 2 ? 'right' : 'wrong') });
    }
    expect((await request(app).post(`/api/quizz/drafts/${start.body.draftId}/finish`).set('Authorization', ana)).status).toBe(201);

    const out = await request(app).get(`/api/results/turmas/${turmaId}/outcomes`).query({ range: 30 }).set('Authorization', teacher);
    expect(out.status).toBe(200);
    expect(out.body.byBloom).toHaveLength(6);
    expect(out.body.byBloom.find((b: any) => b.level === 'apply')).toMatchObject({ accuracy: 100 });
    expect(out.body.byBloom.find((b: any) => b.level === 'evaluate')).toMatchObject({ accuracy: 0 });
    expect(out.body.byCompetency).toEqual([
      { name: 'Pensamento crítico', answers: 2, accuracy: 0 },
      { name: 'Resolução de problemas', answers: 2, accuracy: 100 },
    ]);
    // o aluno vê as próprias competências no dashboard dele
    const dash = await request(app).get('/api/dashboard/student').set('Authorization', ana);
    expect(dash.body.byCompetency.map((c: any) => c.name)).toEqual(['Pensamento crítico', 'Resolução de problemas']);
    expect((await request(app).get(`/api/results/turmas/${turmaId}/outcomes`).set('Authorization', teacher2)).status).toBe(404);
  });
});

describe('estilos de aprendizagem na turma', () => {
  it('distribui os estilos, esconde quem ocultou o perfil e é só do professor da turma', async () => {
    const res = await request(app).get(`/api/results/turmas/${turmaId}/learning-styles`).set('Authorization', teacher);
    expect(res.status).toBe(200);
    expect(res.body.studentsTotal).toBe(3);
    const total = Object.values(res.body.styles as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(total + res.body.hidden).toBe(3);
    expect(res.body.styles.insufficient).toBeGreaterThanOrEqual(1); // a Cris ainda não estudou

    await request(app).put('/api/usuario/me').set('Authorization', bia).send({ showLearningProfile: false });
    const hidden = await request(app).get(`/api/results/turmas/${turmaId}/learning-styles`).set('Authorization', teacher);
    expect(hidden.body.hidden).toBe(1);
    await request(app).put('/api/usuario/me').set('Authorization', bia).send({ showLearningProfile: true });

    expect((await request(app).get(`/api/results/turmas/${turmaId}/learning-styles`).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).get(`/api/results/turmas/${turmaId}/learning-styles`).set('Authorization', ana)).status).toBe(403);
  });
});

describe('alerta de risco e tempo compartilhado', () => {
  it('só o professor da turma vê o painel', async () => {
    expect((await request(app).get(`/api/results/turmas/${turmaId}/risk`).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).get(`/api/results/turmas/${turmaId}/risk`).set('Authorization', ana)).status).toBe(403);
  });

  it('sem sinais, ninguém aparece; sem atividade há semanas e tarefa atrasada viram alerta', async () => {
    const calm = await request(app).get(`/api/results/turmas/${turmaId}/risk`).set('Authorization', teacher);
    expect(calm.body.studentsTotal).toBe(3);
    expect(calm.body.students).toEqual([]);

    // a Ana sumiu há 20 dias (e a conta dela é antiga); a tarefa venceu ontem e só a Ana a entregou
    const old = new Date(Date.now() - 60 * 86400_000);
    const ago = (d: number) => new Date(Date.now() - d * 86400_000);
    for (const email of ['ana@f.com', 'bia@f.com', 'cris@f.com']) await Usuario.collection.updateOne({ email }, { $set: { createdAt: old } });
    const anaId = (await Usuario.findOne({ email: 'ana@f.com' }))!._id;
    await QuizAttempt.collection.updateMany({ user: anaId }, { $set: { createdAt: ago(20) } });
    await Task.collection.updateOne({ _id: new mongoose.Types.ObjectId(taskId) }, { $set: { dueDate: ago(1) } });

    const res = await request(app).get(`/api/results/turmas/${turmaId}/risk`).set('Authorization', teacher);
    const byName = Object.fromEntries(res.body.students.map((s: any) => [s.name, s]));
    expect(byName.ana).toMatchObject({ level: 'high', flags: ['inactive'], daysInactive: 20, overdueTasks: 0 });
    expect(byName.bia).toMatchObject({ level: 'medium', flags: ['overdue'], overdueTasks: 1 });
    expect(byName.cris.flags).toEqual(['inactive', 'overdue']); // nunca estudou, conta antiga, tarefa atrasada
    expect(byName.cris.level).toBe('high');
    expect(res.body.students.map((s: any) => s.name)).toEqual(['cris', 'ana', 'bia']);
  });

  it('o tempo de estudo só aparece para o professor de quem permitiu', async () => {
    await request(app).post('/api/study/sessions').set('Authorization', bia).send({ kind: 'manual', seconds: 30 * 60 });
    await request(app).post('/api/study/sessions').set('Authorization', cris).send({ kind: 'manual', seconds: 10 * 60 });

    const before = await request(app).get('/api/results/overview').set('Authorization', teacher);
    expect(before.body.turmas[0].sharedStudyMinutes).toBeNull(); // ninguém compartilha ainda

    await request(app).put('/api/usuario/me').set('Authorization', bia).send({ shareStudyTimeWithTeacher: true });
    const after = await request(app).get('/api/results/overview').set('Authorization', teacher);
    expect(after.body.turmas[0].sharedStudyMinutes).toBe(30); // só a Bia entra na média (a Cris não compartilhou)

    // a Bia compartilha: os 30 min dela contam como atividade e ela sai do alerta de inatividade
    const risk = await request(app).get(`/api/results/turmas/${turmaId}/risk`).set('Authorization', teacher);
    expect(risk.body.students.find((s: any) => s.name === 'bia').flags).toEqual(['overdue']);
    // a Cris não compartilha: o tempo dela não conta e o alerta continua
    expect(risk.body.students.find((s: any) => s.name === 'cris').flags).toContain('inactive');
  });

  it('o tópico fraco da turma traz a aula e a matéria para criar a tarefa de reforço', async () => {
    const res = await request(app).get(`/api/results/turmas/${turmaId}/weakness`).set('Authorization', teacher);
    expect(res.body.topics[0]).toMatchObject({ lessonId, notebookId });
  });
});

describe('lembretes motivacionais', () => {
  it('só para alunos', async () => {
    expect((await request(app).get('/api/study/nudges').set('Authorization', teacher)).status).toBe(403);
    expect((await request(app).get('/api/study/nudges')).status).toBe(401);
  });

  it('a tarefa atrasada da turma gera lembrete para quem não entregou', async () => {
    const res = await request(app).get('/api/study/nudges').query({ tzOffset: 0 }).set('Authorization', bia);
    expect(res.status).toBe(200);
    expect(res.body.nudges[0]).toMatchObject({ kind: 'taskOverdue', params: { title: 'Lista 1' } });
    expect(res.body.nudges.length).toBeLessThanOrEqual(3);
  });

  it('meta e sequência aparecem quando fazem sentido', async () => {
    await request(app).put('/api/usuario/me').set('Authorization', bia).send({ weeklyGoalMinutes: 40 });
    const res = await request(app).get('/api/study/nudges').query({ tzOffset: 0 }).set('Authorization', bia);
    expect(res.body.nudges.map((n: any) => n.kind)).toContain('goalClose'); // 30 de 40 min
    expect(res.body.nudges.find((n: any) => n.kind === 'goalClose').params.left).toBe(10);
  });
});

describe('exportar e excluir a conta', () => {
  it('exporta os dados sem a senha, como arquivo', async () => {
    const res = await request(app).get('/api/usuario/me/export').set('Authorization', ana);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="smart-study-meus-dados\.json"/);
    expect(res.body.profile.email).toBe('ana@f.com');
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
    expect(res.body.attempts.length).toBeGreaterThanOrEqual(2);
    expect(res.body.classes.map((c: any) => c.name)).toEqual(['3A']);
    expect((await request(app).get('/api/usuario/me/export')).status).toBe(401);
  });

  it('excluir exige a senha certa', async () => {
    expect((await request(app).delete('/api/usuario/me').set('Authorization', cris).send({})).status).toBe(400);
    expect((await request(app).delete('/api/usuario/me').set('Authorization', cris).send({ password: 'errada' })).status).toBe(403);
    expect(await Usuario.exists({ email: 'cris@f.com' })).not.toBeNull();
  });

  it('excluir um aluno apaga os dados dele e o tira da turma, sem mexer nos dos colegas', async () => {
    const anaId = String((await Usuario.findOne({ email: 'ana@f.com' }))!._id);
    const biaAttempts = await QuizAttempt.countDocuments({ user: (await Usuario.findOne({ email: 'bia@f.com' }))!._id });
    expect((await request(app).delete('/api/usuario/me').set('Authorization', ana).send({ password: 'secret123' })).status).toBe(204);

    expect(await Usuario.exists({ email: 'ana@f.com' })).toBeNull();
    expect(await QuizAttempt.countDocuments({ user: anaId })).toBe(0);
    expect((await Turma.findById(turmaId))!.students.map(String)).not.toContain(anaId);
    expect(await QuizAttempt.countDocuments({ user: (await Usuario.findOne({ email: 'bia@f.com' }))!._id })).toBe(biaAttempts);
    expect((await request(app).post('/api/usuario/login').send({ email: 'ana@f.com', password: 'secret123' })).status).toBe(401);
    expect((await request(app).get('/api/usuario/me').set('Authorization', ana)).status).toBe(404); // o token antigo não serve para nada
  });

  it('excluir o professor apaga turmas, matérias, tarefas e o que os alunos fizeram nelas', async () => {
    expect((await request(app).delete('/api/usuario/me').set('Authorization', teacher).send({ password: 'secret123' })).status).toBe(204);
    expect(await Usuario.exists({ email: 'prof@f.com' })).toBeNull();
    expect(await Turma.findById(turmaId)).toBeNull();
    expect(await Notebook.findById(notebookId)).toBeNull();
    expect(await Task.findById(taskId)).toBeNull();
    expect(await QuizAttempt.countDocuments({ notebook: notebookId })).toBe(0);
    // a conta dos alunos continua existindo
    expect(await Usuario.exists({ email: 'bia@f.com' })).not.toBeNull();
    // o outro professor não foi afetado
    expect(await Usuario.exists({ email: 'prof2@f.com' })).not.toBeNull();
  });
});
