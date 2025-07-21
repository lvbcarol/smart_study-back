// src/routes/notebook.routes.ts
import { Router, Request } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();

// Aplica o middleware a todas as rotas deste arquivo
router.use(authMiddleware);

// GET: Buscar todos os cadernos do usuário logado
router.get('/', async (req: AuthRequest, res) => {
  try {
    const notebooks = await Notebook.find({ user: req.userId });
    res.json(notebooks);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar cadernos.' });
  }
});

// POST: Criar um novo caderno
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    const notebook = await Notebook.create({ title, user: req.userId, lessons: [] });
    res.status(201).json(notebook);
  } catch (error) {
    res.status(400).json({ error: 'Erro ao criar caderno.' });
  }
});

// POST: Adicionar uma nova aula a um caderno
router.post('/:notebookId/lessons', async (req, res) => {
    try {
        const { title } = req.body;
        const notebook = await Notebook.findById(req.params.notebookId);
        if (!notebook) return res.status(404).json({ error: 'Caderno não encontrado.' });

        notebook.lessons.push({ title });
        await notebook.save();
        res.json(notebook);
    } catch (error) {
        res.status(400).json({ error: 'Erro ao adicionar aula.' });
    }
});

// DELETE: Deletar um caderno
router.delete('/:notebookId', async (req, res) => {
    try {
        await Notebook.findByIdAndDelete(req.params.notebookId);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: 'Erro ao deletar caderno.' });
    }
});

export default router;