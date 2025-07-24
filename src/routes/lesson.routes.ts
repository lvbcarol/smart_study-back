// src/routes/lesson.routes.ts
import { Router, Request } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();
router.use(authMiddleware);

// GET: Busca detalhes da aula, incluindo todas as tentativas de quizz
router.get('/:lessonId', async (req: AuthRequest, res) => {
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId })
                                     .select('title lessons._id lessons.title lessons.quizzAttempts');

    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });
    const lesson = notebook.lessons.id(req.params.lessonId);
    
    res.json({
      notebookTitle: notebook.title,
      lessonTitle: lesson?.title,
      // ✅ Retorna o 'quizzAttempts' que agora contém o histórico
      quizzAttempts: lesson?.quizzAttempts || [],
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching lesson details.' });
  }
});

// POST: Salva uma nova tentativa de quizz (pontuação E histórico)
router.post('/:lessonId/quizz-attempts', async (req: AuthRequest, res) => {
  // ✅ Agora recebe 'score' e 'chatHistory'
  const { score, chatHistory } = req.body;
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });

    const lesson = notebook.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    lesson.quizzAttempts = lesson.quizzAttempts || [];
    const attemptNumber = lesson.quizzAttempts.length + 1;

    // Salva o objeto completo da tentativa
    lesson.quizzAttempts.push({ score, chatHistory, attemptNumber });
    await notebook.save();
    
    res.status(201).json({ message: 'Quizz attempt saved successfully.' });
  } catch (error) {
    console.error("Error saving quizz attempt:", error);
    res.status(400).json({ error: 'Error saving quizz attempt.' });
  }
});

// A rota PUT /chat para o resumo continua a mesma
router.put('/:lessonId/chat', async (req: AuthRequest, res) => { /* ... código existente ... */ });

export default router;