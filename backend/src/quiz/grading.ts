// src/quiz/grading.ts — correção no servidor (determinística quando possível, IA com rubrica quando não)
import { Question } from './questions';

export interface GradeResult {
  type: Question['type'];
  topic: string;
  score: number; // 0..1
  correct: boolean; // score >= CORRECT_THRESHOLD
  feedback?: string;
  correctAnswer: string;
  /** só em múltipla escolha: índice da alternativa correta */
  correctIndex?: number;
  explanation: string;
  method: 'exact' | 'ai' | 'fallback';
}

export const CORRECT_THRESHOLD = 0.7;

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primeiro número do texto, aceitando vírgula decimal ("1,5" -> 1.5). */
export function parseNumber(s: string): number | null {
  const match = s.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const n = Number(match[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function describeCorrectAnswer(q: Question): string {
  switch (q.type) {
    case 'multiple_choice':
      return q.options[q.correctAnswerIndex];
    case 'fill_blank':
      return q.acceptedAnswers.map((a) => a[0]).join(' · ');
    default:
      return q.expectedAnswer;
  }
}

function result(q: Question, score: number, method: GradeResult['method'], feedback?: string): GradeResult {
  const s = Math.max(0, Math.min(1, score));
  return {
    type: q.type,
    topic: q.topic,
    score: s,
    correct: s >= CORRECT_THRESHOLD,
    feedback,
    correctAnswer: describeCorrectAnswer(q),
    explanation: q.explanation,
    method,
  };
}

export function gradeMultipleChoice(q: Extract<Question, { type: 'multiple_choice' }>, answer: number): GradeResult {
  return { ...result(q, answer === q.correctAnswerIndex ? 1 : 0, 'exact'), correctIndex: q.correctAnswerIndex };
}

export function gradeFillBlank(q: Extract<Question, { type: 'fill_blank' }>, answers: string[]): GradeResult {
  const hits = q.acceptedAnswers.filter((accepted, i) => {
    const given = normalizeText(answers[i] ?? '');
    return given !== '' && accepted.some((a) => normalizeText(a) === given);
  }).length;
  return result(q, hits / q.acceptedAnswers.length, 'exact');
}

export function gradeNumeric(q: Extract<Question, { type: 'practical' }>, answer: string): GradeResult | null {
  if (!q.numeric) return null;
  const given = parseNumber(answer);
  if (given === null) return result(q, 0, 'exact');
  const diff = Math.abs(given - q.numeric.value);
  return result(q, diff <= q.numeric.tolerance + 1e-9 ? 1 : 0, 'exact');
}

/**
 * Plano B quando a IA não responde: cobertura da rubrica por palavras-chave.
 * Cada item da rubrica conta se pelo menos metade das suas palavras significativas aparece na resposta.
 */
export function keywordFallback(rubric: string[], expectedAnswer: string, answer: string): number {
  const given = new Set(normalizeText(answer).split(' ').filter(Boolean));
  if (given.size === 0) return 0;
  const items = rubric.length > 0 ? rubric : [expectedAnswer];
  const covered = items.filter((item) => {
    const words = normalizeText(item).split(' ').filter((w) => w.length > 3);
    if (words.length === 0) return false;
    return words.filter((w) => given.has(w)).length / words.length >= 0.5;
  }).length;
  return covered / items.length;
}

export interface AIGrader {
  gradeAnswer(input: { question: Question; answer: string; language?: string }): Promise<{ score: number; feedback: string }>;
}

/** Corrige uma resposta já validada quanto ao formato. */
export async function gradeAnswer(q: Question, answer: unknown, ai: AIGrader, language?: string): Promise<GradeResult> {
  if (q.type === 'multiple_choice') return gradeMultipleChoice(q, answer as number);
  if (q.type === 'fill_blank') return gradeFillBlank(q, answer as string[]);

  const text = answer as string;
  if (q.type === 'practical') {
    const numeric = gradeNumeric(q, text);
    if (numeric) return numeric;
  }

  if (normalizeText(text) === '') return result(q, 0, 'exact');

  try {
    const graded = await ai.gradeAnswer({ question: q, answer: text, language });
    return result(q, graded.score, 'ai', graded.feedback);
  } catch (error) {
    console.error('Falha na correção por IA, usando palavras-chave:', error);
    const rubric = 'rubric' in q ? q.rubric : [];
    return result(q, keywordFallback(rubric, q.expectedAnswer, text), 'fallback');
  }
}
