// src/quiz/weakness.service.ts — persistência das estatísticas de deficiência (a matemática está em weakness.ts)
import { Types } from 'mongoose';
import WeaknessStat from '../models/WeaknessStat';
import { CORRECT_THRESHOLD, GradeResult } from './grading';
import { Question } from './questions';
import { applyResult, StatLike } from './weakness';

const MAX_MISSES = 3;

/** Atualiza as estatísticas do aluno com os resultados de um quiz concluído. */
export async function recordResults(
  userId: string | Types.ObjectId,
  lessonId: string | Types.ObjectId,
  questions: Question[],
  results: GradeResult[],
  now = new Date()
): Promise<void> {
  const scoresByTopic = new Map<string, number[]>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const r = results[i];
    if (!r) continue;
    const topicKey = q.topic.toLowerCase();
    const key = { user: userId, lesson: lessonId, type: q.type, topicKey };

    const stat =
      (await WeaknessStat.findOne(key)) ??
      new WeaknessStat({ ...key, topic: q.topic, seen: 0, wrong: 0, lastAt: now, misses: [] });

    const next = applyResult(stat, r.score, now);
    stat.seen = next.seen;
    stat.wrong = next.wrong;
    stat.lastAt = next.lastAt;
    if (r.score < CORRECT_THRESHOLD) {
      stat.misses.push({ question: q.question, at: now });
      stat.misses = stat.misses.slice(-MAX_MISSES);
    }
    await stat.save();

    scoresByTopic.set(topicKey, [...(scoresByTopic.get(topicKey) ?? []), r.score]);
  }

  // Tópico dominado neste quiz (média >= limiar): os erros "em aberto" deixam de pedir reforço
  for (const [topicKey, scores] of scoresByTopic) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg >= CORRECT_THRESHOLD) {
      await WeaknessStat.updateMany({ user: userId, lesson: lessonId, topicKey }, { $set: { misses: [] } });
    }
  }
}

export async function loadStats(userId: string, lessonId?: string): Promise<StatLike[]> {
  const filter: Record<string, unknown> = { user: userId };
  if (lessonId) filter.lesson = lessonId;
  const docs = await WeaknessStat.find(filter).lean();
  return docs.map((d) => ({
    type: d.type, topic: d.topic, seen: d.seen, wrong: d.wrong, lastAt: d.lastAt,
    misses: (d.misses ?? []).map((m) => ({ question: m.question, at: m.at })),
  }));
}
