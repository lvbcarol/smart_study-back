// src/routes/progress.routes.ts
import { Router, Request } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();
router.use(authMiddleware);

router.get('/data', async (req: AuthRequest, res) => {
  try {
    const notebooks = await Notebook.find({ user: req.userId }).select('title lessons.title lessons.quizzAttempts');
    
    if (!notebooks) {
      return res.json({ allAttempts: [], averageByNotebook: [] });
    }

    const allAttempts: any[] = [];
    const averageByNotebook: any[] = [];

    notebooks.forEach(notebook => {
      let totalScore = 0;
      let attemptCount = 0;

      if (notebook.lessons) {
        notebook.lessons.forEach(lesson => {
          if (lesson.quizzAttempts && lesson.quizzAttempts.length > 0) {
            lesson.quizzAttempts.forEach(attempt => {
              const attemptLabel = `${lesson.title} (${new Date(attempt.date).toLocaleDateString('en-US')})`;
              allAttempts.push({
                label: attemptLabel,
                // ✅ CORREÇÃO AQUI: "Score" -> "score"
                score: attempt.score,
              });
              totalScore += attempt.score;
              attemptCount++;
            });
          }
        });
      }
      
      if (attemptCount > 0) {
        averageByNotebook.push({
          notebook: notebook.title,
          // ✅ CORREÇÃO AQUI: "Average Score" -> "averageScore"
          averageScore: Math.round(totalScore / attemptCount),
        });
      }
    });

    res.json({ allAttempts, averageByNotebook });

  } catch (error) {
    console.error("Error fetching progress data:", error);
    res.status(500).json({ error: 'Error fetching progress data.' });
  }
});

export default router;