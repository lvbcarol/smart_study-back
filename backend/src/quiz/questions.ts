// src/quiz/questions.ts — modelo das perguntas (cinco tipos) e versão pública (sem gabarito)
import { z } from 'zod';

export const QUESTION_TYPES = ['multiple_choice', 'fill_blank', 'open_text', 'practical', 'real_case'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Taxonomia Revisada de Bloom, do mais simples ao mais complexo */
export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];

/** Nível padrão por tipo de pergunta, quando a IA (ou o professor) não informa */
export const DEFAULT_BLOOM: Record<QuestionType, BloomLevel> = {
  multiple_choice: 'remember',
  fill_blank: 'remember',
  open_text: 'understand',
  practical: 'apply',
  real_case: 'analyze',
};

const base = {
  id: z.string().optional(),
  /** nível da Taxonomia de Bloom que a pergunta exige */
  bloomLevel: z.enum(BLOOM_LEVELS).optional(),
  /** competência trabalhada (definida pelo professor no caderno) */
  competency: z.string().trim().max(80).optional(),
  topic: z.string().trim().min(1).max(80),
  question: z.string().trim().min(3),
  explanation: z.string().default(''),
  /** true quando a pergunta reforça um ponto fraco do aluno, de outra maneira */
  reinforcement: z.boolean().optional(),
};

export const multipleChoiceSchema = z.object({
  ...base,
  type: z.literal('multiple_choice'),
  options: z.array(z.string().min(1)).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
});

// O enunciado traz "____" onde fica cada lacuna; acceptedAnswers[i] lista as respostas aceitas da lacuna i
export const fillBlankSchema = z.object({
  ...base,
  type: z.literal('fill_blank'),
  acceptedAnswers: z.array(z.array(z.string().min(1)).min(1)).min(1).max(4),
});

export const openTextSchema = z.object({
  ...base,
  type: z.literal('open_text'),
  expectedAnswer: z.string().min(1),
  rubric: z.array(z.string().min(1)).min(1).max(8),
});

// Prático: se `numeric` existir, a correção é automática (com tolerância); senão, por rubrica
export const practicalSchema = z.object({
  ...base,
  type: z.literal('practical'),
  expectedAnswer: z.string().min(1),
  rubric: z.array(z.string().min(1)).max(8).default([]),
  numeric: z.object({ value: z.number(), tolerance: z.number().min(0).default(0) }).optional(),
});

export const realCaseSchema = z.object({
  ...base,
  type: z.literal('real_case'),
  scenario: z.string().trim().min(10),
  expectedAnswer: z.string().min(1),
  rubric: z.array(z.string().min(1)).min(1).max(8),
});

export const questionSchema = z.discriminatedUnion('type', [
  multipleChoiceSchema,
  fillBlankSchema,
  openTextSchema,
  practicalSchema,
  realCaseSchema,
]);

export type Question = z.infer<typeof questionSchema>;

const BLANK = /_{3,}/g;

/** Ajusta detalhes que a IA costuma errar (ex.: nº de lacunas diferente do nº de respostas) */
export function normalizeQuestion(q: Question, index: number): Question {
  const withId = { ...q, id: q.id ?? `q${index + 1}`, bloomLevel: q.bloomLevel ?? DEFAULT_BLOOM[q.type] } as Question;
  if (withId.type === 'fill_blank') {
    const markers = (withId.question.match(BLANK) ?? []).length;
    if (markers === 0) return { ...withId, question: `${withId.question} ____`, acceptedAnswers: withId.acceptedAnswers.slice(0, 1) };
    if (markers < withId.acceptedAnswers.length) return { ...withId, acceptedAnswers: withId.acceptedAnswers.slice(0, markers) };
    if (markers > withId.acceptedAnswers.length) return { ...withId, question: withId.question.replace(BLANK, '____').split('____').slice(0, withId.acceptedAnswers.length + 1).join('____') };
  }
  return withId;
}

/** Versão enviada ao aluno: nunca contém gabarito, rubrica nem explicação. */
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

export function toPublic(q: Question): PublicQuestion {
  const pub: PublicQuestion = { id: q.id ?? '', type: q.type, topic: q.topic, question: q.question };
  if (q.reinforcement) pub.reinforcement = true;
  if (q.type === 'multiple_choice') pub.options = q.options;
  if (q.type === 'fill_blank') pub.blanks = q.acceptedAnswers.length;
  if (q.type === 'real_case') pub.scenario = q.scenario;
  if (q.type === 'practical') pub.numeric = !!q.numeric;
  return pub;
}

/** Formato do corpo de resposta esperado para cada tipo */
export function answerSchemaFor(q: Question) {
  switch (q.type) {
    case 'multiple_choice':
      return z.number().int().min(0).max(3);
    case 'fill_blank':
      return z.array(z.string().max(200)).length(q.acceptedAnswers.length);
    default:
      return z.string().max(4000);
  }
}
