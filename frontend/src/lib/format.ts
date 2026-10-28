// src/lib/format.ts
export const formatDateTime = (iso: string | null | undefined, lang: string): string =>
  iso ? new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) : '';

export const formatDate = (iso: string | null | undefined, lang: string): string =>
  iso ? new Date(iso).toLocaleDateString(lang, { dateStyle: 'medium' }) : '';

/** Variante de cor do selo para uma nota 0..100 (o número sempre aparece junto: a cor não é o único sinal). */
export const scoreVariant = (score: number): 'success' | 'warning' | 'destructive' =>
  score >= 70 ? 'success' : score >= 50 ? 'warning' : 'destructive';
