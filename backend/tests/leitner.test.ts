import { describe, it, expect } from 'vitest';
import { BOX_INTERVAL_MS, CardSrs, isDue, MAX_BOX, newCardState, orderForSession, review, summarize } from '../src/flashcards/leitner';

const NOW = new Date('2026-06-30T12:00:00Z');
const at = (ms: number) => new Date(NOW.getTime() + ms);
const card = (over: Partial<CardSrs> & { id?: string } = {}): CardSrs & { id: string } => ({ id: 'c', box: 1, dueAt: NOW, lapses: 0, reps: 0, ...over });

describe('revisão espaçada (Leitner)', () => {
  it('cartão novo está disponível agora', () => {
    const c = newCardState(NOW);
    expect(c).toMatchObject({ box: 0, lapses: 0, reps: 0 });
    expect(isDue(c, NOW)).toBe(true);
  });

  it('"lembrei" sobe de caixa e espaça cada vez mais', () => {
    let c = card({ box: 1 });
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) {
      c = review(c, true, NOW);
      gaps.push(c.dueAt.getTime() - NOW.getTime());
    }
    expect(c.box).toBe(MAX_BOX); // não passa da última caixa
    expect(gaps).toEqual([BOX_INTERVAL_MS[2], BOX_INTERVAL_MS[3], BOX_INTERVAL_MS[4], BOX_INTERVAL_MS[5], BOX_INTERVAL_MS[5]]);
    expect(gaps[1]).toBeGreaterThan(gaps[0]);
    expect(c.reps).toBe(5);
  });

  it('quem já sabia um cartão novo pula para a caixa 2', () => {
    expect(review(newCardState(NOW), true, NOW).box).toBe(2);
  });

  it('"não lembrei" volta para a caixa 1, conta a falha e reaparece em minutos', () => {
    const c = review(card({ box: 4, reps: 3 }), false, NOW);
    expect(c.box).toBe(1);
    expect(c.lapses).toBe(1);
    expect(c.reps).toBe(4);
    expect(c.dueAt.getTime() - NOW.getTime()).toBe(BOX_INTERVAL_MS[1]);
    expect(BOX_INTERVAL_MS[1]).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(isDue(c, at(BOX_INTERVAL_MS[1]))).toBe(true);
    expect(isDue(c, at(BOX_INTERVAL_MS[1] - 1))).toBe(false);
  });

  it('errar e depois acertar na mesma sessão leva o cartão da caixa 1 para a 2', () => {
    const missed = review(newCardState(NOW), false, NOW);
    const later = review(missed, true, at(60_000));
    expect(later.box).toBe(2);
    expect(later.lapses).toBe(1);
  });

  it('não altera o cartão original (função pura)', () => {
    const original = card({ box: 2 });
    review(original, true, NOW);
    expect(original.box).toBe(2);
  });
});

describe('sessão de estudo', () => {
  it('só traz o que venceu; atrasados primeiro (o mais atrasado no topo), novos por último', () => {
    const cards = [
      card({ id: 'novo', box: 0, dueAt: NOW }),
      card({ id: 'futuro', box: 3, dueAt: at(86_400_000) }),
      card({ id: 'pouco-atrasado', box: 2, dueAt: at(-3_600_000) }),
      card({ id: 'muito-atrasado', box: 4, dueAt: at(-7 * 86_400_000) }),
    ];
    expect(orderForSession(cards, NOW).map((c) => c.id)).toEqual(['muito-atrasado', 'pouco-atrasado', 'novo']);
  });

  it('respeita o limite e devolve vazio quando nada venceu', () => {
    const many = Array.from({ length: 30 }, (_, i) => card({ id: String(i), box: 0 }));
    expect(orderForSession(many, NOW, 20)).toHaveLength(20);
    expect(orderForSession([card({ box: 3, dueAt: at(1000) })], NOW)).toEqual([]);
  });

  it('um cartão errado some da fila por 10 minutos e depois volta', () => {
    const missed = review(card({ box: 3 }), false, NOW);
    expect(orderForSession([missed], at(5 * 60_000))).toHaveLength(0);
    expect(orderForSession([missed], at(11 * 60_000))).toHaveLength(1);
  });

  it('resume o baralho: total, para revisar, novos e bem fixados', () => {
    const stats = summarize([
      card({ box: 0 }), card({ box: 0 }), card({ box: 2, dueAt: at(1000) }), card({ box: 4, dueAt: at(1000) }), card({ box: 5, dueAt: NOW }),
    ], NOW);
    expect(stats).toEqual({ total: 5, due: 3, new: 2, learned: 2 });
  });
});
