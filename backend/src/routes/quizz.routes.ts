// src/routes/quizz.routes.ts — quiz com correção no servidor
//
// Fluxo: POST /drafts (gera) -> POST /drafts/:id/answer (uma por pergunta) -> POST /drafts/:id/finish (grava a tentativa).
// O gabarito fica só no servidor: o aluno recebe a pergunta pública e, depois de responder, o resultado.
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import QuizAttempt from '../models/QuizAttempt';
import QuizDraft from '../models/QuizDraft';
import Task from '../models/Task';
import { AuthRequest } from '../types';
import { findLessonAccess } from '../services/access';
import { getAIService } from '../services/ai.service';
import { parseBody } from '../utils/validate';
import { buildMaterialsContext } from '../services/materials';
import { gradeAnswer, GradeResult } from '../quiz/grading';
import { answerSchemaFor, normalizeQuestion, Question, questionSchema, toPublic } from '../quiz/questions';
import { buildQuizPlan, decayed, errorRateByType, smoothedErrorRate } from '../quiz/weakness';
import { loadStats, recordResults } from '../quiz/weakness.service';
import { QUESTION_TYPES } from '../quiz/questions';

const router = Router();
router.use(authMiddleware);

const DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

const createSchema = z.object({
  lessonId: z.string(),
  topic: z.string().trim().min(1).max(200),
  language: z.string().max(10).default('pt'),
  count: z.number().int().min(4).max(12).default(8),
});

const answerBodySchema = z.object({ index: z.number().int().min(0), answer: z.unknown() });

async function findDraft(id: string, userId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return QuizDraft.findOne({ _id: id, user: userId });
}

