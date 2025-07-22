// src/routes/lesson.routes.ts
import { Router, Request } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';

// ... (interface AuthRequest)
const router = Router();
router.use(authMiddleware);

// GET: Buscar os detalhes da aula (AGORA INCLUI O CHAT)
router.get('/:lessonId', async (req: AuthRequest, res) => {
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });

    const lesson = notebook.lessons.id(req.params.lessonId);
    res.json({
      notebookTitle: notebook.title,
      lessonTitle: lesson?.title,
      chatHistory: lesson?.chatHistory || [], // Retorna o histórico ou um array vazio
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching lesson details.' });
  }
});

// ✅ NOVA ROTA: PUT para salvar o histórico do chat
router.put('/:lessonId/chat', async (req: AuthRequest, res) => {
  const { messages } = req.body;
  try {
    const notebook = await Notebook.findOne({ 'lessons._id': req.params.lessonId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });

    const lesson = notebook.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    lesson.chatHistory = messages; // Salva o array de mensagens
    await notebook.save();
    
    res.status(200).json({ message: 'Conversation saved successfully.' });
  } catch (error) {
    res.status(400).json({ error: 'Error saving conversation.' });
  }
});

export default router;