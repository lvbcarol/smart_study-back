import { Router, Request, Response } from 'express';
import Notebook from '../models/Notebook';

const router = Router();

// Criar novo notebook
router.post('/', async function (req: Request, res: Response){
  const { usuarioId, titulo } = req.body;
  try {
    const novoNotebook = await Notebook.create({ usuarioId, titulo, aulas: [] });
    res.status(201).json(novoNotebook);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar notebook.' });
  }
});

// Buscar notebooks por usuário
router.get('/:usuarioId', async (req: Request, res: Response) => {
  try {
    const notebooks = await Notebook.find({ usuarioId: req.params.usuarioId });
    res.json(notebooks);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar notebooks.' });
  }
});

// Adicionar aula
router.post('/:notebookId/aulas', async (req: Request, res: Response) => {
  const { titulo } = req.body;
  try {
    const notebook = await Notebook.findById(req.params.notebookId);
    if (!notebook) return res.status(404).json({ erro: 'Notebook não encontrado.' });

    notebook.aulas.push(titulo);
    await notebook.save();
    res.json(notebook);
  } catch {
    res.status(500).json({ erro: 'Erro ao adicionar aula.' });
  }
});

// Editar título do notebook
router.put('/:notebookId', async (req: Request, res: Response) => {
  const { titulo } = req.body;
  try {
    const notebook = await Notebook.findByIdAndUpdate(req.params.notebookId, { titulo }, { new: true });
    res.json(notebook);
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar notebook.' });
  }
});

// Deletar notebook
router.delete('/:notebookId', async (req: Request, res: Response) => {
  try {
    await Notebook.findByIdAndDelete(req.params.notebookId);
    res.json({ mensagem: 'Notebook deletado com sucesso.' });
  } catch {
    res.status(500).json({ erro: 'Erro ao deletar notebook.' });
  }
});

// Editar aula
router.put('/:notebookId/aulas/:index', async (req: Request, res: Response) => {
  const { titulo } = req.body;
  try {
    const notebook = await Notebook.findById(req.params.notebookId);
    if (!notebook) return res.status(404).json({ erro: 'Notebook não encontrado.' });

    const idx = parseInt(req.params.index);
    notebook.aulas[idx] = titulo;
    await notebook.save();
    res.json(notebook);
  } catch {
    res.status(500).json({ erro: 'Erro ao editar aula.' });
  }
});

// Deletar aula
router.delete('/:notebookId/aulas/:index', async function(req: Request, res: Response) {
  try {
    const notebook = await Notebook.findById(req.params.notebookId);
    if (!notebook) return res.status(404).json({ erro: 'Notebook não encontrado.' });

    notebook.aulas.splice(parseInt(req.params.index), 1);
    await notebook.save();
    res.json(notebook);
  } catch {
    res.status(500).json({ erro: 'Erro ao remover aula.' });
  }
});

export default router;
