// src/types/classes.ts — turmas e materiais de apoio
export interface TurmaSummary {
  _id: string;
  name: string;
  studentsCount: number;
  pendingCount: number;
  notebooksCount: number;
}

export interface TurmaDetail {
  _id: string;
  name: string;
  students: { _id: string; name: string; email: string }[];
  pendingEmails: string[];
  notebooks: { _id: string; title: string; lessonsCount: number }[];
}

export type EnrollStatus = 'enrolled' | 'pending' | 'already' | 'already_pending' | 'invalid' | 'not_student';

export interface EnrollResult {
  email: string;
  status: EnrollStatus;
}

export interface MaterialItem {
  _id: string;
  title: string;
  kind: 'file' | 'text';
  fileName?: string;
  charCount: number;
  truncated: boolean;
  lesson: string | null;
  lessonTitle: string | null;
  createdAt: string;
}
