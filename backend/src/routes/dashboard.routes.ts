// src/routes/dashboard.routes.ts — painel de desempenho do aluno
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import FlashcardDeck from '../models/FlashcardDeck';
import Notebook from '../models/Notebook';
import QuizAttempt from '../models/QuizAttempt';
import StudySession from '../models/StudySession';
import WeaknessStat from '../models/WeaknessStat';
import { summarize } from '../flashcards/leitner';
import Usuario from '../models/Usuario';
import { accessibleNotebooksFilter } from '../services/access';
import { listStudentTasks } from '../services/studentTasks';
import { clampOffset, localDay } from '../study/dates';
import { buildStudentDashboard, DashAttempt } from '../study/dashboard';
import { loadKolbProfile } from '../study/kolbData';
import { collectWeaknesses } from '../study/planData';
import { studyWeek } from '../study/week';
import { AuthRequest } from '../types';

const router = Router();
router.use(authMiddleware, requireRole('student'));

const RANGES = [7, 30, 90];
const DAY_MS = 24 * 60 * 60 * 1000;

// GET /student?range=7|30|90&notebook=&tzOffset=
router.get('/student', async (req: AuthRequest, res: Response) => {
  try {
    const range = RANGES.includes(Number(req.query.range)) ? Number(req.query.range) : 30;
    const tz = clampOffset(typeof req.query.tzOffset === 'string' ? req.query.tzOffset : undefined);
    const notebookFilter = typeof req.query.notebook === 'string' && mongoose.isValidObjectId(req.query.notebook) ? req.query.notebook : null;
    const now = new Date();
    const since = new Date(now.getTime() - range * DAY_MS);
    const userId = req.userId as string;

    const notebooks = await Notebook.find(await accessibleNotebooksFilter(userId)).select('title lessons').lean();
    if (notebookFilter && !notebooks.some((n) => String(n._id) === notebookFilter)) return res.status(404).json({ error: 'Notebook not found.' });

    const titles = new Map(notebooks.map((n) => [String(n._id), { title: n.title, lessons: new Map(n.lessons.map((l) => [String(l._id), l.title])) }]));
    const lessons = new Map(notebooks.flatMap((n) => n.lessons.map((l) => [String(l._id), { id: String(l._id), title: l.title, notebookTitle: n.title }] as const)));

    const attemptFilter: Record<string, unknown> = { user: userId, createdAt: { $gte: since } };
    if (notebookFilter) attemptFilter.notebook = notebookFilter;

    const [attemptDocs, allAttemptDays, sessionDays, tasks, decks, stats, week, me] = await Promise.all([
      QuizAttempt.find(attemptFilter).select('notebook lesson score createdAt questions.type questions.bloomLevel questions.competency results.score').lean(),
      QuizAttempt.find({ user: userId, createdAt: { $gte: new Date(now.getTime() - 400 * DAY_MS) } }).select('createdAt').lean(),
      StudySession.distinct('day', { user: userId }),
      listStudentTasks(userId, now),
      FlashcardDeck.find({ user: userId }).select('cards.box cards.dueAt'),
      WeaknessStat.find({ user: userId }).lean(),
      studyWeek(userId, tz, now),
      Usuario.findById(userId).select('showLearningProfile').lean(),
    ]);

    const attempts: DashAttempt[] = attemptDocs.map((a) => ({
      notebook: String(a.notebook), lesson: String(a.lesson), score: a.score, createdAt: a.createdAt,
      types: (a.questions ?? []).map((q: { type: string }) => q.type),
      blooms: (a.questions ?? []).map((q: { bloomLevel?: string }) => q.bloomLevel),
      competencies: (a.questions ?? []).map((q: { competency?: string }) => q.competency),
      scores: (a.results ?? []).map((r: { score: number }) => r.score),
    }));
    const activeDays = new Set<string>([...sessionDays, ...allAttemptDays.map((a) => localDay(a.createdAt, tz))]);
    const cardTotals = decks.map((d) => summarize(d.cards, now));

    res.json(buildStudentDashboard({
      now, tzOffset: tz, range, attempts, notebooks: titles,
      weaknesses: collectWeaknesses(stats, lessons, now).filter((w) => !notebookFilter || titles.get(notebookFilter)?.lessons.has(w.lessonId)),
      tasks: { submitted: tasks.filter((t) => t.status === 'submitted').length, pending: tasks.filter((t) => t.status !== 'submitted').length },
      flashcards: { due: cardTotals.reduce((s, t) => s + t.due, 0), learned: cardTotals.reduce((s, t) => s + t.learned, 0) },
      week, activeDays,
      kolb: me?.showLearningProfile === false ? null : await loadKolbProfile(userId, now),
    }));
  } catch {
    res.status(500).json({ error: 'Error fetching dashboard.' });
  }
});

export default router;
