// src/routes/ai.routes.ts
import { Router, Request } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getAIService } from '../services/ai.service';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();
router.use(authMiddleware);

// Rota para gerar resumos
router.post('/summarize', async (req: AuthRequest, res) => {
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

// Rota para gerar o Quizz
router.post('/generate-quizz', async (req: AuthRequest, res) => {
  const { topic, context, language } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required.' });

  try {
    const quizzData = await getAIService().generateQuizz({ topic, context, language });
    return res.json(quizzData);
  } catch (error) {
    console.error('AI QUIZZ GENERATION FAILED:', error);
    res.status(500).json({ error: 'Failed to generate quizz.' });
  }
});

// Rota para analisar o resultado do Quizz
router.post('/analyze-quizz', async (req: AuthRequest, res) => {
  const { quizzData, userAnswers, language } = req.body;
  if (!quizzData || !userAnswers) {
    return res.status(400).json({ error: 'Quizz data and user answers are required.' });
  }

  try {
    const feedback = await getAIService().analyzeQuizz({ quizzData, userAnswers, language });
    res.json({ feedback });
  } catch (error) {
    console.error('AI Quizz Analysis Error:', error);
    res.status(500).json({ error: 'Failed to generate quizz feedback.' });
  }
});

export default router;
