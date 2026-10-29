// src/routes/tasks.routes.ts — tarefas: o professor gera/edita um quiz com IA e publica para a turma
//
// Professor: POST /generate (rascunho de perguntas, ainda não salvo), POST / , PUT /:id, DELETE /:id, GET /, GET /:id, GET /:id/submissions
// Aluno:     GET /mine, GET /:id (resumo), POST /:id/start, GET /:id/my-attempt
// A resolução usa as rotas de /api/quizz (answer/finish), mas sem correção imediata: o aluno vê o resultado depois de enviar.
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';
import QuizAttempt from '../models/QuizAttempt';
import QuizDraft from '../models/QuizDraft';
import Task from '../models/Task';
import Turma from '../models/Turma';
import Usuario from '../models/Usuario';
import { AuthRequest } from '../types';
import { listStudentTasks } from '../services/studentTasks';
import { getAIService } from '../services/ai.service';
import { buildMaterialsContext } from '../services/materials';
import { parseBody } from '../utils/validate';
import { normalizeQuestion, Question, questionSchema, QUESTION_TYPES, toPublic } from '../quiz/questions';
import { allocate, QuizPlan } from '../quiz/weakness';

const router = Router();
router.use(authMiddleware);

const TASK_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.AI_RATE_LIMIT) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Try again in a minute.' },
});

const generateSchema = z.object({
  notebookId: z.string(),
  lessonId: z.string(),
  topic: z.string().trim().min(1).max(200),
  language: z.string().max(10).default('pt'),
  count: z.number().int().min(3).max(15).default(8),
  types: z.array(z.enum(QUESTION_TYPES)).min(1).default([...QUESTION_TYPES]),
});

const taskBody = {
  title: z.string().trim().min(1, 'Título obrigatório.').max(150),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  questions: z.array(questionSchema).min(1, 'Inclua ao menos uma pergunta.').max(30),
  published: z.boolean().optional(),
};
const createSchema = z.object({ notebookId: z.string(), lessonId: z.string(), ...taskBody });
const updateSchema = z.object({
  title: taskBody.title.optional(),
  description: taskBody.description,
  dueDate: taskBody.dueDate,
  questions: taskBody.questions.optional(),
  published: taskBody.published,
});

const objectId = (id: string) => (mongoose.isValidObjectId(id) ? id : null);

/** Notebook do professor, já vinculado a uma turma, e a aula informada. */
async function teacherNotebook(notebookId: string, lessonId: string, teacherId: string) {
  if (!objectId(notebookId) || !objectId(lessonId)) return { ok: false as const, status: 404, message: 'Not found.' };
  const notebook = await Notebook.findOne({ _id: notebookId, owner: teacherId });
  if (!notebook) return { ok: false as const, status: 404, message: 'Not found.' };
  if (!notebook.turma) return { ok: false as const, status: 400, message: 'notebookId: the subject must belong to a class' };
  const lesson = notebook.lessons.find((l) => l._id.toString() === lessonId);
  if (!lesson) return { ok: false as const, status: 400, message: 'lessonId: not part of this subject' };
  return { ok: true as const, notebook, lesson };
}

/** Tarefa que pertence a uma turma do professor. */
async function ownedTask(id: string, teacherId: string) {
  if (!objectId(id)) return null;
  const task = await Task.findById(id);
  if (!task) return null;
  return (await Turma.exists({ _id: task.turma, teacher: teacherId })) ? task : null;
}

const teacherOnly = requireRole('teacher');
const studentOnly = requireRole('student');

// POST /generate — gera perguntas com IA (usando os materiais da aula) para o professor revisar e editar
router.post('/generate', teacherOnly, aiLimiter, async (req: AuthRequest, res: Response) => {
  const data = parseBody(generateSchema, req.body, res);
  if (!data) return;
  try {
    const found = await teacherNotebook(data.notebookId, data.lessonId, req.userId as string);
    if (!found.ok) return res.status(found.status).json({ error: found.message });

    // só os tipos escolhidos, em partes iguais
    const weights = Object.fromEntries(QUESTION_TYPES.map((t) => [t, data.types.includes(t) ? 1 : 0])) as Record<(typeof QUESTION_TYPES)[number], number>;
    const plan: QuizPlan = { count: data.count, mix: allocate(data.count, weights, 0), reinforce: [] };

    const materials = await buildMaterialsContext(found.notebook._id, found.lesson._id);
    const generated = await getAIService().generateQuizz({
      topic: data.topic,
      context: `${found.notebook.title} - ${found.lesson.title}`,
      language: data.language,
      materials: materials.count > 0 ? materials.text : undefined,
      plan,
    });
    const questions = generated.map((q, i) => normalizeQuestion(questionSchema.parse(q), i));
    res.json({ questions, materialsUsed: materials.count });
  } catch (error) {
    console.error('TASK GENERATION FAILED:', error);
    res.status(502).json({ error: 'Failed to generate questions.' });
  }
});

