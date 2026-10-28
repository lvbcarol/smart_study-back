import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';
import Turma from '../models/Turma';
import QuizAttempt from '../models/QuizAttempt';
import ChatSession from '../models/ChatSession';
import { AuthRequest } from '../types';
import { accessibleNotebooksFilter } from '../services/access';
import { parseBody } from '../utils/validate';

const router = Router();
router.use(authMiddleware);

const titleSchema = z.object({ title: z.string().trim().min(1, 'Título obrigatório.').max(120) });
const createSchema = titleSchema.extend({ turma: z.string().optional() });

// Apaga chat e tentativas ligados às aulas removidas
async function cascadeLessons(lessonIds: mongoose.Types.ObjectId[]) {
  if (lessonIds.length === 0) return;
  await Promise.all([
    QuizAttempt.deleteMany({ lesson: { $in: lessonIds } }),
    ChatSession.deleteMany({ lesson: { $in: lessonIds } }),
  ]);
}

// GET: Buscar os cadernos que o usuário pode ler (próprios + cadernos das turmas em que está matriculado)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter = await accessibleNotebooksFilter(req.userId as string);
    const notebooks = await Notebook.find(filter).sort({ createdAt: 1 }).lean();

    // Resumo (sem perguntas/respostas) das tentativas do próprio usuário, por aula
    const attempts = await QuizAttempt.find({ user: req.userId, notebook: { $in: notebooks.map((n) => n._id) } })
      .select('lesson attemptNumber score createdAt')
      .sort({ createdAt: 1 })
      .lean();
    const byLesson = new Map<string, { _id: unknown; attemptNumber: number; score: number; date: Date }[]>();
    for (const a of attempts) {
      const key = a.lesson.toString();
      const list = byLesson.get(key) ?? [];
      list.push({ _id: a._id, attemptNumber: a.attemptNumber, score: a.score, date: a.createdAt });
      byLesson.set(key, list);
    }

    res.json(
      notebooks.map((n) => ({
        ...n,
        readOnly: n.owner.toString() !== req.userId,
        lessons: (n.lessons ?? []).map((l) => ({ ...l, quizzAttempts: byLesson.get(l._id.toString()) ?? [] })),
      }))
    );
  } catch (error) {
    console.error('ERRO DETALHADO AO BUSCAR CADERNOS:', error);
    res.status(500).json({ error: 'Error fetching notebooks.' });
  }
});

// POST: Criar um novo caderno (com `turma`, vira caderno do professor dessa turma)
router.post('/', async (req: AuthRequest, res: Response) => {
  const data = parseBody(createSchema, req.body, res);
  if (!data) return;
  try {
    if (data.turma) {
      const turma = mongoose.isValidObjectId(data.turma)
        ? await Turma.findOne({ _id: data.turma, teacher: req.userId })
        : null;
      if (!turma) return res.status(404).json({ error: 'Turma not found.' });
    }
    const notebook = await Notebook.create({ title: data.title, owner: req.userId, turma: data.turma, lessons: [] });
    res.status(201).json(notebook);
  } catch (error) {
    console.error('[CREATE NOTEBOOK] ERRO:', error);
    res.status(400).json({ error: 'Error creating notebook.' });
  }
});

// PUT: Editar o título de um caderno (somente o dono)
router.put('/:notebookId', async (req: AuthRequest, res: Response) => {
  const data = parseBody(titleSchema, req.body, res);
  if (!data) return;
  try {
    const notebook = await Notebook.findOneAndUpdate(
      { _id: req.params.notebookId, owner: req.userId },
      { title: data.title },
      { new: true }
    );
    if (!notebook) return res.status(404).json({ error: 'Notebook not found.' });
    res.json(notebook);
  } catch (error) {
    res.status(400).json({ error: 'Error updating notebook.' });
  }
});

// DELETE: Deletar um caderno (somente o dono)
router.delete('/:notebookId', async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await Notebook.findOneAndDelete({ _id: req.params.notebookId, owner: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Notebook not found.' });
    await cascadeLessons(deleted.lessons.map((l) => l._id));
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Error deleting notebook.' });
  }
});

// POST: Adicionar uma nova aula a um caderno
router.post('/:notebookId/lessons', async (req: AuthRequest, res: Response) => {
  const data = parseBody(titleSchema, req.body, res);
  if (!data) return;
  try {
    const notebook = await Notebook.findOneAndUpdate(
      { _id: req.params.notebookId, owner: req.userId },
      { $push: { lessons: { title: data.title } } },
      { new: true }
    );
    if (!notebook) return res.status(404).json({ error: 'Notebook not found.' });
    res.json(notebook);
  } catch (error) {
    res.status(400).json({ error: 'Error adding lesson.' });
  }
});

// PUT: Editar o título de uma aula
router.put('/:notebookId/lessons/:lessonId', async (req: AuthRequest, res: Response) => {
  const data = parseBody(titleSchema, req.body, res);
  if (!data) return;
  try {
    const notebook = await Notebook.findOneAndUpdate(
      { _id: req.params.notebookId, owner: req.userId, 'lessons._id': req.params.lessonId },
      { $set: { 'lessons.$.title': data.title } },
      { new: true }
    );
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });
    res.json(notebook);
  } catch (error) {
    res.status(400).json({ error: 'Error updating lesson.' });
  }
});

// DELETE: Deletar uma aula específica
router.delete('/:notebookId/lessons/:lessonId', async (req: AuthRequest, res: Response) => {
  try {
    const notebook = await Notebook.findOneAndUpdate(
      { _id: req.params.notebookId, owner: req.userId, 'lessons._id': req.params.lessonId },
      { $pull: { lessons: { _id: req.params.lessonId } } },
      { new: true }
    );
    if (!notebook) return res.status(404).json({ error: 'Lesson not found.' });
    await cascadeLessons([new mongoose.Types.ObjectId(req.params.lessonId)]);
    res.json(notebook);
  } catch (error) {
    res.status(400).json({ error: 'Error deleting lesson.' });
  }
});

export default router;
