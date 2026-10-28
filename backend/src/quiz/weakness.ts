// src/quiz/weakness.ts — algoritmo de deficiências do aluno (funções puras, sem banco)
//
// Para cada (aula, tipo de pergunta, tópico) guardamos `seen` e `wrong` com decaimento exponencial
// por recência (meia-vida de 14 dias): erros antigos pesam menos. A taxa de erro usa suavização
// bayesiana (prior Beta(1, 2) = ~33%), então poucos dados não distorcem o resultado.
//
// O quiz seguinte distribui as perguntas por tipo proporcionalmente à taxa de erro de cada tipo
// (mínimo 1 por tipo) e reserva até 25% das perguntas para REFORÇAR os tópicos mais errados da aula,
// perguntando o mesmo conceito em outro formato.
import { QUESTION_TYPES, QuestionType } from './questions';

export const HALF_LIFE_DAYS = 14;
export const PRIOR_WRONG = 1;
export const PRIOR_RIGHT = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatLike {
  type: QuestionType;
  topic: string;
  seen: number;
  wrong: number;
  lastAt: Date;
  misses: { question: string; at: Date }[];
}

/** Aplica o decaimento por recência até `now`. */
export function decayed(stat: Pick<StatLike, 'seen' | 'wrong' | 'lastAt'>, now: Date): { seen: number; wrong: number } {
  const days = Math.max(0, (now.getTime() - stat.lastAt.getTime()) / DAY_MS);
  const factor = Math.pow(0.5, days / HALF_LIFE_DAYS);
  return { seen: stat.seen * factor, wrong: stat.wrong * factor };
}

/** Registra uma resposta (score 0..1: nota parcial conta como erro parcial). */
export function applyResult(
  stat: Pick<StatLike, 'seen' | 'wrong' | 'lastAt'>,
  score: number,
  now: Date
): { seen: number; wrong: number; lastAt: Date } {
  const d = decayed(stat, now);
  return { seen: d.seen + 1, wrong: d.wrong + (1 - score), lastAt: now };
}

export function smoothedErrorRate(seen: number, wrong: number): number {
  return (wrong + PRIOR_WRONG) / (seen + PRIOR_WRONG + PRIOR_RIGHT);
}

/** Taxa de erro por tipo de pergunta, somando todos os tópicos e aulas do aluno. */
export function errorRateByType(stats: StatLike[], now: Date): Record<QuestionType, { rate: number; seen: number }> {
  const out = {} as Record<QuestionType, { rate: number; seen: number }>;
  for (const type of QUESTION_TYPES) {
    let seen = 0;
    let wrong = 0;
    for (const s of stats) {
      if (s.type !== type) continue;
      const d = decayed(s, now);
      seen += d.seen;
      wrong += d.wrong;
    }
    out[type] = { rate: smoothedErrorRate(seen, wrong), seen };
  }
  return out;
}

/** Distribui `total` itens entre os tipos proporcionalmente aos pesos (maior resto), com mínimo por tipo. */
export function allocate(total: number, weights: Record<QuestionType, number>, minPerType = 1): Record<QuestionType, number> {
  const types = QUESTION_TYPES;
  const out = Object.fromEntries(types.map((t) => [t, 0])) as Record<QuestionType, number>;
  if (total <= 0) return out;

  let remaining = total;
  if (total >= types.length * minPerType) {
    for (const t of types) out[t] = minPerType;
    remaining -= types.length * minPerType;
  }
  const sum = types.reduce((acc, t) => acc + weights[t], 0) || 1;
  const exact = types.map((t) => ({ t, v: (weights[t] / sum) * remaining }));
  for (const e of exact) {
    const whole = Math.floor(e.v);
    out[e.t] += whole;
    remaining -= whole;
  }
  exact.sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)));
  for (let i = 0; remaining > 0; i = (i + 1) % exact.length) {
    out[exact[i].t] += 1;
    remaining -= 1;
  }
  return out;
}

export interface FocusTopic {
  topic: string;
  type: QuestionType;
  rate: number;
  seen: number;
  lastMiss: string;
}

/** Tópicos da aula com erros recentes ainda "abertos" (a lista de erros é limpa ao acertar o tópico). */
export function pickFocusTopics(lessonStats: StatLike[], now: Date, limit = 3): FocusTopic[] {
  const byTopic = new Map<string, FocusTopic & { score: number }>();
  for (const s of lessonStats) {
    if (s.misses.length === 0) continue;
    const d = decayed(s, now);
    if (d.wrong < 0.5) continue; // erro antigo demais
    const rate = smoothedErrorRate(d.seen, d.wrong);
    const score = rate * Math.sqrt(Math.max(d.seen, 1));
    const key = s.topic.toLowerCase();
    const prev = byTopic.get(key);
    if (!prev || score > prev.score) {
      byTopic.set(key, { topic: s.topic, type: s.type, rate, seen: d.seen, lastMiss: s.misses[s.misses.length - 1].question, score });
    }
  }
  return [...byTopic.values()].sort((a, b) => b.score - a.score).slice(0, limit).map(({ score: _s, ...t }) => t);
}

/** "Outra maneira": o reforço usa um formato diferente do que o aluno errou. */
export const ROTATE: Record<QuestionType, QuestionType> = {
  multiple_choice: 'open_text',
  open_text: 'fill_blank',
  fill_blank: 'multiple_choice',
  practical: 'real_case',
  real_case: 'practical',
};

export interface ReinforceItem {
  topic: string;
  suggestedType: QuestionType;
  avoidType: QuestionType;
  originalQuestion: string;
}

export interface QuizPlan {
  count: number;
  /** nº de perguntas "normais" por tipo */
  mix: Record<QuestionType, number>;
  /** perguntas de reforço (cada item = 1 pergunta) */
  reinforce: ReinforceItem[];
}

/** Mistura padrão para quem ainda não tem histórico (equilibrada). */
const DEFAULT_WEIGHTS: Record<QuestionType, number> = {
  multiple_choice: 3,
  fill_blank: 2,
  open_text: 1.5,
  practical: 1.5,
  real_case: 1,
};

export function buildQuizPlan(params: { count: number; allStats: StatLike[]; lessonStats: StatLike[]; now?: Date }): QuizPlan {
  const now = params.now ?? new Date();
  const count = params.count;

  const focus = pickFocusTopics(params.lessonStats, now);
  const maxReinforce = Math.max(1, Math.floor(count * 0.25));
  const reinforce: ReinforceItem[] = focus.slice(0, Math.min(focus.length, maxReinforce)).map((f) => ({
    topic: f.topic,
    avoidType: f.type,
    suggestedType: ROTATE[f.type],
    originalQuestion: f.lastMiss,
  }));

  const byType = errorRateByType(params.allStats, now);
  const hasHistory = QUESTION_TYPES.some((t) => byType[t].seen >= 1);
  const weights = Object.fromEntries(
    QUESTION_TYPES.map((t) => [t, hasHistory ? DEFAULT_WEIGHTS[t] * (0.5 + byType[t].rate * 2) : DEFAULT_WEIGHTS[t]])
  ) as Record<QuestionType, number>;

  return { count, mix: allocate(count - reinforce.length, weights), reinforce };
}