// POST / — cria a tarefa (rascunho, a menos que `published: true`)
router.post('/', teacherOnly, async (req: AuthRequest, res: Response) => {
  const data = parseBody(createSchema, req.body, res);
  if (!data) return;
  try {
    const found = await teacherNotebook(data.notebookId, data.lessonId, req.userId as string);
    if (!found.ok) return res.status(found.status).json({ error: found.message });

    const task = await Task.create({
      turma: found.notebook.turma,
      notebook: found.notebook._id,
      lesson: found.lesson._id,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate ?? undefined,
      questions: data.questions.map((q, i) => normalizeQuestion(q, i)),
      published: data.published ?? false,
      createdBy: req.userId,
    });
    res.status(201).json({ _id: task._id });
  } catch (error) {
    console.error('TASK CREATE FAILED:', error);
    res.status(500).json({ error: 'Error creating task.' });
  }
});

// GET / — tarefas do professor, com andamento
router.get('/', teacherOnly, async (req: AuthRequest, res: Response) => {
  try {
    const turmas = await Turma.find({ teacher: req.userId }).select('name students').lean();
    const turmaById = new Map(turmas.map((t) => [String(t._id), t]));
    const tasks = await Task.find({ turma: { $in: turmas.map((t) => t._id) } }).sort({ createdAt: -1 }).lean();

    const stats = await QuizAttempt.aggregate([
      { $match: { task: { $in: tasks.map((t) => t._id) } } },
      { $group: { _id: '$task', submitted: { $sum: 1 }, average: { $avg: '$score' } } },
    ]);
    const statById = new Map(stats.map((s) => [String(s._id), s]));
    const notebooks = await Notebook.find({ _id: { $in: tasks.map((t) => t.notebook) } }).select('title lessons').lean();
    const notebookById = new Map(notebooks.map((n) => [String(n._id), n]));

    res.json(tasks.map((t) => {
      const nb = notebookById.get(String(t.notebook));
      const s = statById.get(String(t._id));
      return {
        _id: t._id, title: t.title, published: t.published, dueDate: t.dueDate ?? null,
        questionsCount: t.questions.length,
        turmaId: t.turma, turmaName: turmaById.get(String(t.turma))?.name,
        notebookTitle: nb?.title, lessonTitle: nb?.lessons.find((l) => String(l._id) === String(t.lesson))?.title,
        submitted: s?.submitted ?? 0, total: turmaById.get(String(t.turma))?.students.length ?? 0,
        average: s ? Math.round(s.average) : null,
      };
    }));
  } catch {
    res.status(500).json({ error: 'Error fetching tasks.' });
  }
});

// GET /mine — tarefas publicadas para o aluno, com a situação de cada uma
router.get('/mine', studentOnly, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await listStudentTasks(req.userId as string));
  } catch {
    res.status(500).json({ error: 'Error fetching tasks.' });
  }
});

// GET /:id — professor: tarefa completa (com gabarito); aluno: resumo (nunca as perguntas)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!objectId(req.params.id)) return res.status(404).json({ error: 'Task not found.' });
    const user = await Usuario.findById(req.userId).select('role');
    const task = await Task.findById(req.params.id).lean();
    if (!task || !user) return res.status(404).json({ error: 'Task not found.' });

    const notebook = await Notebook.findById(task.notebook).select('title lessons').lean();
    const lessonTitle = notebook?.lessons.find((l) => String(l._id) === String(task.lesson))?.title;
    const turma = await Turma.findById(task.turma).select('name teacher students').lean();

    if (user.role === 'teacher') {
      if (!turma || String(turma.teacher) !== req.userId) return res.status(404).json({ error: 'Task not found.' });
      return res.json({
        ...task, notebookId: task.notebook, lessonId: task.lesson, turmaName: turma.name,
        notebookTitle: notebook?.title, lessonTitle, submitted: await QuizAttempt.countDocuments({ task: task._id }),
      });
    }

    if (!turma || !turma.students.some((s) => String(s) === req.userId) || !task.published) return res.status(404).json({ error: 'Task not found.' });
    const attempt = await QuizAttempt.findOne({ task: task._id, user: req.userId }).select('score late createdAt').lean();
    const draft = attempt ? null : await QuizDraft.findOne({ task: task._id, user: req.userId }).select('answers').lean();
    res.json({
      _id: task._id, title: task.title, description: task.description, dueDate: task.dueDate ?? null,
      questionsCount: task.questions.length, notebookTitle: notebook?.title, lessonTitle,
      status: attempt ? 'submitted' : draft && draft.answers.some((x: unknown) => x !== null) ? 'in_progress' : 'pending',
      attemptId: attempt?._id ?? null, score: attempt?.score ?? null, late: attempt?.late ?? false,
    });
  } catch {
    res.status(500).json({ error: 'Error fetching task.' });
  }
});

