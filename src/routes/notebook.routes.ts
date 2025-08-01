// src/routes/notebook.routes.ts
import { Router, Request } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';
import mongoose from 'mongoose';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();
router.use(authMiddleware);

// GET: Buscar todos os cadernos do usuário logado
router.get('/', async (req: AuthRequest, res) => {
  try {
    const notebooks = await Notebook.find({ user: req.userId });
    const sanitizedNotebooks = notebooks.map(notebook => {
      const plainNotebook = notebook.toObject();
      if (!plainNotebook.lessons) {
        plainNotebook.lessons = [];
      }
      return plainNotebook;
    });
    res.json(sanitizedNotebooks);
  } catch (error) {
    console.error("ERRO DETALHADO AO BUSCAR CADERNOS:", error); 
    res.status(500).json({ error: 'Error fetching notebooks.' });
  }
});

// POST: Criar um novo caderno
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    const notebook = await Notebook.create({ title, user: req.userId, lessons: [] });
    res.status(201).json(notebook);
  } catch (error) {
    console.error('[CREATE NOTEBOOK] ERRO NO BLOCO CATCH:', error);
    res.status(400).json({ error: 'Error creating notebook.' });
  }
});

// PUT: Editar o título de um caderno
router.put('/:notebookId', async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    const notebook = await Notebook.findOneAndUpdate(
      { _id: req.params.notebookId, user: req.userId },
      { title },
      { new: true }
    );
    if (!notebook) return res.status(404).json({ error: 'Notebook not found.' });
    res.json(notebook);
  } catch (error) {
    res.status(400).json({ error: 'Error updating notebook.' });
  }
});

// DELETE: Deletar um caderno
router.delete('/:notebookId', async (req: AuthRequest, res) => {
    try {
        const deleted = await Notebook.findOneAndDelete({ _id: req.params.notebookId, user: req.userId });
        if (!deleted) return res.status(404).json({ error: 'Notebook not found.' });
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: 'Error deleting notebook.' });
    }
});

// POST: Adicionar uma nova aula a um caderno
router.post('/:notebookId/lessons', async (req: AuthRequest, res) => {
    try {
        const { title } = req.body;
        const notebook = await Notebook.findOne({ _id: req.params.notebookId, user: req.userId });
        if (!notebook) return res.status(404).json({ error: 'Notebook not found.' });
        const newLesson = { 
            _id: new mongoose.Types.ObjectId(), 
            title, 
            chatHistory: [], 
            quizzChatHistory: [], 
            quizzAttempts: [] 
        };
        notebook.lessons.push(newLesson as any);
        await notebook.save();
        res.json(notebook);
    } catch (error) {
        res.status(400).json({ error: 'Error adding lesson.' });
    }
});

// PUT: Editar o título de uma aula
router.put('/:notebookId/lessons/:lessonId', async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    const notebook = await Notebook.findOne({ _id: req.params.notebookId, user: req.userId });
    if (!notebook) return res.status(404).json({ error: 'Notebook not found.' });

    const lesson = notebook.lessons.id(req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    lesson.title = title;
    await notebook.save();
    res.json(notebook);
  } catch (error) {
    res.status(400).json({ error: 'Error updating lesson.' });
  }
});

// ✅ NOVA ROTA: DELETE - Deletar uma aula específica
router.delete('/:notebookId/lessons/:lessonId', async (req: AuthRequest, res) => {
  try {
    const notebook = await Notebook.findOne({ _id: req.params.notebookId, user: req.userId });
    if (!notebook) {
      return res.status(404).json({ error: 'Notebook not found.' });
    }

    // Puxa a aula para fora do array de aulas
    notebook.lessons.pull({ _id: req.params.lessonId });
    
    // Salva o caderno modificado
    await notebook.save();
    
    // Retorna o caderno atualizado para o frontend
    res.json(notebook);
  } catch (error) {
    res.status(400).json({ error: 'Error deleting lesson.' });
  }
});

export default router;