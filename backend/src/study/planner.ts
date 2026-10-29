// src/study/planner.ts — monta o plano de estudo do dia (função pura, sem banco: fácil de testar)
//
// Cada sugestão vira um "candidato" com uma pontuação (urgência de prazo + fraqueza + revisão pendente)
// e um tempo desejado. Os candidatos entram do mais urgente ao menos urgente até o tempo do aluno acabar.
// Todo bloco carrega o motivo ("por quê?"), para o aluno entender e poder discordar da sugestão.
import type { BlockKind, PlanBlock } from '../models/StudyPlan';
import { msg, planLang, PlanLang } from './messages';

const DAY_MS = 24 * 60 * 60 * 1000;
const STEP = 5; // os blocos são arredondados de 5 em 5 minutos
const MIN_BLOCK = 5;

export interface PlanTask { id: string; title: string; dueAt: Date | null; status: 'pending' | 'in_progress'; questionsCount: number }
export interface PlanAgendaItem { id: string; title: string; kind: 'task' | 'reminder'; dueAt: Date | null }
export interface PlanWeakness { lessonId: string; lessonTitle: string; notebookTitle: string; topic: string; rate: number }
export interface PlanLesson { id: string; title: string; notebookTitle: string }

export interface PlanInput {
  minutes: number;
  now: Date;
  language?: string;
  /** tarefas do professor ainda não entregues */
  tasks: PlanTask[];
  /** tarefas e lembretes pessoais ainda não concluídos */
  agenda: PlanAgendaItem[];
  /** tópicos com erros recentes, dos mais fracos aos mais fortes */
  weaknesses: PlanWeakness[];
  flashcardsDue: number;
  /** aulas para sugerir quando não há pendências (a primeira é a menos estudada recentemente) */
  fallbackLessons: PlanLesson[];
}

export type PlannedBlock = Omit<PlanBlock, 'done'>;
export interface PlanResult { intro: string; blocks: PlannedBlock[] }

interface Candidate extends PlannedBlock { score: number }

const roundUp = (n: number) => Math.ceil(n / STEP) * STEP;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

type Urgency = { score: number; kind: 'Overdue' | 'Today' | 'Soon' | 'Later' | 'NoDue'; days: number };

export function urgency(dueAt: Date | null, now: Date): Urgency {
  if (!dueAt) return { score: 30, kind: 'NoDue', days: 0 };
  const diff = dueAt.getTime() - now.getTime();
  if (diff < 0) return { score: 100, kind: 'Overdue', days: 0 };
  if (diff <= DAY_MS) return { score: 90, kind: 'Today', days: 0 };
  const days = Math.ceil(diff / DAY_MS);
  if (days <= 3) return { score: 70, kind: 'Soon', days };
  if (days <= 7) return { score: 50, kind: 'Soon', days };
  return { score: 25, kind: 'Later', days };
}

function taskCandidate(task: PlanTask, now: Date, lang: PlanLang): Candidate {
  const u = urgency(task.dueAt, now);
  const reasonKey = u.kind === 'Overdue' ? 'taskOverdue' : u.kind === 'Today' ? 'taskToday' : u.kind === 'Soon' ? 'taskSoon' : u.kind === 'Later' ? 'taskLater' : 'taskNoDue';
  let minutes = clamp(roundUp(task.questionsCount * 2), 10, 40);
  let reason = msg(lang, reasonKey, { title: task.title, days: u.days });
  if (task.status === 'in_progress') {
    minutes = Math.max(STEP, roundUp(minutes * 0.7));
    reason += msg(lang, 'taskResume');
  }
  return { id: `task:${task.id}`, kind: 'task', title: task.title, minutes, reason, link: { type: 'task', id: task.id }, score: u.score };
}

function agendaCandidate(item: PlanAgendaItem, now: Date, lang: PlanLang): Candidate | null {
  const u = urgency(item.dueAt, now);
  // itens da agenda só entram quando estão perto; lembretes só no dia (ou atrasados)
  if (u.kind === 'NoDue' || u.kind === 'Later') return null;
  if (item.kind === 'reminder' && u.kind === 'Soon') return null;
  const reasonKey = u.kind === 'Overdue' ? 'agendaOverdue' : u.kind === 'Today' ? 'agendaToday' : 'agendaSoon';
  return {
    id: `agenda:${item.id}`, kind: 'agenda', title: item.title, minutes: item.kind === 'reminder' ? STEP : 15,
    reason: msg(lang, reasonKey, { title: item.title, days: u.days }), link: { type: 'agenda', id: item.id }, score: u.score * 0.8,
  };
}

export function buildStudyPlan(input: PlanInput): PlanResult {
  const lang = planLang(input.language);
  const { now } = input;
  const candidates: Candidate[] = [];

  for (const t of input.tasks) candidates.push(taskCandidate(t, now, lang));
  for (const a of input.agenda) {
    const c = agendaCandidate(a, now, lang);
    if (c) candidates.push(c);
  }
  for (const w of input.weaknesses.slice(0, 3)) {
    candidates.push({
      id: `weakness:${w.lessonId}:${w.topic.toLowerCase()}`, kind: 'weakness', minutes: 15, score: 40 + 50 * w.rate,
      title: msg(lang, 'weaknessTitle', { topic: w.topic }),
      reason: msg(lang, 'weakness', { topic: w.topic, pct: Math.round(w.rate * 100), lesson: `${w.notebookTitle} · ${w.lessonTitle}` }),
      link: { type: 'quiz', id: w.lessonId },
    });
  }
  if (input.flashcardsDue > 0) {
    candidates.push({
      id: 'flashcards', kind: 'flashcards', minutes: clamp(roundUp(input.flashcardsDue * 0.5), 5, 15), score: 60 + Math.min(input.flashcardsDue, 20),
      title: msg(lang, 'flashcardsTitle'), reason: msg(lang, 'flashcards', { due: input.flashcardsDue }), link: { type: 'flashcards' },
    });
  }

  const hadPending = candidates.length > 0;
  if (!hadPending && input.fallbackLessons.length > 0) {
    const l = input.fallbackLessons[0];
    candidates.push({
      id: `explore:${l.id}`, kind: 'explore', minutes: 20, score: 10, title: msg(lang, 'exploreTitle', { lesson: l.title }),
      reason: msg(lang, 'explore', { lesson: l.title, notebook: l.notebookTitle }), link: { type: 'lesson', id: l.id },
    });
  }

  // mais urgentes primeiro; em empate, o mais curto (cabe mais coisa no tempo do aluno)
  candidates.sort((a, b) => b.score - a.score || a.minutes - b.minutes);

  const blocks: PlannedBlock[] = [];
  let remaining = input.minutes;
  for (const { score: _score, ...c } of candidates) {
    if (remaining < MIN_BLOCK) break;
    const minutes = Math.min(c.minutes, remaining);
    // encurtar demais não vale: pula e tenta um item menor
    if (minutes < c.minutes && minutes < Math.max(MIN_BLOCK, c.minutes * 0.5)) continue;
    blocks.push({ ...c, minutes });
    remaining -= minutes;
  }

  const intro = blocks.length === 0
    ? msg(lang, 'introEmpty')
    : msg(lang, hadPending ? 'introBusy' : 'introFree', { minutes: input.minutes });
  return { intro, blocks };
}

export type { BlockKind };