// POST /drafts — gera um quiz adaptativo para a aula
router.post('/drafts', async (req: AuthRequest, res: Response) => {
  const data = parseBody(createSchema, req.body, res);
  if (!data) return;
  try {
    const access = await findLessonAccess(data.lessonId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Lesson not found.' });

    const allStats = await loadStats(req.userId as string);
    const lessonStats = allStats.length ? await loadStats(req.userId as string, String(access.lesson._id)) : [];
    const plan = buildQuizPlan({ count: data.count, allStats, lessonStats });

    const materials = await buildMaterialsContext(access.notebook._id, access.lesson._id);
    const generated = await getAIService().generateQuizz({
      topic: data.topic,
      context: `${access.notebook.title} - ${access.lesson.title}`,
      language: data.language,
      materials: materials.count > 0 ? materials.text : undefined,
      plan,
    });
    const questions = generated.map((q, i) => normalizeQuestion(questionSchema.parse(q), i));

    const draft = await QuizDraft.create({
      user: req.userId,
      notebook: access.notebook._id,
      lesson: access.lesson._id,
      topic: data.topic,
      language: data.language,
      questions,
      answers: questions.map(() => null),
      results: questions.map(() => null),
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    });

    res.status(201).json({
      draftId: draft._id,
      questions: questions.map(toPublic),
      reinforcing: plan.reinforce.map((r) => r.topic),
      materialsUsed: materials.count,
    });
  } catch (error) {
    console.error('QUIZ GENERATION FAILED:', error);
    res.status(502).json({ error: 'Failed to generate quizz.' });
  }
});

// POST /drafts/:id/answer — corrige uma pergunta e devolve o resultado (com gabarito e explicação)
router.post('/drafts/:id/answer', async (req: AuthRequest, res: Response) => {
  const body = parseBody(answerBodySchema, req.body, res);
  if (!body) return;
  try {
    const draft = await findDraft(req.params.id, req.userId as string);
    if (!draft) return res.status(404).json({ error: 'Quiz not found.' });
    if (body.index >= draft.questions.length) return res.status(400).json({ error: 'index: out of range' });
    if (draft.answers[body.index] !== null && draft.answers[body.index] !== undefined) {
      return res.status(409).json({ error: 'Question already answered.' });
    }

    const question = draft.questions[body.index] as Question;
    const parsedAnswer = answerSchemaFor(question).safeParse(body.answer);
    if (!parsedAnswer.success) return res.status(400).json({ error: 'answer: invalid format for this question type' });

    const result = await gradeAnswer(question, parsedAnswer.data, getAIService(), draft.language);

    // só grava se ninguém respondeu essa pergunta no meio tempo
    const saved = await QuizDraft.findOneAndUpdate(
      { _id: draft._id, [`answers.${body.index}`]: null },
      { $set: { [`answers.${body.index}`]: parsedAnswer.data, [`results.${body.index}`]: result } }
    );
    if (!saved) return res.status(409).json({ error: 'Question already answered.' });

    // em tarefas o aluno só vê o resultado depois de enviar tudo (e o servidor nunca o devolve antes)
    if (draft.task) return res.json({ saved: true });
    res.json({ result });
  } catch (error) {
    console.error('QUIZ ANSWER FAILED:', error);
    res.status(500).json({ error: 'Failed to grade answer.' });
  }
});

// POST /drafts/:id/finish — grava a tentativa e atualiza as deficiências do aluno
router.post('/drafts/:id/finish', async (req: AuthRequest, res: Response) => {
  try {
    const draft = await findDraft(req.params.id, req.userId as string);
    if (!draft) return res.status(404).json({ error: 'Quiz not found.' });
    if (draft.answers.some((a) => a === null || a === undefined)) {
      return res.status(400).json({ error: 'Answer all questions before finishing.' });
    }

    const questions = draft.questions as Question[];
    const results = draft.results as GradeResult[];
    const score = Math.round((results.reduce((sum, r) => sum + r.score, 0) / results.length) * 100);
    const task = draft.task ? await Task.findById(draft.task).lean() : null;
    const source = task ? 'task' : 'practice';
    // a numeração conta só os treinos; tarefas têm envio único
    const attemptNumber = task ? 1 : (await QuizAttempt.countDocuments({ user: req.userId, lesson: draft.lesson, source: 'practice' })) + 1;

    let attempt;
    try {
      attempt = await QuizAttempt.create({
        user: req.userId,
        notebook: draft.notebook,
        lesson: draft.lesson,
        task: task?._id,
        source,
        late: task?.dueDate ? new Date() > task.dueDate : undefined,
        attemptNumber,
        score,
        questions,
        answers: draft.answers,
        results,
      });
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ error: 'Task already submitted.' });
      throw error;
    }

    await recordResults(req.userId as string, draft.lesson, questions, results);
    await draft.deleteOne();

    res.status(201).json({
      attemptId: attempt._id,
      source,
      attemptNumber,
      score,
      correctCount: results.filter((r) => r.correct).length,
      total: results.length,
    });
  } catch (error) {
    console.error('QUIZ FINISH FAILED:', error);
    res.status(500).json({ error: 'Failed to save quizz attempt.' });
  }
});

// GET /weakness?lessonId= — pontos fracos do aluno (por tipo de pergunta e por tópico)
router.get('/weakness', async (req: AuthRequest, res: Response) => {
  try {
    const lessonId = typeof req.query.lessonId === 'string' ? req.query.lessonId : undefined;
    if (lessonId && !mongoose.isValidObjectId(lessonId)) return res.status(400).json({ error: 'lessonId: invalid' });

    const now = new Date();
    const stats = await loadStats(req.userId as string, lessonId);
    const byType = errorRateByType(stats, now);

    const types = QUESTION_TYPES.filter((t) => byType[t].seen >= 0.5).map((t) => ({
      type: t, errorRate: Math.round(byType[t].rate * 100), seen: Math.round(byType[t].seen),
    }));

    const topics = stats
      .map((s) => {
        const d = decayed(s, now);
        return { topic: s.topic, type: s.type, seen: d.seen, errorRate: smoothedErrorRate(d.seen, d.wrong), needsReview: s.misses.length > 0 };
      })
      .filter((t) => t.seen >= 0.5)
      .sort((a, b) => Number(b.needsReview) - Number(a.needsReview) || b.errorRate - a.errorRate)
      .slice(0, 8)
      .map((t) => ({ ...t, errorRate: Math.round(t.errorRate * 100), seen: Math.round(t.seen) }));

    res.json({ types: types.sort((a, b) => b.errorRate - a.errorRate), topics });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load weakness data.' });
  }
});

export default router;
