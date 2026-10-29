// Tipos usados pelo app (espelham as respostas do backend; ver frontend/src/types)
export type Role = 'student' | 'teacher';
export type ThemeMode = 'light' | 'dark' | 'system';
export type QuestionType = 'multiple_choice' | 'fill_blank' | 'open_text' | 'practical' | 'real_case';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  language: 'en-US' | 'pt-BR' | 'es-ES';
  theme: ThemeMode;
  palette: string;
  fontScale: number;
  /** turmas em que o aluno está matriculado (vazio = aluno avulso) */
  turmas?: StudentTurma[];
  linked?: boolean;
  /** meta de estudo da semana, em minutos (0 = sem meta) */
  weeklyGoalMinutes?: number;
}

export interface StudentTurma { _id: string; name: string; teacherName: string }

export interface AttemptSummary { _id: string; attemptNumber: number; score: number; date: string }
export interface Lesson { _id: string; title: string; quizzAttempts?: AttemptSummary[] }
export interface Notebook {
  _id: string;
  title: string;
  lessons: Lesson[];
  readOnly?: boolean;
  turmaName?: string;
  ownerName?: string;
}

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

export interface QuestionResult {
  type: QuestionType;
  topic: string;
  score: number;
  correct: boolean;
  feedback?: string;
  correctAnswer: string;
  correctIndex?: number;
  explanation: string;
}

export interface AttemptDetail {
  _id: string;
  attemptNumber: number;
  score: number;
  date: string;
  questions: PublicQuestion[];
  answers: AnswerValue[];
  results: QuestionResult[];
}

export interface DraftResponse {
  draftId: string;
  questions: PublicQuestion[];
  reinforcing: string[];
  materialsUsed: number;
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
  overdue: boolean;
}

export interface StudentTaskSummary {
  _id: string;
  title: string;
  description?: string;
  dueDate: string | null;
  questionsCount: number;
  notebookTitle?: string;
  lessonTitle?: string;
  status: 'pending' | 'in_progress' | 'submitted';
  score: number | null;
  late: boolean;
}

export interface TaskStart { draftId: string; title: string; questions: PublicQuestion[]; answeredCount: number }

export interface DeckSummary {
  _id: string;
  title: string;
  lessonTitle?: string;
  notebookTitle?: string;
  total: number;
  due: number;
  new: number;
  learned: number;
}

export interface SessionCard { _id: string; front: string; back: string; topic: string; box: number }
export interface StudySession { title: string; lessonId?: string; cards: SessionCard[]; stats: { total: number; due: number; new: number; learned: number } }

export interface AgendaEntry {
  id: string; source: 'personal' | 'teacher'; kind: 'task' | 'reminder'; title: string; notes?: string; dueAt: string | null; done: boolean;
  taskId?: string; status?: 'pending' | 'in_progress' | 'submitted'; late?: boolean; overdue?: boolean; score?: number | null; notebookTitle?: string; lessonTitle?: string;
}

export interface PlanBlock {
  id: string; kind: 'task' | 'agenda' | 'weakness' | 'flashcards' | 'explore'; title: string; minutes: number; reason: string;
  link: { type: 'task' | 'quiz' | 'flashcards' | 'lesson' | 'agenda'; id?: string }; done: boolean;
}
export interface StudyPlan { day: string; minutes: number; intro: string; blocks: PlanBlock[] }

export interface StudyWeek {
  days: { date: string; minutes: number }[]; totalMinutes: number; goalMinutes: number;
  byKind: Record<string, number>; bySubject: { notebookId: string; title: string; minutes: number }[];
}

export interface StudentDashboard {
  range: number;
  kpis: {
    average: number | null; attempts: number; tasksSubmitted: number; tasksPending: number; streakDays: number;
    flashcardsDue: number; flashcardsLearned: number; studyMinutesWeek: number; goalMinutes: number;
  };
  timeline: { date: string; average: number; attempts: number }[];
  subjects: { notebookId: string; title: string; average: number; attempts: number; lessons: { lessonId: string; title: string; average: number; attempts: number }[] }[];
  byType: { type: 'multiple_choice' | 'fill_blank' | 'open_text' | 'practical' | 'real_case'; answered: number; accuracy: number | null }[];
  weakTopics: { topic: string; lessonId: string; lesson: string; notebook: string; errorRate: number }[];
  study: StudyWeek;
}
