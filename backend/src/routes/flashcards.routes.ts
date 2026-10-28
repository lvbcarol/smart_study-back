// src/routes/flashcards.routes.ts — flashcards gerados por IA, com repetição espaçada (Leitner)
//
// Cada aluno tem um baralho por aula. "Gerar" cria o baralho ou acrescenta cartões novos (sem repetir).
// A sessão devolve só os cartões que vencem agora; cada revisão ("lembrei"/"não lembrei") reagenda o cartão.
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import FlashcardDeck, { IFlashcardDeck } from '../models/FlashcardDeck';
import Notebook from '../models/Notebook';
import { AuthRequest } from '../types';
import { findLessonAccess } from '../services/access';
import { getAIService } from '../services/ai.service';
import { buildMaterialsContext } from '../services/materials';
import { parseBody } from '../utils/validate';
import { normalizeText } from '../quiz/grading';
import { newCardState, orderForSession, review, summarize } from '../flashcards/leitner';

const router = Router();
router.use(authMiddleware);

const MAX_CARDS_PER_DECK = 120;

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.AI_RATE_LIMIT) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Try again in a minute.' },
});

const generateSchema = z.object({
  lessonId: z.string(),
  topic: z.string().trim().min(1).max(200),
  language: z.string().max(10).default('pt'),
  count: z.number().int().min(3).max(20).default(10),
});

const reviewSchema = z.object({ cardId: z.string(), remembered: z.boolean() });

const validId = (id: string) => mongoose.isValidObjectId(id);

async function titlesFor(decks: IFlashcardDeck[]) {
  const notebooks = await Notebook.find({ _id: { $in: decks.map((d) => d.notebook) } }).select('title lessons').lean();
  const byId = new Map(notebooks.map((n) => [String(n._id), n]));
  return (deck: IFlashcardDeck) => {
    const nb = byId.get(String(deck.notebook));
    return { notebookTitle: nb?.title, lessonTitle: nb?.lessons.find((l) => String(l._id) === String(deck.lesson))?.title };
  };
}

const deckSummary = (deck: IFlashcardDeck, titles: { notebookTitle?: string; lessonTitle?: string }, now: Date) => ({
  _id: deck._id, lessonId: deck.lesson, notebookId: deck.notebook, title: deck.title, ...titles, ...summarize(deck.cards, now),
});

// GET /decks?lessonId= — baralhos do usuário, com contagens
router.get('/decks', async (req: AuthRequest, res: Response) => {
  try {
    const filter: Record<string, unknown> = { user: req.userId };
    if (typeof req.query.lessonId === 'string') {
      if (!validId(req.query.lessonId)) return res.status(400).json({ error: 'lessonId: invalid' });
      filter.lesson = req.query.lessonId;
    }
    const decks = await FlashcardDeck.find(filter).sort({ updatedAt: -1 });
    const titleOf = await titlesFor(decks);
    const now = new Date();
    res.json(decks.map((d) => deckSummary(d, titleOf(d), now)));
  } catch {
    res.status(500).json({ error: 'Error fetching decks.' });
  }
});

// GET /summary — total para revisar agora (usado na página inicial)
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const decks = await FlashcardDeck.find({ user: req.userId }).select('cards.box cards.dueAt');
    const now = new Date();
    const totals = decks.map((d) => summarize(d.cards, now));
    res.json({ decks: decks.length, due: totals.reduce((s, t) => s + t.due, 0), total: totals.reduce((s, t) => s + t.total, 0) });
  } catch {
    res.status(500).json({ error: 'Error fetching summary.' });
  }
});

// POST /decks/generate — gera cartões com IA (usa os materiais do professor da aula) e acrescenta ao baralho da aula
router.post('/decks/generate', aiLimiter, async (req: AuthRequest, res: Response) => {
  const data = parseBody(generateSchema, req.body, res);
  if (!data) return;
  try {
    const access = await findLessonAccess(data.lessonId, req.userId as string);
    if (!access) return res.status(404).json({ error: 'Lesson not found.' });

    const materials = await buildMaterialsContext(access.notebook._id, access.lesson._id);
    const drafts = await getAIService().generateFlashcards({
      topic: data.topic,
      context: `${access.notebook.title} - ${access.lesson.title}`,
      language: data.language,
      count: data.count,
      materials: materials.count > 0 ? materials.text : undefined,
    });

    let deck = await FlashcardDeck.findOne({ user: req.userId, lesson: access.lesson._id });
    const existing = new Set((deck?.cards ?? []).map((c) => normalizeText(c.front)));
    const now = new Date();
    const fresh = drafts
      .filter((c) => {
        const key = normalizeText(c.front);
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      })
      .slice(0, Math.max(0, MAX_CARDS_PER_DECK - (deck?.cards.length ?? 0)))
      .map((c) => ({ front: c.front, back: c.back, topic: c.topic || data.topic, ...newCardState(now) }));

    if (!deck) {
      deck = await FlashcardDeck.create({
        user: req.userId, notebook: access.notebook._id, lesson: access.lesson._id, title: `${access.lesson.title}`, cards: fresh,
      });
    } else if (fresh.length > 0) {
      deck.cards.push(...(fresh as any));
      await deck.save();
    }

    const titleOf = await titlesFor([deck]);
    res.status(201).json({ added: fresh.length, materialsUsed: materials.count, deck: deckSummary(deck, titleOf(deck), now) });
  } catch (error) {
    console.error('FLASHCARD GENERATION FAILED:', error);
    res.status(502).json({ error: 'Failed to generate flashcards.' });
  }
});

