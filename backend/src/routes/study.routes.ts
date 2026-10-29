// src/routes/study.routes.ts — tempo de estudo, meta semanal e plano do dia
import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import StudyPlan from '../models/StudyPlan';
import StudySession, { SESSION_KINDS } from '../models/StudySession';
import Usuario from '../models/Usuario';
import { findLessonAccess } from '../services/access';
import { clampOffset, localDay } from '../study/dates';
import { loadPlanInput } from '../study/planData';
import { buildStudyPlan } from '../study/planner';
import { studyWeek } from '../study/week';
import { AuthRequest } from '../types';
import { parseBody } from '../utils/validate';

const router = Router();
router.use(authMiddleware, requireRole('student'));

const MAX_SESSION_SECONDS = 4 * 60 * 60;
const MAX_SESSION_AGE_MS = 36 * 60 * 60 * 1000;

const sessionSchema = z.object({
  kind: z.enum(SESSION_KINDS),
  lessonId: z.string().optional(),
  seconds: z.number().int().min(1).max(MAX_SESSION_SECONDS),
  startedAt: z.string().datetime({ offset: true }).optional(),
  tzOffset: z.number().optional(),
});

const planSchema = z.object({
  minutes: z.number().int().min(5).max(480),
  language: z.string().max(10).optional(),
  tzOffset: z.number().optional(),
});

const blockSchema = z.object({ done: z.boolean(), tzOffset: z.number().optional() });

const offsetFrom = (q: unknown) => clampOffset(typeof q === 'string' ? q : undefined);

// POST /sessions — registra um período de estudo
router.post('/sessions', async (req: AuthRequest, res: Response) => {
  const data = parseBody(sessionSchema, req.body, res);
  if (!data) return;
  try {
    const now = Date.now();
    const startedAt = data.startedAt ? new Date(data.startedAt) : new Date(now - data.seconds * 1000);
    if (startedAt.getTime() > now + 60_000) return res.status(400).json({ error: 'startedAt: cannot be in the future' });
    if (now - startedAt.getTime() > MAX_SESSION_AGE_MS) return res.status(400).json({ error: 'startedAt: too old' });

    let notebook: Types.ObjectId | undefined;
    let lesson: Types.ObjectId | undefined;
    if (data.lessonId) {
      const access = await findLessonAccess(data.lessonId, req.userId as string);
      if (!access) return res.status(404).json({ error: 'Lesson not found.' });
      notebook = access.notebook._id as Types.ObjectId;
      lesson = access.lesson._id as Types.ObjectId;
    }
    await StudySession.create({
      user: req.userId, kind: data.kind, notebook, lesson, startedAt, seconds: data.seconds,
      day: localDay(startedAt, clampOffset(data.tzOffset)),
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error saving session.' });
  }
});

// GET /week?tzOffset= — minutos por dia nos últimos 7 dias, por atividade e por matéria, e a meta
router.get('/week', async (req: AuthRequest, res: Response) => {
  try {
    res.json(await studyWeek(req.userId as string, offsetFrom(req.query.tzOffset)));
  } catch {
    res.status(500).json({ error: 'Error fetching study time.' });
  }
});

// GET /plan?tzOffset= — plano de hoje (null se ainda não foi montado)
router.get('/plan', async (req: AuthRequest, res: Response) => {
  try {
    const day = localDay(new Date(), offsetFrom(req.query.tzOffset));
    res.json({ plan: await StudyPlan.findOne({ user: req.userId, day }).lean() });
  } catch {
    res.status(500).json({ error: 'Error fetching plan.' });
  }
});

// POST /plan — monta (ou refaz) o plano de hoje para o tempo informado
router.post('/plan', async (req: AuthRequest, res: Response) => {
  const data = parseBody(planSchema, req.body, res);
  if (!data) return;
  try {
    const now = new Date();
    const user = await Usuario.findById(req.userId).select('language').lean();
    const input = await loadPlanInput(req.userId as string, data.minutes, data.language ?? user?.language, now);
    const { intro, blocks } = buildStudyPlan(input);
    const day = localDay(now, clampOffset(data.tzOffset));
    const plan = await StudyPlan.findOneAndUpdate(
      { user: req.userId, day },
      { $set: { minutes: data.minutes, intro, blocks: blocks.map((b) => ({ ...b, done: false })) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    res.status(201).json({ plan });
  } catch {
    res.status(500).json({ error: 'Error building plan.' });
  }
});

// PUT /plan/blocks/:blockId — marca um bloco do plano de hoje como feito (ou desmarca)
router.put('/plan/blocks/:blockId', async (req: AuthRequest, res: Response) => {
  const data = parseBody(blockSchema, req.body, res);
  if (!data) return;
  try {
    const day = localDay(new Date(), clampOffset(data.tzOffset));
    const plan = await StudyPlan.findOneAndUpdate(
      { user: req.userId, day, 'blocks.id': req.params.blockId },
      { $set: { 'blocks.$.done': data.done } },
      { new: true }
    ).lean();
    if (!plan) return res.status(404).json({ error: 'Block not found.' });
    res.json({ plan });
  } catch {
    res.status(500).json({ error: 'Error updating plan.' });
  }
});

export default router;
