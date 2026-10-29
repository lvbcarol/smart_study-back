// src/study/week.ts — tempo de estudo dos últimos 7 dias (usado pela rota /study/week e pelo dashboard)
import Notebook from '../models/Notebook';
import StudySession from '../models/StudySession';
import Usuario from '../models/Usuario';
import { lastDays } from './dates';

export interface StudyWeek {
  days: { date: string; minutes: number }[];
  totalMinutes: number;
  goalMinutes: number;
  byKind: Record<string, number>;
  bySubject: { notebookId: string; title: string; minutes: number }[];
}

export async function studyWeek(userId: string, tzOffset: number, now = new Date()): Promise<StudyWeek> {
  const days = lastDays(now, tzOffset, 7);
  const [sessions, user] = await Promise.all([
    StudySession.find({ user: userId, day: { $in: days } }).select('day kind notebook seconds').lean(),
    Usuario.findById(userId).select('weeklyGoalMinutes').lean(),
  ]);

  const perDay = new Map(days.map((d) => [d, 0]));
  const byKind: Record<string, number> = {};
  const byNotebookId = new Map<string, number>();
  for (const s of sessions) {
    perDay.set(s.day, (perDay.get(s.day) ?? 0) + s.seconds);
    byKind[s.kind] = (byKind[s.kind] ?? 0) + s.seconds;
    if (s.notebook) byNotebookId.set(String(s.notebook), (byNotebookId.get(String(s.notebook)) ?? 0) + s.seconds);
  }
  const toMin = (sec: number) => Math.round(sec / 60);
  const notebooks = await Notebook.find({ _id: { $in: [...byNotebookId.keys()] } }).select('title').lean();
  const title = new Map(notebooks.map((n) => [String(n._id), n.title]));

  const totalSeconds = [...perDay.values()].reduce((a, b) => a + b, 0);
  return {
    days: days.map((d) => ({ date: d, minutes: toMin(perDay.get(d) ?? 0) })),
    totalMinutes: toMin(totalSeconds),
    goalMinutes: user?.weeklyGoalMinutes ?? 0,
    byKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, toMin(v)])),
    bySubject: [...byNotebookId].map(([id, sec]) => ({ notebookId: id, title: title.get(id) ?? '', minutes: toMin(sec) })).sort((a, b) => b.minutes - a.minutes),
  };
}
