// src/routes/material.routes.ts — materiais de apoio de um caderno (montado em /api/notebooks/:notebookId/materials)
//
// Leitura da lista: dono e alunos matriculados. Envio e exclusão: só o dono do caderno.
import { Router, Response, Request, NextFunction } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import Material from '../models/Material';
import { AuthRequest } from '../types';
import { findNotebookAccess } from '../services/access';
import { ExtractionError, extractText, limitText, cleanText, ALLOWED_EXTENSIONS } from '../services/materials';
import { parseBody } from '../utils/validate';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

const textSchema = z.object({
  title: z.string().trim().min(1, 'Título obrigatório.').max(150),
  text: z.string().min(1, 'Texto obrigatório.').max(1_000_000),
  lessonId: z.string().optional(),
});

const metadata = (m: any, lessonTitles: Map<string, string>) => ({
  _id: m._id,
  title: m.title,
  kind: m.kind,
  fileName: m.fileName,
  charCount: m.charCount,
  truncated: m.truncated,
  lesson: m.lesson ?? null,
  lessonTitle: m.lesson ? lessonTitles.get(m.lesson.toString()) ?? null : null,
  createdAt: m.createdAt,
});

// Confere se a aula informada pertence ao caderno
const validLesson = (notebook: { lessons: { _id: any }[] }, lessonId?: string) =>
  !lessonId || (mongoose.isValidObjectId(lessonId) && notebook.lessons.some((l) => l._id.toString() === lessonId));

// GET / — lista (sem o texto)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const access = await findNotebookAccess(req.params.notebookId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Notebook not found.' });

    const materials = await Material.find({ notebook: access.notebook._id }).select('-extractedText').sort({ createdAt: 1 }).lean();
    const lessonTitles = new Map(access.notebook.lessons.map((l) => [l._id.toString(), l.title]));
    res.json(materials.map((m) => metadata(m, lessonTitles)));
  } catch {
    res.status(500).json({ error: 'Error fetching materials.' });
  }
});

// GET /:id — prévia do texto extraído (só o dono)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const access = await findNotebookAccess(req.params.notebookId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Notebook not found.' });
    if (!access.canWrite) return res.status(403).json({ error: 'Only the notebook owner can view the material text.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Material not found.' });

    const material = await Material.findOne({ _id: req.params.id, notebook: access.notebook._id }).lean();
    if (!material) return res.status(404).json({ error: 'Material not found.' });
    res.json({ _id: material._id, title: material.title, preview: material.extractedText.slice(0, 5000), charCount: material.charCount });
  } catch {
    res.status(500).json({ error: 'Error fetching material.' });
  }
});

// POST /text — texto colado
router.post('/text', async (req: AuthRequest, res: Response) => {
  const data = parseBody(textSchema, req.body, res);
  if (!data) return;
  try {
    const access = await findNotebookAccess(req.params.notebookId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Notebook not found.' });
    if (!access.canWrite) return res.status(403).json({ error: 'Only the notebook owner can add materials.' });
    if (!validLesson(access.notebook, data.lessonId)) return res.status(400).json({ error: 'lessonId: not part of this notebook' });

    const cleaned = cleanText(data.text);
    if (!cleaned) return res.status(400).json({ error: 'text: empty' });
    const { text, truncated } = limitText(cleaned);

    const material = await Material.create({
      notebook: access.notebook._id, lesson: data.lessonId, title: data.title, kind: 'text',
      extractedText: text, charCount: text.length, truncated, uploadedBy: req.userId,
    });
    res.status(201).json(metadata(material.toObject(), new Map(access.notebook.lessons.map((l) => [l._id.toString(), l.title]))));
  } catch {
    res.status(500).json({ error: 'Error saving material.' });
  }
});

// POST /file — PDF, DOCX, TXT ou MD (multipart: campo "file", opcionais "title" e "lessonId")
const receiveFile = (req: Request, res: Response, next: NextFunction) =>
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB).` });
    }
    return res.status(400).json({ error: 'Invalid upload.' });
  });

router.post('/file', receiveFile, async (req: AuthRequest, res: Response) => {
  try {
    const access = await findNotebookAccess(req.params.notebookId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Notebook not found.' });
    if (!access.canWrite) return res.status(403).json({ error: 'Only the notebook owner can add materials.' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: `file: required (${ALLOWED_EXTENSIONS.join(', ')})` });

    const lessonId = typeof req.body.lessonId === 'string' && req.body.lessonId ? req.body.lessonId : undefined;
    if (!validLesson(access.notebook, lessonId)) return res.status(400).json({ error: 'lessonId: not part of this notebook' });

    // o multer entrega o nome em latin1; recupera acentos
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const title = (typeof req.body.title === 'string' && req.body.title.trim()) || fileName.replace(/\.[^.]+$/, '');

    let extracted;
    try {
      extracted = await extractText(file.buffer, fileName);
    } catch (error) {
      if (error instanceof ExtractionError) {
        return res.status(error.code === 'UNSUPPORTED' ? 415 : 422).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    const material = await Material.create({
      notebook: access.notebook._id, lesson: lessonId, title: title.slice(0, 150), kind: 'file', fileName,
      extractedText: extracted.text, charCount: extracted.text.length, truncated: extracted.truncated, uploadedBy: req.userId,
    });
    res.status(201).json(metadata(material.toObject(), new Map(access.notebook.lessons.map((l) => [l._id.toString(), l.title]))));
  } catch (error) {
    console.error('MATERIAL UPLOAD FAILED:', error);
    res.status(500).json({ error: 'Error saving material.' });
  }
});

// DELETE /:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const access = await findNotebookAccess(req.params.notebookId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Notebook not found.' });
    if (!access.canWrite) return res.status(403).json({ error: 'Only the notebook owner can delete materials.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Material not found.' });

    const deleted = await Material.findOneAndDelete({ _id: req.params.id, notebook: access.notebook._id });
    if (!deleted) return res.status(404).json({ error: 'Material not found.' });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error deleting material.' });
  }
});

export default router;
