// src/flashcards/leitner.ts — repetição espaçada pelo sistema de caixas de Leitner (funções puras)
//
// Caixa 0 = cartão novo. "Lembrei" sobe uma caixa e espaça a próxima revisão; "não lembrei" volta para a caixa 1
// e o cartão reaparece em poucos minutos (e na mesma sessão de estudo, até o aluno acertar).
export const MAX_BOX = 5;
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

/** Intervalo até a próxima revisão, por caixa. */
export const BOX_INTERVAL_MS: Record<number, number> = {
  1: 10 * MIN,
  2: 1 * DAY,
  3: 3 * DAY,
  4: 7 * DAY,
  5: 21 * DAY,
};

export interface CardSrs {
  box: number;
  dueAt: Date;
  lapses: number;
  reps: number;
  lastAt?: Date;
}

export const newCardState = (now: Date): CardSrs => ({ box: 0, dueAt: now, lapses: 0, reps: 0 });

export function review(card: CardSrs, remembered: boolean, now: Date): CardSrs {
  if (remembered) {
    // quem já sabia um cartão novo pula direto para a caixa 2
    const box = card.box === 0 ? 2 : Math.min(MAX_BOX, card.box + 1);
    return { ...card, box, dueAt: new Date(now.getTime() + BOX_INTERVAL_MS[box]), reps: card.reps + 1, lastAt: now };
  }
  return { ...card, box: 1, dueAt: new Date(now.getTime() + BOX_INTERVAL_MS[1]), lapses: card.lapses + 1, reps: card.reps + 1, lastAt: now };
}

export const isDue = (card: Pick<CardSrs, 'dueAt'>, now: Date): boolean => card.dueAt.getTime() <= now.getTime();

/** Revisões atrasadas primeiro (a mais atrasada no topo); cartões novos depois, na ordem de criação. */
export function orderForSession<T extends CardSrs>(cards: T[], now: Date, limit = 20): T[] {
  const due = cards.filter((c) => isDue(c, now));
  const reviews = due.filter((c) => c.box > 0).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const fresh = due.filter((c) => c.box === 0);
  return [...reviews, ...fresh].slice(0, limit);
}

export interface DeckStats {
  total: number;
  due: number;
  new: number;
  /** caixas 4 e 5: bem fixados */
  learned: number;
}

export function summarize(cards: CardSrs[], now: Date): DeckStats {
  return {
    total: cards.length,
    due: cards.filter((c) => isDue(c, now)).length,
    new: cards.filter((c) => c.box === 0).length,
    learned: cards.filter((c) => c.box >= 4).length,
  };
}