async function ownDeck(id: string, userId: string) {
  if (!validId(id)) return null;
  return FlashcardDeck.findOne({ _id: id, user: userId });
}

// GET /decks/:id — baralho completo (para gerenciar os cartões)
router.get('/decks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deck = await ownDeck(req.params.id, req.userId as string);
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    const titleOf = await titlesFor([deck]);
    const now = new Date();
    res.json({
      ...deckSummary(deck, titleOf(deck), now),
      cards: deck.cards.map((c) => ({ _id: c._id, front: c.front, back: c.back, topic: c.topic, box: c.box, dueAt: c.dueAt, lapses: c.lapses })),
    });
  } catch {
    res.status(500).json({ error: 'Error fetching deck.' });
  }
});

// GET /decks/:id/session?limit= — cartões que vencem agora (revisões atrasadas primeiro, depois os novos)
router.get('/decks/:id/session', async (req: AuthRequest, res: Response) => {
  try {
    const deck = await ownDeck(req.params.id, req.userId as string);
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const now = new Date();
    const cards = orderForSession(
      deck.cards.map((c) => ({ _id: c._id, front: c.front, back: c.back, topic: c.topic, box: c.box, dueAt: c.dueAt, lapses: c.lapses, reps: c.reps })),
      now,
      limit
    );
    res.json({
      title: deck.title,
      cards: cards.map((c) => ({ _id: c._id, front: c.front, back: c.back, topic: c.topic, box: c.box })),
      stats: summarize(deck.cards, now),
    });
  } catch {
    res.status(500).json({ error: 'Error fetching session.' });
  }
});

// POST /decks/:id/review — registra "lembrei"/"não lembrei" e reagenda o cartão
router.post('/decks/:id/review', async (req: AuthRequest, res: Response) => {
  const data = parseBody(reviewSchema, req.body, res);
  if (!data) return;
  try {
    const deck = await ownDeck(req.params.id, req.userId as string);
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    const card = validId(data.cardId) ? deck.cards.find((c) => String(c._id) === data.cardId) : undefined;
    if (!card) return res.status(404).json({ error: 'Card not found.' });

    const next = review({ box: card.box, dueAt: card.dueAt, lapses: card.lapses, reps: card.reps, lastAt: card.lastAt }, data.remembered, new Date());
    // atualização atômica do cartão (várias revisões seguidas não se atropelam)
    await FlashcardDeck.updateOne(
      { _id: deck._id, 'cards._id': card._id },
      { $set: { 'cards.$.box': next.box, 'cards.$.dueAt': next.dueAt, 'cards.$.lapses': next.lapses, 'cards.$.reps': next.reps, 'cards.$.lastAt': next.lastAt } }
    );
    res.json({ cardId: card._id, box: next.box, dueAt: next.dueAt });
  } catch {
    res.status(500).json({ error: 'Error saving review.' });
  }
});

// DELETE /decks/:id e /decks/:id/cards/:cardId
router.delete('/decks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deck = await ownDeck(req.params.id, req.userId as string);
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    await deck.deleteOne();
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error deleting deck.' });
  }
});

router.delete('/decks/:id/cards/:cardId', async (req: AuthRequest, res: Response) => {
  try {
    const deck = await ownDeck(req.params.id, req.userId as string);
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    if (!validId(req.params.cardId) || !deck.cards.some((c) => String(c._id) === req.params.cardId)) {
      return res.status(404).json({ error: 'Card not found.' });
    }
    await FlashcardDeck.updateOne({ _id: deck._id }, { $pull: { cards: { _id: req.params.cardId } } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Error deleting card.' });
  }
});

export default router;
