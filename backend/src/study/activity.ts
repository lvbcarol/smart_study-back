// src/study/activity.ts — em que dias o aluno estudou (quiz, tarefa ou tempo de estudo registrado)
import QuizAttempt from '../models/QuizAttempt';
import StudySession from '../models/StudySession';
import { localDay } from './dates';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadActiveDays(userId: string, tzOffset: number, now: Date): Promise<Set<string>> {
  const [sessionDays, attempts] = await Promise.all([
    StudySession.distinct('day', { user: userId }),
    QuizAttempt.find({ user: userId, createdAt: { $gte: new Date(now.getTime() - 400 * DAY_MS) } }).select('createdAt').lean(),
  ]);
  return new Set<string>([...sessionDays, ...attempts.map((a) => localDay(a.createdAt, tzOffset))]);
}

/** Dias desde a última atividade (0 = hoje); null se nunca houve. */
export function daysSinceActivity(activeDays: Set<string>, now: Date, tzOffset: number): number | null {
  if (activeDays.size === 0) return null;
  const last = [...activeDays].sort().at(-1) as string;
  const today = localDay(now, tzOffset);
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / DAY_MS));
}
