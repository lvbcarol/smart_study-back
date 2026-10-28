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
                                      .select('title lessons._id lessons.title lessons.quizzAttempts lessons.chatHistory');

    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });
    
    const lesson = notebook.lessons.find(l => l._id.toString() === req.params.lessonId);
    
    if (!lesson) return res.status(404).json({ error: 'Lesson not found within the notebook.' });

    res.json({
      notebookTitle: notebook.title,
      lessonTitle: lesson.title,
      quizzAttempts: lesson.quizzAttempts || [],
      chatHistory: lesson.chatHistory || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching lesson details.' });
  }
});

// POST: Salva uma nova tentativa de quizz (pontuação, histórico, perguntas e respostas)
router.post('/:lessonId/quizz-attempts', async (req: AuthRequest, res) => {
  const { score, chatHistory, quizData, userAnswers } = req.body;
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });

    const lesson = notebook.lessons.find(l => l._id.toString() === req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    lesson.quizzAttempts = lesson.quizzAttempts || [];
    const attemptNumber = lesson.quizzAttempts.length + 1;

    // ✅ CORREÇÃO AQUI: Adiciona a propriedade 'date' para satisfazer a tipagem do TypeScript.
    lesson.quizzAttempts.push({ 
        score, 
        chatHistory, 
        quizData, 
        userAnswers, 
        attemptNumber, 
        date: new Date() 
    });
    
    await notebook.save();
    
    res.status(201).json({ message: 'Quizz attempt saved successfully.' });
  } catch (error) {
    console.error("Error saving quizz attempt:", error);
    res.status(400).json({ error: 'Error saving quizz attempt.' });
  }
});

// PUT: Salva o histórico do chat de resumo
router.put('/:lessonId/chat', async (req: AuthRequest, res) => {
  const { messages } = req.body;
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });

    const lesson = notebook.lessons.find(l => l._id.toString() === req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
    
    lesson.chatHistory = messages;
    await notebook.save();
    res.status(200).json({ message: 'Conversation saved successfully.' });
  } catch (error) {
    res.status(400).json({ error: 'Error saving conversation.' });
  }
});

export default router;
