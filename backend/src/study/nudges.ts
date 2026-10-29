// src/study/nudges.ts — lembretes motivacionais contextuais para o aluno (regras simples, sem caixa-preta)
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_NUDGES = 3;

export type NudgeKind = 'taskOverdue' | 'taskDue' | 'goalClose' | 'goalDone' | 'streak' | 'comeback' | 'cards';

export interface Nudge {
  id: string;
  kind: NudgeKind;
  /** valores para o texto, que cada app escreve no idioma do aluno */
  params: Record<string, string | number>;
}

export interface NudgeInput {
  now: Date;
  streakDays: number;
  goalMinutes: number;
  weekMinutes: number;
  /** tarefas do professor ainda não entregues */
  pendingTasks: { id: string; title: string; dueAt: Date | null }[];
  /** dias desde a última atividade (null = nunca estudou) */
  daysSinceActivity: number | null;
  flashcardsDue: number;
}

export function buildNudges(i: NudgeInput): Nudge[] {
  const out: Nudge[] = [];

  const overdue = i.pendingTasks.find((t) => t.dueAt && t.dueAt.getTime() < i.now.getTime());
  if (overdue) out.push({ id: `overdue:${overdue.id}`, kind: 'taskOverdue', params: { title: overdue.title } });

  const soon = i.pendingTasks.find((t) => t.dueAt && t.dueAt.getTime() >= i.now.getTime() && t.dueAt.getTime() - i.now.getTime() <= DAY_MS);
  if (soon) out.push({ id: `due:${soon.id}`, kind: 'taskDue', params: { title: soon.title } });

  if (i.goalMinutes > 0) {
    const pct = i.weekMinutes / i.goalMinutes;
    if (pct >= 1) out.push({ id: 'goalDone', kind: 'goalDone', params: { goal: i.goalMinutes } });
    else if (pct >= 0.7) out.push({ id: 'goalClose', kind: 'goalClose', params: { left: i.goalMinutes - i.weekMinutes } });
  }

  if (i.daysSinceActivity !== null && i.daysSinceActivity >= 3) out.push({ id: 'comeback', kind: 'comeback', params: { days: i.daysSinceActivity } });
  else if (i.streakDays >= 2) out.push({ id: 'streak', kind: 'streak', params: { days: i.streakDays } });

  if (i.flashcardsDue >= 5) out.push({ id: 'cards', kind: 'cards', params: { count: i.flashcardsDue } });

  return out.slice(0, MAX_NUDGES);
}
