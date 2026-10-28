// src/types/tasks.ts — tarefas e resultados
import { AnswerValue, PublicQuestion, QuestionResult, QuestionType } from './quiz';

export interface TeacherTaskRow {
  _id: string;
  title: string;
  published: boolean;
  dueDate: string | null;
  questionsCount: number;
  turmaId: string;
  turmaName?: string;
  notebookTitle?: string;
  lessonTitle?: string;
  submitted: number;
  total: number;
  average: number | null;
}

export interface StudentTaskRow {
  _id: string;
  title: string;
  dueDate: string | null;
  questionsCount: number;
  notebookTitle?: string;
  lessonTitle?: string;
  status: 'pending' | 'in_progress' | 'submitted';
  score: number | null;
  late: boolean;
  submittedAt: string | null;
  overdue: boolean;
}

export interface StudentTaskSummary extends Omit<StudentTaskRow, 'submittedAt' | 'overdue'> {
  description?: string;
  attemptId: string | null;
}

export interface TaskStart {
  draftId: string;
  title: string;
  questions: PublicQuestion[];
  answeredCount: number;
}

/** Pergunta completa (com gabarito), como o professor edita. */
export interface EditableQuestion {
  id?: string;
  type: QuestionType;
  topic: string;
  question: string;
  explanation: string;
  reinforcement?: boolean;
  // múltipla escolha
  options?: string[];
  correctAnswerIndex?: number;
  // completar
  acceptedAnswers?: string[][];
  // aberta / prática / caso real
  expectedAnswer?: string;
  rubric?: string[];
  scenario?: string;
  numeric?: { value: number; tolerance: number };
}

export interface TeacherTaskDetail {
  _id: string;
  title: string;
  description?: string;
  dueDate: string | null;
  published: boolean;
  notebookId: string;
  lessonId: string;
  turma: string;
  turmaName?: string;
  notebookTitle?: string;
  lessonTitle?: string;
  submitted: number;
  questions: EditableQuestion[];
}

export interface Submission {
  student: { _id: string; name: string; email: string };
  status: 'submitted' | 'in_progress' | 'not_started';
  score: number | null;
  late: boolean;
  submittedAt: string | null;
  attemptId: string | null;
}

export interface ClassResults {
  turma: { _id: string; name: string };
  students: { _id: string; name: string; email: string; average: number | null; attempts: number; lastAt: string | null }[];
  notebooks: { _id: string; title: string; lessons: { _id: string; title: string; average: number | null; attempts: number; participation: number }[] }[];
  cells: { student: string; lesson: string; average: number; count: number }[];
  tasks: { _id: string; title: string; published: boolean; dueDate: string | null; questionsCount: number; submitted: number; late: number; total: number; average: number | null }[];
}

export interface StudentResults {
  student: { _id: string; name: string; email: string };
  average: number | null;
  attemptsCount: number;
  lessons: { lessonId: string; lesson: string; notebook: string; average: number; attempts: number }[];
  attempts: { _id: string; lesson: string; notebook: string; source: 'practice' | 'task'; taskTitle?: string; score: number; late: boolean; date: string }[];
  weakness: {
    types: { type: QuestionType; errorRate: number; seen: number }[];
    topics: { topic: string; type: QuestionType; errorRate: number; seen: number; needsReview: boolean }[];
  };
}

export interface TeacherAttemptView {
  _id: string;
  student: { _id: string; name: string; email: string };
  turmaId: string;
  notebookTitle: string;
  lessonTitle?: string;
  taskTitle?: string;
  source: 'practice' | 'task';
  late: boolean;
  score: number;
  date: string;
  questions: PublicQuestion[];
  answers: AnswerValue[];
  results: QuestionResult[];
}
