import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import { requireRole } from '../src/middleware/auth.middleware';
import Turma from '../src/models/Turma';
import Usuario from '../src/models/Usuario';
import { Router } from 'express';
import { takeQuiz } from './helpers';

let mongod: MongoMemoryServer;
const app = createApp();

// rota de teste protegida por papel (professor)
const probe = Router();
import { authMiddleware } from '../src/middleware/auth.middleware';
probe.get('/teacher-only', authMiddleware, requireRole('teacher'), (req, res) => { res.json({ ok: true }); });
app.use('/api/probe', probe);

async function register(name: string, email: string, extra: Record<string, unknown> = {}) {
  return request(app).post('/api/usuario/register').send({ name, email, password: 'secret123', ...extra });
}
async function login(email: string, password = 'secret123') {
  return request(app).post('/api/usuario/login').send({ email, password });
}
async function tokenFor(email: string) {
  const res = await login(email);
  return `Bearer ${res.body.token}`;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('test'));
  await Usuario.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('auth', () => {
  it('registra aluno por padrão e não devolve a senha', async () => {
    const res = await register('Ana', 'ana@test.com');
    expect(res.status).toBe(201);
    expect(res.body.usuario.role).toBe('student');
    expect(res.body.usuario.password).toBeUndefined();
  });

  it('rejeita e-mail duplicado e dados inválidos', async () => {
    expect((await register('Ana 2', 'ANA@test.com')).status).toBe(400);
    expect((await register('', 'x@test.com')).status).toBe(400);
    expect((await register('X', 'não-é-email')).status).toBe(400);
    expect((await request(app).post('/api/usuario/register').send({ name: 'X', email: 'x@test.com', password: '123' })).status).toBe(400);
  });

  it('professor exige código de convite correto', async () => {
    expect((await register('Prof', 'prof-sem@test.com', { role: 'teacher' })).status).toBe(403);
    expect((await register('Prof', 'prof-errado@test.com', { role: 'teacher', inviteCode: 'errado' })).status).toBe(403);
    const ok = await register('Prof', 'prof@test.com', { role: 'teacher', inviteCode: 'invite-123' });
    expect(ok.status).toBe(201);
    expect(ok.body.usuario.role).toBe('teacher');
  });

  it('login devolve token com role e usa a mesma mensagem para e-mail inexistente e senha errada', async () => {
    const ok = await login('prof@test.com');
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect(ok.body.usuario.role).toBe('teacher');

    const wrongPass = await login('prof@test.com', 'errada');
    const noUser = await login('naoexiste@test.com');
    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPass.body.error).toBe(noUser.body.error);
  });

  it('PUT /me salva tema/paleta mas não permite mudar role', async () => {
    const auth = await tokenFor('ana@test.com');
    const res = await request(app).put('/api/usuario/me').set('Authorization', auth)
      .send({ theme: 'dark', palette: 'matcha', fontScale: 1.2, role: 'teacher', accessibility: { signLanguage: true } });
    expect(res.status).toBe(200);
    expect(res.body.theme).toBe('dark');
    expect(res.body.palette).toBe('matcha');
    expect(res.body.role).toBe('student');
    expect(res.body.accessibility.signLanguage).toBe(true);
    expect(res.body.accessibility.audioDescription).toBe(false);

    const bad = await request(app).put('/api/usuario/me').set('Authorization', auth).send({ theme: 'neon' });
    expect(bad.status).toBe(400);
  });
});

describe('troca de senha', () => {
  it('exige a senha atual e passa a valer a nova', async () => {
    await register('Troca', 'troca@test.com');
    const auth = await tokenFor('troca@test.com');
    const wrong = await request(app).put('/api/usuario/me/password').set('Authorization', auth).send({ currentPassword: 'errada', newPassword: 'novasenha1' });
    expect(wrong.status).toBe(401);
    const short = await request(app).put('/api/usuario/me/password').set('Authorization', auth).send({ currentPassword: 'secret123', newPassword: '123' });
    expect(short.status).toBe(400);
    const ok = await request(app).put('/api/usuario/me/password').set('Authorization', auth).send({ currentPassword: 'secret123', newPassword: 'novasenha1' });
    expect(ok.status).toBe(200);
    expect((await login('troca@test.com', 'secret123')).status).toBe(401);
    expect((await login('troca@test.com', 'novasenha1')).status).toBe(200);
  });
});

