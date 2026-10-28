import { describe, it, expect } from 'vitest';
import {
  allocate, applyResult, buildQuizPlan, decayed, errorRateByType, pickFocusTopics, ROTATE, smoothedErrorRate, StatLike,
} from '../src/quiz/weakness';
import { QUESTION_TYPES } from '../src/quiz/questions';

const NOW = new Date('2026-06-30T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000);
const stat = (over: Partial<StatLike>): StatLike => ({ type: 'multiple_choice', topic: 'Derivadas', seen: 4, wrong: 3, lastAt: NOW, misses: [], ...over });
const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

describe('decaimento e suavização', () => {
  it('a meia-vida é de 14 dias', () => {
    const d = decayed({ seen: 8, wrong: 4, lastAt: daysAgo(14) }, NOW);
    expect(d.seen).toBeCloseTo(4, 5);
    expect(d.wrong).toBeCloseTo(2, 5);
    expect(decayed({ seen: 8, wrong: 4, lastAt: NOW }, NOW)).toEqual({ seen: 8, wrong: 4 });
  });

  it('nota parcial conta como erro parcial', () => {
    const next = applyResult({ seen: 0, wrong: 0, lastAt: NOW }, 0.25, NOW);
    expect(next.seen).toBe(1);
    expect(next.wrong).toBeCloseTo(0.75, 5);
  });

  it('poucos dados não distorcem: 1 erro em 1 tentativa não vira 100%', () => {
    expect(smoothedErrorRate(0, 0)).toBeCloseTo(1 / 3, 5);
    expect(smoothedErrorRate(1, 1)).toBeCloseTo(0.5, 5);
    expect(smoothedErrorRate(20, 20)).toBeGreaterThan(0.85);
    expect(smoothedErrorRate(20, 0)).toBeLessThan(0.05);
  });
});

describe('taxa de erro por tipo', () => {
  it('soma tópicos e ignora tipos sem dados', () => {
    const rates = errorRateByType([
      stat({ type: 'open_text', topic: 'A', seen: 5, wrong: 5 }),
      stat({ type: 'open_text', topic: 'B', seen: 5, wrong: 4 }),
      stat({ type: 'multiple_choice', topic: 'A', seen: 10, wrong: 1 }),
    ], NOW);
    expect(rates.open_text.rate).toBeGreaterThan(0.7);
    expect(rates.multiple_choice.rate).toBeLessThan(0.25);
    expect(rates.practical.seen).toBe(0);
    expect(rates.practical.rate).toBeCloseTo(1 / 3, 5);
  });
});

describe('distribuição das perguntas', () => {
  it('sempre soma o total e dá ao menos 1 por tipo quando cabe', () => {
    const w = { multiple_choice: 1, fill_blank: 1, open_text: 1, practical: 1, real_case: 1 };
    for (const n of [5, 6, 7, 8, 9, 12]) {
      const a = allocate(n, w);
      expect(total(a)).toBe(n);
      for (const t of QUESTION_TYPES) expect(a[t]).toBeGreaterThanOrEqual(1);
    }
  });

  it('pesos maiores recebem mais perguntas', () => {
    const a = allocate(10, { multiple_choice: 1, fill_blank: 1, open_text: 6, practical: 1, real_case: 1 });
    expect(a.open_text).toBeGreaterThan(a.multiple_choice);
    expect(a.open_text).toBeGreaterThan(a.real_case);
    expect(total(a)).toBe(10);
  });

  it('com poucas perguntas, não força 1 por tipo', () => {
    const a = allocate(3, { multiple_choice: 5, fill_blank: 1, open_text: 1, practical: 1, real_case: 1 });
    expect(total(a)).toBe(3);
    expect(a.multiple_choice).toBeGreaterThanOrEqual(1);
  });
});

describe('tópicos de foco', () => {
  it('só considera tópicos com erro em aberto e recente', () => {
    const open = stat({ topic: 'Regra da cadeia', misses: [{ question: 'Derive sen(x²)', at: NOW }] });
    const closed = stat({ topic: 'Limites', misses: [] });
    const old = stat({ topic: 'Séries', lastAt: daysAgo(120), misses: [{ question: 'x', at: daysAgo(120) }] });
    const focus = pickFocusTopics([open, closed, old], NOW);
    expect(focus.map((f) => f.topic)).toEqual(['Regra da cadeia']);
    expect(focus[0].lastMiss).toBe('Derive sen(x²)');
  });

  it('ordena do mais errado ao menos errado e limita a quantidade', () => {
    const mk = (topic: string, wrong: number) => stat({ topic, seen: 6, wrong, misses: [{ question: topic, at: NOW }] });
    const focus = pickFocusTopics([mk('A', 2), mk('B', 6), mk('C', 4), mk('D', 3)], NOW, 3);
    expect(focus.map((f) => f.topic)).toEqual(['B', 'C', 'D']);
  });
});

describe('plano do quiz', () => {
  it('sem histórico: mistura equilibrada, sem reforço', () => {
    const plan = buildQuizPlan({ count: 8, allStats: [], lessonStats: [], now: NOW });
    expect(plan.reinforce).toHaveLength(0);
    expect(total(plan.mix)).toBe(8);
    for (const t of QUESTION_TYPES) expect(plan.mix[t]).toBeGreaterThanOrEqual(1);
    expect(plan.mix.multiple_choice).toBeGreaterThanOrEqual(plan.mix.real_case);
  });

  it('o tipo que o aluno mais erra recebe mais perguntas', () => {
    const stats = [
      stat({ type: 'open_text', topic: 'A', seen: 10, wrong: 9 }),
      stat({ type: 'multiple_choice', topic: 'A', seen: 10, wrong: 1 }),
      stat({ type: 'fill_blank', topic: 'A', seen: 10, wrong: 2 }),
      stat({ type: 'practical', topic: 'A', seen: 10, wrong: 2 }),
      stat({ type: 'real_case', topic: 'A', seen: 10, wrong: 2 }),
    ];
    const neutral = buildQuizPlan({ count: 10, allStats: [], lessonStats: [], now: NOW });
    const adaptive = buildQuizPlan({ count: 10, allStats: stats, lessonStats: [], now: NOW });
    expect(adaptive.mix.open_text).toBeGreaterThan(neutral.mix.open_text);
    expect(adaptive.mix.open_text).toBeGreaterThan(adaptive.mix.multiple_choice);
    expect(total(adaptive.mix)).toBe(10);
  });

  it('reforça o tópico errado em OUTRO formato e fecha o total de perguntas', () => {
    const lessonStats = [stat({ type: 'multiple_choice', topic: 'Regra da cadeia', seen: 3, wrong: 3, misses: [{ question: 'Derive sen(x²)', at: NOW }] })];
    const plan = buildQuizPlan({ count: 8, allStats: lessonStats, lessonStats, now: NOW });
    expect(plan.reinforce).toHaveLength(1);
    expect(plan.reinforce[0].topic).toBe('Regra da cadeia');
    expect(plan.reinforce[0].avoidType).toBe('multiple_choice');
    expect(plan.reinforce[0].suggestedType).toBe(ROTATE.multiple_choice);
    expect(plan.reinforce[0].suggestedType).not.toBe('multiple_choice');
    expect(plan.reinforce[0].originalQuestion).toBe('Derive sen(x²)');
    expect(total(plan.mix) + plan.reinforce.length).toBe(8);
  });

  it('reforço ocupa no máximo 25% do quiz', () => {
    const many = ['A', 'B', 'C', 'D'].map((topic) => stat({ topic, seen: 4, wrong: 4, misses: [{ question: topic, at: NOW }] }));
    const plan = buildQuizPlan({ count: 8, allStats: many, lessonStats: many, now: NOW });
    expect(plan.reinforce.length).toBeLessThanOrEqual(2);
    expect(total(plan.mix) + plan.reinforce.length).toBe(8);
  });

  it('todo tipo tem um formato alternativo diferente', () => {
    for (const t of QUESTION_TYPES) expect(ROTATE[t]).not.toBe(t);
  });
});
