// src/routes/lesson.routes.ts
import { Router, Request } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';

interface AuthRequest extends Request {
  userId?: string;
}

// ✅ CORREÇÃO: A linha abaixo foi movida para ANTES de ser usada.
const router = Router();
router.use(authMiddleware);

// Rota para buscar detalhes da aula
router.get('/:lessonId', async (req: AuthRequest, res) => {
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });
    const lesson = notebook.lessons.id(req.params.lessonId);
    res.json({
      notebookTitle: notebook.title,
      lessonTitle: lesson?.title,
      chatHistory: lesson?.chatHistory || [],
      quizzChatHistory: lesson?.quizzChatHistory || [],
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching lesson details.' });
  }
});

// Rota para salvar o histórico do chat de resumo
router.put('/:lessonId/chat', async (req: AuthRequest, res) => {
  const { messages } = req.body;
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });
    const lesson = notebook.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
    lesson.chatHistory = messages;
    await notebook.save();
    res.status(200).json({ message: 'Conversation saved successfully.' });
  } catch (error) {
    res.status(400).json({ error: 'Error saving conversation.' });
  }
});

// Rota para salvar o histórico do chat do quizz
router.put('/:lessonId/quizz-chat', async (req: AuthRequest, res) => {
  const { messages } = req.body;
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });

    const lesson = notebook.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    lesson.quizzChatHistory = messages;
    await notebook.save();
    
    res.status(200).json({ message: 'Quizz conversation saved successfully.' });
  } catch (error) {
    res.status(400).json({ error: 'Error saving quizz conversation.' });
  }
});

// Rota para salvar a pontuação do quizz
router.post('/:lessonId/quizz-attempts', async (req: AuthRequest, res) => {
  const { score, mistakes } = req.body;
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });

    const lesson = notebook.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    lesson.quizzAttempts = lesson.quizzAttempts || [];
    lesson.quizzAttempts.push({ score, mistakes });
    await notebook.save();
    
    res.status(200).json({ message: 'Quizz attempt saved successfully.' });
  } catch (error) {
    console.error("Error saving quizz attempt:", error);
    res.status(400).json({ error: 'Error saving quizz attempt.' });
  }
});

export default router;