// src/routes/turma.routes.ts — turmas do professor e matrícula de alunos por e-mail
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';
import Turma, { newUniqueJoinCode } from '../models/Turma';
import Usuario from '../models/Usuario';
import { listStudentTurmas } from '../services/access';
import { AuthRequest } from '../types';
import { normalizeJoinCode } from '../utils/joinCode';
import { parseBody } from '../utils/validate';

const router = Router();
router.use(authMiddleware);

// Tentativas de adivinhar códigos de turma são limitadas por IP
const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.JOIN_RATE_LIMIT) || 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a minute.' },
});

/* ---------- Aluno: vínculo com turmas (avulso x vinculado) ---------- */
const joinSchema = z.object({ code: z.string().trim().min(1).max(20) });

// GET /mine — turmas em que o aluno está matriculado (vazio = aluno avulso)
router.get('/mine', requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    res.json(await listStudentTurmas(req.userId as string));
  } catch {
    res.status(500).json({ error: 'Error fetching classes.' });
  }
});

// POST /join — entra em uma turma com o código que o professor passou
router.post('/join', requireRole('student'), joinLimiter, async (req: AuthRequest, res: Response) => {
  const data = parseBody(joinSchema, req.body, res);
  if (!data) return;
  try {
    const code = normalizeJoinCode(data.code);
    const turma = code ? await Turma.findOne({ joinCode: code }) : null;
    // mesma resposta para qualquer código inexistente
    if (!turma) return res.status(404).json({ error: 'Invalid class code.' });

    const user = await Usuario.findById(req.userId).select('email').lean();
    const already = turma.students.some((s) => String(s) === req.userId);
    await Turma.updateOne(
      { _id: turma._id },
      { $addToSet: { students: req.userId }, ...(user ? { $pull: { pendingEmails: user.email } } : {}) }
    );
    const teacher = await Usuario.findById(turma.teacher).select('name').lean();
    res.json({ already, turma: { _id: turma._id, name: turma.name, teacherName: teacher?.name ?? '' } });
  } catch {
    res.status(500).json({ error: 'Error joining class.' });
  }
});

// DELETE /:id/leave — o aluno sai da turma (volta a ser avulso se for a única)
router.delete('/:id/leave', requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Class not found.' });
    const result = await Turma.updateOne({ _id: req.params.id, students: req.userId }, { $pull: { students: req.userId } });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Class not found.' });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error leaving class.' });
  }
});

/* ---------- Professor ---------- */
router.use(requireRole('teacher'));

const nameSchema = z.object({ name: z.string().trim().min(1, 'Nome obrigatório.').max(80) });
const enrollSchema = z.object({
  emails: z.union([z.string().max(10000), z.array(z.string().max(200)).max(200)]),
});
const MAX_EMAILS = 100;

export type EnrollStatus = 'enrolled' | 'pending' | 'already' | 'already_pending' | 'invalid' | 'not_student';

const emailSchema = z.string().pipe(z.email());

/** Aceita "a@x.com, b@x.com; c@x.com" ou lista; normaliza e remove duplicados. */
export function parseEmails(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(/[\s,;]+/);
  return [...new Set(parts.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

async function ownTurma(id: string, teacherId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Turma.findOne({ _id: id, teacher: teacherId });
}

/** Turmas criadas antes do código existir ganham um na primeira consulta do professor. */
async function ensureJoinCodes(turmas: { _id: unknown; joinCode?: string | null }[]) {
  for (const t of turmas) {
    if (t.joinCode) continue;
    t.joinCode = await newUniqueJoinCode();
    await Turma.updateOne({ _id: t._id }, { $set: { joinCode: t.joinCode } });
  }
}

// GET / — turmas do professor, com contagens
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const turmas = await Turma.find({ teacher: req.userId }).sort({ createdAt: 1 }).lean();
    await ensureJoinCodes(turmas);
    const counts = await Notebook.aggregate([
      { $match: { turma: { $in: turmas.map((t) => t._id) } } },
      { $group: { _id: '$turma', n: { $sum: 1 } } },
    ]);
    const notebooksByTurma = new Map(counts.map((c) => [String(c._id), c.n as number]));
    res.json(turmas.map((t) => ({
      _id: t._id, name: t.name, joinCode: t.joinCode,
      studentsCount: t.students.length,
      pendingCount: t.pendingEmails.length,
      notebooksCount: notebooksByTurma.get(String(t._id)) ?? 0,
    })));
  } catch {
    res.status(500).json({ error: 'Error fetching classes.' });
  }
});