// PUT /:id — edita; as perguntas só mudam enquanto ninguém enviou (senão as notas perderiam o sentido)
router.put('/:id', teacherOnly, async (req: AuthRequest, res: Response) => {
  const data = parseBody(updateSchema, req.body, res);
  if (!data) return;
  try {
    const task = await ownedTask(req.params.id, req.userId as string);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    if (data.questions) {
      if ((await QuizAttempt.countDocuments({ task: task._id })) > 0) {
        return res.status(409).json({ error: 'Questions cannot change after students have submitted.' });
      }
      task.questions = data.questions.map((q, i) => normalizeQuestion(q, i));
      // rascunhos em andamento ficam desatualizados
      await QuizDraft.deleteMany({ task: task._id });
    }
    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.dueDate !== undefined) task.dueDate = data.dueDate ?? undefined;
    if (data.published !== undefined) task.published = data.published;
    await task.save();
    res.json({ _id: task._id, published: task.published });
  } catch {
    res.status(500).json({ error: 'Error updating task.' });
  }
});

// DELETE /:id — apaga a tarefa e as respostas dos alunos
router.delete('/:id', teacherOnly, async (req: AuthRequest, res: Response) => {
  try {
    const task = await ownedTask(req.params.id, req.userId as string);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    await Promise.all([QuizAttempt.deleteMany({ task: task._id }), QuizDraft.deleteMany({ task: task._id })]);
    await task.deleteOne();
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error deleting task.' });
  }
});

// GET /:id/submissions — situação de cada aluno da turma
router.get('/:id/submissions', teacherOnly, async (req: AuthRequest, res: Response) => {
  try {
    const task = await ownedTask(req.params.id, req.userId as string);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const turma = await Turma.findById(task.turma).select('students').lean();
    const [students, attempts, drafts] = await Promise.all([
      Usuario.find({ _id: { $in: turma?.students ?? [] } }).select('name email').sort({ name: 1 }).lean(),
      QuizAttempt.find({ task: task._id }).select('user score late createdAt').lean(),
      QuizDraft.find({ task: task._id }).select('user answers').lean(),
    ]);
    const attemptByUser = new Map(attempts.map((a) => [String(a.user), a]));
    const draftByUser = new Map(drafts.map((d) => [String(d.user), d]));

    res.json(students.map((s) => {
      const a = attemptByUser.get(String(s._id));
      const d = draftByUser.get(String(s._id));
      return {
        student: { _id: s._id, name: s.name, email: s.email },
        status: a ? 'submitted' : d && d.answers.some((x: unknown) => x !== null) ? 'in_progress' : 'not_started',
        score: a?.score ?? null, late: a?.late ?? false, submittedAt: a?.createdAt ?? null, attemptId: a?._id ?? null,
      };
    }));
  } catch {
    res.status(500).json({ error: 'Error fetching submissions.' });
  }
});

// POST /:id/start — o aluno começa (ou retoma) a tarefa
router.post('/:id/start', studentOnly, async (req: AuthRequest, res: Response) => {
  try {
    if (!objectId(req.params.id)) return res.status(404).json({ error: 'Task not found.' });
    const task = await Task.findById(req.params.id).lean();
    if (!task || !task.published) return res.status(404).json({ error: 'Task not found.' });
    if (!(await Turma.exists({ _id: task.turma, students: req.userId }))) return res.status(404).json({ error: 'Task not found.' });
    if (await QuizAttempt.exists({ task: task._id, user: req.userId })) return res.status(409).json({ error: 'Task already submitted.' });

    const questions = task.questions as Question[];
    const language = typeof req.body?.language === 'string' ? req.body.language.slice(0, 10) : 'pt';
    let draft = await QuizDraft.findOne({ task: task._id, user: req.userId });
    if (!draft) {
      try {
        draft = await QuizDraft.create({
          user: req.userId, notebook: task.notebook, lesson: task.lesson, task: task._id, topic: task.title, language,
          questions, answers: questions.map(() => null), results: questions.map(() => null),
          expiresAt: new Date(Date.now() + TASK_DRAFT_TTL_MS),
        });
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        draft = await QuizDraft.findOne({ task: task._id, user: req.userId });
      }
    }
    if (!draft) return res.status(500).json({ error: 'Could not start the task.' });

    const answeredCount = draft.answers.findIndex((a) => a === null || a === undefined);
    res.json({
      draftId: draft._id,
      title: task.title,
      questions: (draft.questions as Question[]).map(toPublic),
      answeredCount: answeredCount === -1 ? draft.answers.length : answeredCount,
    });
  } catch (error) {
    console.error('TASK START FAILED:', error);
    res.status(500).json({ error: 'Could not start the task.' });
  }
});

// GET /:id/my-attempt — o aluno revê a própria tarefa depois de enviar (com gabarito e explicações)
router.get('/:id/my-attempt', studentOnly, async (req: AuthRequest, res: Response) => {
  try {
    if (!objectId(req.params.id)) return res.status(404).json({ error: 'Task not found.' });
    const attempt = await QuizAttempt.findOne({ task: req.params.id, user: req.userId }).lean();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
    res.json({
      _id: attempt._id, score: attempt.score, late: attempt.late ?? false, date: attempt.createdAt,
      questions: attempt.questions, answers: attempt.answers, results: attempt.results,
    });
  } catch {
    res.status(500).json({ error: 'Error fetching attempt.' });
  }
});

export default router;
