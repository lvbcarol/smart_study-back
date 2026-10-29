// src/routes/agenda.routes.ts — agenda do aluno: tarefas do professor + tarefas e lembretes pessoais
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import AgendaItem, { AGENDA_KINDS, IAgendaItem } from '../models/AgendaItem';
import { listStudentTasks } from '../services/studentTasks';
import { AuthRequest } from '../types';
import { parseBody } from '../utils/validate';

const router = Router();
router.use(authMiddleware, requireRole('student'));

const RECENT_DONE_MS = 14 * 24 * 60 * 60 * 1000;

const isoDate = z.string().datetime({ offset: true }).transform((s) => new Date(s));

const createSchema = z.object({
  kind: z.enum(AGENDA_KINDS),
  title: z.string().trim().min(1, 'Título obrigatório.').max(120),
  notes: z.string().trim().max(500).optional(),
  dueAt: isoDate.nullish(),
}).refine((d) => d.kind !== 'reminder' || !!d.dueAt, { message: 'dueAt: lembretes precisam de data e hora', path: ['dueAt'] });

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  dueAt: isoDate.nullish(),
  done: z.boolean().optional(),
});

export interface AgendaEntry {
  id: string;
  source: 'personal' | 'teacher';
  kind: 'task' | 'reminder';
  title: string;
  notes?: string;
  dueAt: Date | null;
  done: boolean;
  // só para tarefas do professor
  taskId?: string;
  status?: string;
  late?: boolean;
  overdue?: boolean;
  score?: number | null;
  notebookTitle?: string;
  lessonTitle?: string;
}

const personal = (i: IAgendaItem): AgendaEntry => ({
  id: String(i._id), source: 'personal', kind: i.kind, title: i.title, notes: i.notes, dueAt: i.dueAt ?? null, done: i.done,
});

// GET /?from=&to= — itens do período
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return res.status(400).json({ error: 'from/to: invalid date' });
    const inRange = (d: Date | null) => !d || ((!from || d >= from) && (!to || d <= to));

    const [mine, tasks] = await Promise.all([
      AgendaItem.find({ user: req.userId }).lean<IAgendaItem[]>(),
      listStudentTasks(req.userId as string),
    ]);

    const entries: AgendaEntry[] = [
      // sem data: aparece enquanto aberto e por 14 dias depois de concluído (dá tempo de desfazer)
      ...mine.filter((i) => (i.dueAt ? inRange(i.dueAt) : !i.done || (!!i.doneAt && Date.now() - i.doneAt.getTime() < RECENT_DONE_MS))).map(personal),
      ...tasks.map((t): AgendaEntry => ({
        id: `task:${t._id}`, source: 'teacher', kind: 'task', title: t.title, dueAt: t.dueDate, done: t.status === 'submitted',
        taskId: String(t._id), status: t.status, late: t.late, overdue: t.overdue, score: t.score, notebookTitle: t.notebookTitle, lessonTitle: t.lessonTitle,
      })).filter((e) => (e.dueAt ? inRange(e.dueAt) : !e.done)),
    ];
    entries.sort((a, b) => (a.dueAt ? a.dueAt.getTime() : Infinity) - (b.dueAt ? b.dueAt.getTime() : Infinity));
    res.json({ items: entries });
  } catch {
    res.status(500).json({ error: 'Error fetching agenda.' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const data = parseBody(createSchema, req.body, res);
  if (!data) return;
  try {
    const item = await AgendaItem.create({ user: req.userId, kind: data.kind, title: data.title, notes: data.notes, dueAt: data.dueAt ?? undefined });
    res.status(201).json(personal(item));
  } catch {
    res.status(500).json({ error: 'Error creating item.' });
  }
});

async function ownItem(id: string, userId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return AgendaItem.findOne({ _id: id, user: userId });
}

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const data = parseBody(updateSchema, req.body, res);
  if (!data) return;
  try {
    const item = await ownItem(req.params.id, req.userId as string);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (data.title !== undefined) item.title = data.title;
    if (data.notes !== undefined) item.notes = data.notes;
    if (data.dueAt !== undefined) {
      if (data.dueAt === null && item.kind === 'reminder') return res.status(400).json({ error: 'dueAt: lembretes precisam de data e hora' });
      item.dueAt = data.dueAt ?? undefined;
    }
    if (data.done !== undefined) { item.done = data.done; item.doneAt = data.done ? new Date() : undefined; }
    await item.save();
    res.json(personal(item));
  } catch {
    res.status(500).json({ error: 'Error updating item.' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const item = await ownItem(req.params.id, req.userId as string);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    await item.deleteOne();
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error deleting item.' });
  }
});

export default router;
