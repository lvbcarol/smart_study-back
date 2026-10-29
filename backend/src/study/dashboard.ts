// src/study/dashboard.ts — números do dashboard do aluno (função pura: recebe os dados, devolve o painel)
import { BLOOM_LEVELS, QUESTION_TYPES, QuestionType } from '../quiz/questions';
import type { KolbProfile } from './kolb';
import { localDay } from './dates';
import type { PlanWeakness } from './planner';
import type { StudyWeek } from './week';

export interface DashAttempt {
  notebook: string;
  lesson: string;
  score: number; // 0..100
  createdAt: Date;
  /** tipo e nota (0..1) de cada pergunta, na mesma ordem */
  types: string[];
  scores: number[];
  /** nível de Bloom e competência de cada pergunta (podem faltar em tentativas antigas) */
  blooms?: (string | undefined)[];
  competencies?: (string | undefined)[];
}

export interface DashInput {
  now: Date;
  tzOffset: number;
  range: number;
  attempts: DashAttempt[];
  /** títulos de caderno e aula, para nomear os gráficos */
  notebooks: Map<string, { title: string; lessons: Map<string, string> }>;
  weaknesses: PlanWeakness[];
  tasks: { submitted: number; pending: number };
  flashcards: { due: number; learned: number };
  week: StudyWeek;
  /** dias (YYYY-MM-DD) com qualquer atividade: quiz, tarefa, cartões ou tempo de estudo */
  activeDays: Set<string>;
  /** null quando o aluno ocultou o perfil de aprendizagem */
  kolb?: KolbProfile | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Dias seguidos com atividade até hoje (se hoje ainda não teve, conta a partir de ontem). */
export function streakDays(activeDays: Set<string>, now: Date, tzOffset: number): number {
  let streak = 0;
  const day = new Date(now);
  if (!activeDays.has(localDay(day, tzOffset))) day.setUTCDate(day.getUTCDate() - 1);
  while (activeDays.has(localDay(day, tzOffset))) {
    streak += 1;
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return streak;
}

export function buildStudentDashboard(input: DashInput) {
  const { attempts, notebooks, now, tzOffset } = input;

  // evolução: média por dia (só dias com tentativa; o gráfico preenche o resto)
  const perDay = new Map<string, number[]>();
  for (const a of attempts) {
    const d = localDay(a.createdAt, tzOffset);
    perDay.set(d, [...(perDay.get(d) ?? []), a.score]);
  }
  const timeline = [...perDay.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, scores]) => ({ date, average: Math.round(avg(scores)), attempts: scores.length }));

  // por matéria e por aula
  const bySubject = new Map<string, { scores: number[]; lessons: Map<string, number[]> }>();
  for (const a of attempts) {
    const s = bySubject.get(a.notebook) ?? { scores: [] as number[], lessons: new Map<string, number[]>() };
    s.scores.push(a.score);
    s.lessons.set(a.lesson, [...(s.lessons.get(a.lesson) ?? []), a.score]);
    bySubject.set(a.notebook, s);
  }
  const subjects = [...bySubject.entries()].map(([notebookId, s]) => ({
    notebookId,
    title: notebooks.get(notebookId)?.title ?? '',
    average: Math.round(avg(s.scores)),
    attempts: s.scores.length,
    lessons: [...s.lessons.entries()].map(([lessonId, scores]) => ({
      lessonId, title: notebooks.get(notebookId)?.lessons.get(lessonId) ?? '', average: Math.round(avg(scores)), attempts: scores.length,
    })).sort((x, y) => x.average - y.average),
  })).sort((x, y) => y.attempts - x.attempts);

  // acerto por tipo de pergunta
  const typeScores = new Map<string, number[]>();
  for (const a of attempts) {
    a.types.forEach((type, i) => {
      if (a.scores[i] === undefined) return;
      typeScores.set(type, [...(typeScores.get(type) ?? []), a.scores[i]]);
    });
  }
  const byType = (QUESTION_TYPES as readonly QuestionType[]).map((type) => ({
    type, answered: typeScores.get(type)?.length ?? 0, accuracy: typeScores.get(type) ? Math.round(avg(typeScores.get(type)!) * 100) : null,
  }));

  // acerto por nível de Bloom e por competência
  const bloomScores = new Map<string, number[]>();
  const compScores = new Map<string, number[]>();
  for (const a of attempts) {
    a.scores.forEach((score, i) => {
      const b = a.blooms?.[i];
      if (b) bloomScores.set(b, [...(bloomScores.get(b) ?? []), score]);
      const c = a.competencies?.[i];
      if (c) compScores.set(c, [...(compScores.get(c) ?? []), score]);
    });
  }
  const byBloom = BLOOM_LEVELS.map((level) => ({ level, answered: bloomScores.get(level)?.length ?? 0, accuracy: bloomScores.get(level) ? Math.round(avg(bloomScores.get(level)!) * 100) : null }));
  const byCompetency = [...compScores.entries()].map(([name, scores]) => ({ name, answered: scores.length, accuracy: Math.round(avg(scores) * 100) })).sort((x, y) => x.accuracy - y.accuracy);

  return {
    range: input.range,
    kpis: {
      average: attempts.length ? Math.round(avg(attempts.map((a) => a.score))) : null,
      attempts: attempts.length,
      tasksSubmitted: input.tasks.submitted,
      tasksPending: input.tasks.pending,
      streakDays: streakDays(input.activeDays, now, tzOffset),
      flashcardsDue: input.flashcards.due,
      flashcardsLearned: input.flashcards.learned,
      studyMinutesWeek: input.week.totalMinutes,
      goalMinutes: input.week.goalMinutes,
    },
    timeline,
    subjects,
    byType,
    byBloom,
    byCompetency,
    kolb: input.kolb ?? null,
    weakTopics: input.weaknesses.slice(0, 8).map((w) => ({ topic: w.topic, lessonId: w.lessonId, lesson: w.lessonTitle, notebook: w.notebookTitle, errorRate: r1(w.rate * 100) })),
    study: input.week,
  };
}
