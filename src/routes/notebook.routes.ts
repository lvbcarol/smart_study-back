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

// GET: Buscar todos os cadernos
router.get('/', async (req: AuthRequest, res) => {
  try {
    const notebooks = await Notebook.find({ user: req.userId });
    res.json(notebooks);
  } catch (error) {
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
    res.status(400).json({ error: 'Error creating notebook.' });
  }
});

// ✅ NOVO: PUT - Editar o título de um caderno
router.put('/:notebookId', async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    const notebook = await Notebook.findOneAndUpdate(
      { _id: req.params.notebookId, user: req.userId }, // Garante que o usuário só pode editar seus próprios cadernos
      { title },
      { new: true } // Retorna o documento atualizado
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
        await Notebook.findOneAndDelete({ _id: req.params.notebookId, user: req.userId });
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: 'Error deleting notebook.' });
    }
});


// POST: Adicionar uma nova aula
router.post('/:notebookId/lessons', async (req: AuthRequest, res) => {
    try {
        const { title } = req.body;
        const notebook = await Notebook.findOne({ _id: req.params.notebookId, user: req.userId });
        if (!notebook) return res.status(404).json({ error: 'Notebook not found.' });

        const newLesson = { _id: new mongoose.Types.ObjectId(), title };
        notebook.lessons.push(newLesson as any);
        await notebook.save();
        res.json(notebook);
    } catch (error) {
        res.status(400).json({ error: 'Error adding lesson.' });
    }
});

// ✅ NOVO: PUT - Editar o título de uma aula
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

export default router;