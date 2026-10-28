// src/routes/ai.routes.ts
// A geração e a correção de quizzes ficam em quizz.routes.ts (com gabarito protegido no servidor).
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthRequest } from '../types';
import { getAIService } from '../services/ai.service';

const router = Router();
router.use(authMiddleware);

// Rota para gerar resumos
router.post('/summarize', async (req: AuthRequest, res: Response) => {
  const { topic, context, language } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required.' });

  try {
    const summary = await getAIService().summarize({ topic, context, language });
    res.json({ summary });
  } catch (error) {
    console.error('AI API Error:', error);
    res.status(500).json({ error: 'Failed to generate summary.' });
  }
});

export default router;
