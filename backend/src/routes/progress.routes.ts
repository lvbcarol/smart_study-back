// src/routes/progress.routes.ts
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';
import QuizAttempt from '../models/QuizAttempt';
import { AuthRequest } from '../types';

const router = Router();
router.use(authMiddleware);

router.get('/data', async (req: AuthRequest, res: Response) => {
  try {
    const attempts = await QuizAttempt.find({ user: req.userId })
      .select('notebook lesson score createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const notebooks = await Notebook.find({ _id: { $in: attempts.map((a) => a.notebook) } })
      .select('title lessons')
      .lean();
    const notebookTitle = new Map(notebooks.map((n) => [n._id.toString(), n.title]));
    const lessonTitle = new Map(notebooks.flatMap((n) => n.lessons.map((l) => [l._id.toString(), l.title] as const)));

    const allAttempts = attempts.map((a) => ({
      label: `${lessonTitle.get(a.lesson.toString()) ?? '-'} (${new Date(a.createdAt).toLocaleDateString('en-US')})`,
      score: a.score,
    }));

    const totals = new Map<string, { total: number; count: number }>();
    for (const a of attempts) {
      const key = a.notebook.toString();
      const t = totals.get(key) ?? { total: 0, count: 0 };
      t.total += a.score;
      t.count += 1;
      totals.set(key, t);
    }
    const averageByNotebook = [...totals.entries()].map(([id, t]) => ({
      notebook: notebookTitle.get(id) ?? '-',
      averageScore: Math.round(t.total / t.count),
    }));

    res.json({ allAttempts, averageByNotebook });
  } catch (error) {
    console.error('Error fetching progress data:', error);
    res.status(500).json({ error: 'Error fetching progress data.' });
  }
});

export default router;
