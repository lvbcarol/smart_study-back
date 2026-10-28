import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import QuizAttempt from '../models/QuizAttempt';
import ChatSession from '../models/ChatSession';
import { AuthRequest } from '../types';
import { findLessonAccess } from '../services/access';
import { parseBody } from '../utils/validate';

const router = Router();
router.use(authMiddleware);

const attemptSchema = z.object({
  score: z.number().min(0).max(100),
  chatHistory: z.array(z.any()).default([]),
  quizData: z.array(z.any()),
  userAnswers: z.array(z.any()),
});

const chatSchema = z.object({
  messages: z.array(z.object({ sender: z.enum(['user', 'bot']), text: z.string() })).max(500),
});

// GET: Busca detalhes da aula, incluindo as tentativas de quizz e o chat do próprio usuário
router.get('/:lessonId', async (req: AuthRequest, res: Response) => {
  try {
    const access = await findLessonAccess(req.params.lessonId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Lesson not found.' });

    const [attempts, chat] = await Promise.all([
      QuizAttempt.find({ user: req.userId, lesson: access.lesson._id }).sort({ createdAt: 1 }).lean(),
      ChatSession.findOne({ user: req.userId, lesson: access.lesson._id }).lean(),
    ]);

    res.json({
      notebookTitle: access.notebook.title,
      lessonTitle: access.lesson.title,
      readOnly: !access.canWrite,
      quizzAttempts: attempts.map((a) => ({
        _id: a._id,
        attemptNumber: a.attemptNumber,
        score: a.score,
        date: a.createdAt,
        quizData: a.questions,
        userAnswers: a.answers,
        chatHistory: a.transcript,
      })),
      chatHistory: chat?.messages ?? [],
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching lesson details.' });
  }
});

// POST: Salva uma nova tentativa de quizz
// (a correção no servidor entra junto com os novos tipos de pergunta)
router.post('/:lessonId/quizz-attempts', async (req: AuthRequest, res: Response) => {
  const data = parseBody(attemptSchema, req.body, res);
  if (!data) return;
  try {
    const access = await findLessonAccess(req.params.lessonId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Lesson not found.' });

    const attemptNumber = (await QuizAttempt.countDocuments({ user: req.userId, lesson: access.lesson._id })) + 1;
    await QuizAttempt.create({
      user: req.userId,
      notebook: access.notebook._id,
      lesson: access.lesson._id,
      source: 'practice',
      attemptNumber,
      score: data.score,
      questions: data.quizData,
      answers: data.userAnswers,
      transcript: data.chatHistory,
    });

    res.status(201).json({ message: 'Quizz attempt saved successfully.' });
  } catch (error) {
    console.error('Error saving quizz attempt:', error);
    res.status(400).json({ error: 'Error saving quizz attempt.' });
  }
});

// PUT: Salva o histórico do chat de resumo
router.put('/:lessonId/chat', async (req: AuthRequest, res: Response) => {
  const data = parseBody(chatSchema, req.body, res);
  if (!data) return;
  try {
    const access = await findLessonAccess(req.params.lessonId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Lesson not found.' });

    await ChatSession.findOneAndUpdate(
      { user: req.userId, lesson: access.lesson._id },
      { $set: { messages: data.messages } },
      { upsert: true }
    );
    res.status(200).json({ message: 'Conversation saved successfully.' });
  } catch (error) {
    res.status(400).json({ error: 'Error saving conversation.' });
  }
});

export default router;
