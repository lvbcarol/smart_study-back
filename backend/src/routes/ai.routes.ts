// src/routes/ai.routes.ts
// A geração e a correção de quizzes ficam em quizz.routes.ts (com gabarito protegido no servidor).
import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthRequest } from '../types';
import { findLessonAccess } from '../services/access';
import { getAIService } from '../services/ai.service';
import { buildMaterialsContext } from '../services/materials';
import { parseBody } from '../utils/validate';

const router = Router();
router.use(authMiddleware);

const summarizeSchema = z.object({
  topic: z.string().trim().min(1, 'Topic is required.').max(500),
  context: z.string().max(300).optional(),
  language: z.string().max(10).optional(),
  lessonId: z.string().optional(),
});

const chatSchema = z.object({
  lessonId: z.string(),
  message: z.string().trim().min(1).max(2000),
  language: z.string().max(10).optional(),
  history: z.array(z.object({ sender: z.enum(['user', 'bot']), text: z.string().max(8000) })).max(40).default([]),
});

/** Resolve aula + materiais do professor; `allowed: false` se o usuário não tem acesso à aula. */
async function lessonContext(lessonId: string | undefined, userId: string) {
  if (!lessonId) return { allowed: true as const, context: undefined, materials: undefined, count: 0 };
  const access = await findLessonAccess(lessonId, userId);
  if (!access) return { allowed: false as const };
  const m = await buildMaterialsContext(access.notebook._id, access.lesson._id);
  return {
    allowed: true as const,
    context: `${access.notebook.title} - ${access.lesson.title}`,
    materials: m.count > 0 ? m.text : undefined,
    count: m.count,
  };
}

// Resumo de um tópico (usa os materiais do professor da aula, quando houver)
router.post('/summarize', async (req: AuthRequest, res: Response) => {
  const data = parseBody(summarizeSchema, req.body, res);
  if (!data) return;
  try {
    const lesson = await lessonContext(data.lessonId, req.userId as string);
    if (!lesson.allowed) return res.status(404).json({ error: 'Lesson not found.' });

    const summary = await getAIService().summarize({
      topic: data.topic,
      context: lesson.context ?? data.context,
      language: data.language,
      materials: lesson.materials,
    });
    res.json({ summary, materialsUsed: lesson.count });
  } catch (error) {
    console.error('AI API Error:', error);
    res.status(500).json({ error: 'Failed to generate summary.' });
  }
});

// Conversa sobre a aula (perguntas de acompanhamento), com os materiais do professor como fonte
router.post('/chat', async (req: AuthRequest, res: Response) => {
  const data = parseBody(chatSchema, req.body, res);
  if (!data) return;
  try {
    const lesson = await lessonContext(data.lessonId, req.userId as string);
    if (!lesson.allowed) return res.status(404).json({ error: 'Lesson not found.' });

    const reply = await getAIService().chat({
      topic: data.message,
      message: data.message,
      history: data.history,
      context: lesson.context,
      language: data.language,
      materials: lesson.materials,
    });
    res.json({ reply, materialsUsed: lesson.count });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate answer.' });
  }
});

export default router;
