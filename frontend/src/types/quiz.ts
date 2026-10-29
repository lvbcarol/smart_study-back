// src/types/quiz.ts — espelha o modelo de perguntas do backend (backend/src/quiz/questions.ts)
export type QuestionType = 'multiple_choice' | 'fill_blank' | 'open_text' | 'practical' | 'real_case';

export const QUESTION_TYPES: QuestionType[] = ['multiple_choice', 'fill_blank', 'open_text', 'practical', 'real_case'];

/** Pergunta como o aluno recebe: sem gabarito. */
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  topic: string;
  question: string;
  reinforcement?: boolean;
  scenario?: string;
  options?: string[];
  blanks?: number;
  numeric?: boolean;
}

export type AnswerValue = number | string | string[] | null;

/** Taxonomia Revisada de Bloom, do mais simples ao mais complexo */
export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export interface QuestionResult {
  type: QuestionType;
  topic: string;
  score: number; // 0..1
  correct: boolean;
  feedback?: string;
  correctAnswer: string;
  correctIndex?: number;
  explanation: string;
  method: 'exact' | 'ai' | 'fallback';
}

/** Tentativa salva (a lista da aula devolve as perguntas já com o gabarito, pois o quiz acabou). */
export interface AttemptDetail {
  _id: string;
  attemptNumber: number;
  score: number;
  date: string;
  questions: PublicQuestion[];
  answers: AnswerValue[];
  results: QuestionResult[];
}

export interface WeaknessData {
  types: { type: QuestionType; errorRate: number; seen: number }[];
  topics: { topic: string; type: QuestionType; errorRate: number; seen: number; needsReview: boolean }[];
}

export interface DraftResponse {
  draftId: string;
  questions: PublicQuestion[];
  reinforcing: string[];
  materialsUsed: number;
}
