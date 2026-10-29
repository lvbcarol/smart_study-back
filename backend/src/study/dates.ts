// src/study/dates.ts — "dia do aluno" a partir do fuso informado pelo app
// `tzOffset` é o valor de `new Date().getTimezoneOffset()` (minutos; positivo a oeste de UTC, ex.: Brasília = 180).
const MIN_MS = 60 * 1000;

export function clampOffset(offset: unknown): number {
  const n = Number(offset);
  return Number.isFinite(n) ? Math.max(-14 * 60, Math.min(14 * 60, Math.round(n))) : 0;
}

/** Dia local (YYYY-MM-DD) do instante `date` no fuso do aluno. */
export function localDay(date: Date, tzOffset: number): string {
  return new Date(date.getTime() - tzOffset * MIN_MS).toISOString().slice(0, 10);
}

/** Os últimos `n` dias locais, do mais antigo ao de hoje. */
export function lastDays(now: Date, tzOffset: number, n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) days.push(localDay(new Date(now.getTime() - i * 24 * 60 * MIN_MS), tzOffset));
  return days;
}