// POST / — cria turma
router.post('/', async (req: AuthRequest, res: Response) => {
  const data = parseBody(nameSchema, req.body, res);
  if (!data) return;
  try {
    const turma = await Turma.create({ name: data.name, teacher: req.userId, students: [], pendingEmails: [] });
    res.status(201).json({ _id: turma._id, name: turma.name, joinCode: turma.joinCode, studentsCount: 0, pendingCount: 0, notebooksCount: 0 });
  } catch {
    res.status(500).json({ error: 'Error creating class.' });
  }
});

// GET /:id — alunos, convites pendentes e matérias
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.id, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    if (!turma.joinCode) { turma.joinCode = await newUniqueJoinCode(); await turma.save(); }

    const [students, notebooks] = await Promise.all([
      Usuario.find({ _id: { $in: turma.students } }).select('name email').sort({ name: 1 }).lean(),
      Notebook.find({ turma: turma._id }).select('title lessons').sort({ createdAt: 1 }).lean(),
    ]);
    res.json({
      _id: turma._id,
      name: turma.name,
      joinCode: turma.joinCode,
      students: students.map((s) => ({ _id: s._id, name: s.name, email: s.email })),
      pendingEmails: turma.pendingEmails,
      notebooks: notebooks.map((n) => ({ _id: n._id, title: n.title, lessonsCount: n.lessons.length })),
    });
  } catch {
    res.status(500).json({ error: 'Error fetching class.' });
  }
});

// PUT /:id — renomeia
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const data = parseBody(nameSchema, req.body, res);
  if (!data) return;
  try {
    const turma = await ownTurma(req.params.id, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    turma.name = data.name;
    await turma.save();
    res.json({ _id: turma._id, name: turma.name });
  } catch {
    res.status(500).json({ error: 'Error updating class.' });
  }
});

// POST /:id/code — gera outro código (o antigo deixa de funcionar; quem já entrou continua na turma)
router.post('/:id/code', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.id, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    turma.joinCode = await newUniqueJoinCode();
    await turma.save();
    res.json({ joinCode: turma.joinCode });
  } catch {
    res.status(500).json({ error: 'Error generating code.' });
  }
});

// DELETE /:id — apaga a turma; as matérias continuam com o professor, mas deixam de ser vistas pelos alunos
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.id, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    await Notebook.updateMany({ turma: turma._id }, { $unset: { turma: 1 } });
    await turma.deleteOne();
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error deleting class.' });
  }
});

// POST /:id/students — matrícula por e-mail (quem ainda não tem conta fica "pendente" e entra ao se cadastrar)
router.post('/:id/students', async (req: AuthRequest, res: Response) => {
  const data = parseBody(enrollSchema, req.body, res);
  if (!data) return;
  try {
    const turma = await ownTurma(req.params.id, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });

    const emails = parseEmails(data.emails);
    if (emails.length === 0) return res.status(400).json({ error: 'emails: provide at least one e-mail' });
    if (emails.length > MAX_EMAILS) return res.status(400).json({ error: `emails: at most ${MAX_EMAILS} per request` });

    const valid = emails.filter((e) => emailSchema.safeParse(e).success);
    const users = await Usuario.find({ email: { $in: valid } }).select('email role').lean();
    const byEmail = new Map(users.map((u) => [u.email, u]));
    const enrolled = new Set(turma.students.map(String));
    const pending = new Set(turma.pendingEmails);

    const toEnroll: mongoose.Types.ObjectId[] = [];
    const toPend: string[] = [];
    const results = emails.map((email): { email: string; status: EnrollStatus } => {
      if (!valid.includes(email)) return { email, status: 'invalid' };
      const user = byEmail.get(email);
      if (user) {
        if (user.role !== 'student') return { email, status: 'not_student' };
        if (enrolled.has(String(user._id))) return { email, status: 'already' };
        toEnroll.push(user._id as mongoose.Types.ObjectId);
        return { email, status: 'enrolled' };
      }
      if (pending.has(email)) return { email, status: 'already_pending' };
      toPend.push(email);
      return { email, status: 'pending' };
    });

    if (toEnroll.length || toPend.length) {
      await Turma.updateOne(
        { _id: turma._id },
        { $addToSet: { students: { $each: toEnroll }, pendingEmails: { $each: toPend } } }
      );
    }
    res.json({ results });
  } catch {
    res.status(500).json({ error: 'Error enrolling students.' });
  }
});

// DELETE /:id/students/:userId
router.delete('/:id/students/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.id, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ error: 'Student not found.' });
    await Turma.updateOne({ _id: turma._id }, { $pull: { students: req.params.userId } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error removing student.' });
  }
});

// DELETE /:id/pending/:email — cancela um convite pendente
router.delete('/:id/pending/:email', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.id, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    await Turma.updateOne({ _id: turma._id }, { $pull: { pendingEmails: req.params.email.toLowerCase() } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error removing invite.' });
  }
});

export default router;
