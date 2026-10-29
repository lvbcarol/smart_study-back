// src/study/planData.ts — reúne do banco o que o planejador precisa (tarefas, agenda, pontos fracos, flashcards)
import { Types } from 'mongoose';
import AgendaItem from '../models/AgendaItem';
import FlashcardDeck from '../models/FlashcardDeck';
import Notebook from '../models/Notebook';
import StudySession from '../models/StudySession';
import Usuario from '../models/Usuario';
import WeaknessStat from '../models/WeaknessStat';
import { loadKolbProfile } from './kolbData';
import { summarize } from '../flashcards/leitner';
import { pickFocusTopics, StatLike } from '../quiz/weakness';
import { accessibleNotebooksFilter } from '../services/access';
import { listStudentTasks } from '../services/studentTasks';
import { PlanInput, PlanLesson, PlanWeakness } from './planner';

/** Pontos fracos (tópicos com erros recentes) das aulas que o aluno ainda enxerga, do mais fraco ao mais forte. */
export function collectWeaknesses(
  statDocs: { lesson: unknown; type: StatLike['type']; topic: string; seen: number; wrong: number; lastAt: Date; misses?: { question: string; at: Date }[] }[],
  lessons: Map<string, PlanLesson>,
  now: Date
): PlanWeakness[] {
  const byLesson = new Map<string, StatLike[]>();
  for (const d of statDocs) {
    const key = String(d.lesson);
    if (!lessons.has(key)) continue;
    const list = byLesson.get(key) ?? [];
    list.push({ type: d.type, topic: d.topic, seen: d.seen, wrong: d.wrong, lastAt: d.lastAt, misses: (d.misses ?? []).map((m) => ({ question: m.question, at: m.at })) });
    byLesson.set(key, list);
  }
  const weaknesses: PlanWeakness[] = [];
  for (const [lessonId, stats] of byLesson) {
    const lesson = lessons.get(lessonId)!;
    for (const f of pickFocusTopics(stats, now, 2)) {
      weaknesses.push({ lessonId, lessonTitle: lesson.title, notebookTitle: lesson.notebookTitle, topic: f.topic, rate: f.rate });
    }
  }
  return weaknesses.sort((a, b) => b.rate - a.rate);
}

export async function loadPlanInput(userId: string, minutes: number, language: string | undefined, now: Date): Promise<PlanInput> {
  const [tasks, agenda, statDocs, decks, notebooks, sessions] = await Promise.all([
    listStudentTasks(userId, now),
    AgendaItem.find({ user: userId, done: false }).lean(),
    WeaknessStat.find({ user: userId }).lean(),
    FlashcardDeck.find({ user: userId }).select('cards.box cards.dueAt'),
    Notebook.find(await accessibleNotebooksFilter(userId)).select('title lessons').lean(),
    StudySession.aggregate<{ _id: unknown; last: Date }>([
      { $match: { user: new Types.ObjectId(userId), lesson: { $ne: null } } },
      { $group: { _id: '$lesson', last: { $max: '$startedAt' } } },
    ]),
  ]);

  // perfil de Kolb: só entra no plano se o aluno não ocultou o perfil e houver dados suficientes
  const me = await Usuario.findById(userId).select('showLearningProfile').lean();
  const kolb = me?.showLearningProfile === false ? null : await loadKolbProfile(userId, now);
  const gapStat = kolb?.hasGap && kolb.weakest ? kolb.quadrants.find((q) => q.id === kolb.weakest) : undefined;

  const lessons = new Map<string, PlanLesson>();
  for (const n of notebooks) for (const l of n.lessons) lessons.set(String(l._id), { id: String(l._id), title: l.title, notebookTitle: n.title });

  const weaknesses = collectWeaknesses(statDocs, lessons, now);

  // aulas menos estudadas recentemente primeiro (nunca estudadas vêm antes de todas)
  const lastStudied = new Map(sessions.map((s) => [String(s._id), s.last.getTime()]));
  const fallbackLessons = [...lessons.values()].sort((a, b) => (lastStudied.get(a.id) ?? 0) - (lastStudied.get(b.id) ?? 0));

  return {
    minutes, now, language,
    tasks: tasks.filter((t) => t.status !== 'submitted').map((t) => ({
      id: String(t._id), title: t.title, dueAt: t.dueDate, status: t.status as 'pending' | 'in_progress', questionsCount: t.questionsCount,
    })),
    agenda: agenda.map((a) => ({ id: String(a._id), title: a.title, kind: a.kind, dueAt: a.dueAt ?? null })),
    weaknesses,
    flashcardsDue: decks.reduce((sum, d) => sum + summarize(d.cards, now).due, 0),
    fallbackLessons,
    kolbGap: gapStat ? { quadrant: gapStat.id, sharePercent: Math.round(gapStat.share * 100) } : undefined,
  };
}
