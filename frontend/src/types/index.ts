// src/types/index.ts — tipos compartilhados pelas páginas
export type Role = 'student' | 'teacher';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  language: 'en-US' | 'pt-BR';
  accessibility: {
    audioDescription: boolean;
    signLanguage: boolean;
  };
  theme: ThemeMode;
  palette: string;
  fontScale: number;
  avatarColor: string;
}

export interface AttemptSummary {
  _id: string;
  attemptNumber: number;
  score: number;
  date: string;
}

export interface Lesson {
  _id: string;
  title: string;
  quizzAttempts?: AttemptSummary[];
}

export interface Notebook {
  _id: string;
  title: string;
  lessons: Lesson[];
  turma?: string;
  /** true quando o caderno é de um professor e o usuário só pode ler */
  readOnly?: boolean;
  turmaName?: string;
  ownerName?: string;
}
