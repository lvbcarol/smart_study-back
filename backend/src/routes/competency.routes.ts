// src/routes/competency.routes.ts — competências de uma matéria (montado em /api/notebooks/:notebookId/competencies)
//
// Leitura: dono e alunos matriculados. Criação e exclusão: só o dono (professor) do caderno.
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import Competency from '../models/Competency';
import { findNotebookAccess } from '../services/access';
import { AuthRequest } from '../types';
import { parseBody } from '../utils/validate';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

const MAX_PER_NOTEBOOK = 30;
const createSchema = z.object({ name: z.string().trim().min(1, 'Nome obrigatório.').max(80) });

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const access = await findNotebookAccess(req.params.notebookId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Notebook not found.' });
    const items = await Competency.find({ notebook: access.notebook._id }).sort({ createdAt: 1 }).lean();
    res.json(items.map((c) => ({ _id: c._id, name: c.name })));
  } catch {
    res.status(500).json({ error: 'Error fetching competencies.' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const data = parseBody(createSchema, req.body, res);
  if (!data) return;
  try {
    const access = await findNotebookAccess(req.params.notebookId, req.userId as string);
    if (!access?.canWrite) return res.status(404).json({ error: 'Notebook not found.' });
    if ((await Competency.countDocuments({ notebook: access.notebook._id })) >= MAX_PER_NOTEBOOK) {
      return res.status(400).json({ error: `At most ${MAX_PER_NOTEBOOK} competencies per subject.` });
    }
    const created = await Competency.create({ notebook: access.notebook._id, name: data.name, createdBy: req.userId });
    res.status(201).json({ _id: created._id, name: created.name });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return res.status(409).json({ error: 'This competency already exists.' });
    res.status(500).json({ error: 'Error creating competency.' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const access = await findNotebookAccess(req.params.notebookId, req.userId as string);
    if (!access?.canWrite || !mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Competency not found.' });
    const result = await Competency.deleteOne({ _id: req.params.id, notebook: access.notebook._id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Competency not found.' });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error deleting competency.' });
  }
});

export default router;