describe('papéis', () => {
  it('requireRole bloqueia aluno e libera professor', async () => {
    const student = await request(app).get('/api/probe/teacher-only').set('Authorization', await tokenFor('ana@test.com'));
    const teacher = await request(app).get('/api/probe/teacher-only').set('Authorization', await tokenFor('prof@test.com'));
    const anon = await request(app).get('/api/probe/teacher-only');
    expect(student.status).toBe(403);
    expect(teacher.status).toBe(200);
    expect(anon.status).toBe(401);
  });
});

describe('matrícula por e-mail pendente', () => {
  it('aluno convidado antes do cadastro entra na turma ao se registrar', async () => {
    const teacher = await Usuario.findOne({ email: 'prof@test.com' });
    const turma = await Turma.create({ name: 'Turma P', teacher: teacher!._id, pendingEmails: ['convidado@test.com'] });

    await register('Convidado', 'convidado@test.com');
    const updated = await Turma.findById(turma._id);
    const convidado = await Usuario.findOne({ email: 'convidado@test.com' });
    expect(updated!.students.map(String)).toContain(String(convidado!._id));
    expect(updated!.pendingEmails).not.toContain('convidado@test.com');
  });
});

describe('cadernos e acesso', () => {
  let teacherAuth: string, anaAuth: string, outsiderAuth: string;
  let notebookId: string, lessonId: string;

  beforeAll(async () => {
    await register('Fora', 'fora@test.com');
    teacherAuth = await tokenFor('prof@test.com');
    anaAuth = await tokenFor('ana@test.com');
    outsiderAuth = await tokenFor('fora@test.com');

    const teacher = await Usuario.findOne({ email: 'prof@test.com' });
    const ana = await Usuario.findOne({ email: 'ana@test.com' });
    const turma = await Turma.create({ name: '3A', teacher: teacher!._id, students: [ana!._id] });

    const nb = await request(app).post('/api/notebooks').set('Authorization', teacherAuth).send({ title: 'Matemática', turma: String(turma._id) });
    expect(nb.status).toBe(201);
    notebookId = nb.body._id;
    const withLesson = await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', teacherAuth).send({ title: 'Derivadas' });
    lessonId = withLesson.body.lessons[0]._id;
  });

  it('só dono de turma cria caderno de turma', async () => {
    const turma = await Turma.findOne({ name: '3A' });
    const res = await request(app).post('/api/notebooks').set('Authorization', anaAuth).send({ title: 'Hack', turma: String(turma!._id) });
    expect(res.status).toBe(404);
  });

  it('aluno matriculado lê o caderno do professor, marcado como somente leitura', async () => {
    const res = await request(app).get('/api/notebooks').set('Authorization', anaAuth);
    const nb = res.body.find((n: any) => n._id === notebookId);
    expect(nb).toBeTruthy();
    expect(nb.readOnly).toBe(true);
    expect(nb.lessons[0].quizzAttempts).toEqual([]);

    const lesson = await request(app).get(`/api/lessons/${lessonId}`).set('Authorization', anaAuth);
    expect(lesson.status).toBe(200);
    expect(lesson.body.readOnly).toBe(true);
  });

  it('aluno matriculado não edita nem apaga o caderno do professor', async () => {
    expect((await request(app).put(`/api/notebooks/${notebookId}`).set('Authorization', anaAuth).send({ title: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/api/notebooks/${notebookId}`).set('Authorization', anaAuth)).status).toBe(404);
    expect((await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', anaAuth).send({ title: 'X' })).status).toBe(404);
  });

  it('quem não está na turma não vê nada do caderno', async () => {
    const list = await request(app).get('/api/notebooks').set('Authorization', outsiderAuth);
    expect(list.body.find((n: any) => n._id === notebookId)).toBeUndefined();
    expect((await request(app).get(`/api/lessons/${lessonId}`).set('Authorization', outsiderAuth)).status).toBe(404);
    expect((await request(app).get(`/api/lessons/nao-e-id`).set('Authorization', outsiderAuth)).status).toBe(404);
  });

  it('tentativas e chat são individuais por aluno', async () => {
    // o aluno não consegue gravar nota por conta própria: a rota antiga de envio não existe mais
    const forged = await request(app).post(`/api/lessons/${lessonId}/quizz-attempts`).set('Authorization', anaAuth).send({ score: 100, quizData: [], userAnswers: [] });
    expect(forged.status).toBe(404);

    const first = await takeQuiz(app, anaAuth, lessonId, 'right');
    const second = await takeQuiz(app, anaAuth, lessonId, 'wrong');
    expect(first.finished.status).toBe(201);
    expect(first.finished.body.score).toBe(100);
    expect(second.finished.body.score).toBe(0);

    // quem não está na turma não consegue nem criar quiz da aula
    const blocked = await request(app).post('/api/quizz/drafts').set('Authorization', outsiderAuth).send({ lessonId, topic: 'x' });
    expect(blocked.status).toBe(404);

    await request(app).put(`/api/lessons/${lessonId}/chat`).set('Authorization', anaAuth).send({ messages: [{ sender: 'user', text: 'olá' }] });

    const ana = await request(app).get(`/api/lessons/${lessonId}`).set('Authorization', anaAuth);
    expect(ana.body.quizzAttempts.map((a: any) => a.attemptNumber)).toEqual([1, 2]);
    expect(ana.body.quizzAttempts[0].questions).toHaveLength(8);
    expect(ana.body.quizzAttempts[0].results).toHaveLength(8);
    expect(ana.body.chatHistory).toEqual([{ sender: 'user', text: 'olá' }]);

    // o professor (dono) não enxerga as tentativas do aluno por esta rota
    const teacher = await request(app).get(`/api/lessons/${lessonId}`).set('Authorization', teacherAuth);
    expect(teacher.body.quizzAttempts).toEqual([]);

    // resumo nas listas e progresso
    const list = await request(app).get('/api/notebooks').set('Authorization', anaAuth);
    const nb = list.body.find((n: any) => n._id === notebookId);
    expect(nb.lessons[0].quizzAttempts).toHaveLength(2);
    expect(nb.lessons[0].quizzAttempts[0].questions).toBeUndefined();

    const progress = await request(app).get('/api/progress/data').set('Authorization', anaAuth);
    expect(progress.body.averageByNotebook).toEqual([{ notebook: 'Matemática', averageScore: 50 }]);
    expect(progress.body.allAttempts).toHaveLength(2);
  });

  it('dono renomeia e apaga aula; apagar remove tentativas', async () => {
    const renamed = await request(app).put(`/api/notebooks/${notebookId}/lessons/${lessonId}`).set('Authorization', teacherAuth).send({ title: 'Derivadas II' });
    expect(renamed.body.lessons[0].title).toBe('Derivadas II');

    const del = await request(app).delete(`/api/notebooks/${notebookId}/lessons/${lessonId}`).set('Authorization', teacherAuth);
    expect(del.status).toBe(200);
    expect(del.body.lessons).toHaveLength(0);

    const progress = await request(app).get('/api/progress/data').set('Authorization', anaAuth);
    expect(progress.body.allAttempts).toHaveLength(0);
  });

  it('IA mock responde para usuário autenticado e exige token', async () => {
    const anon = await request(app).post('/api/ai/summarize').send({ topic: 'x' });
    expect(anon.status).toBe(401);
    const ok = await request(app).post('/api/ai/summarize').set('Authorization', anaAuth).send({ topic: 'Derivadas', language: 'pt-BR' });
    expect(ok.status).toBe(200);
    expect(ok.body.summary).toContain('Resumo: Derivadas');
  });
});
