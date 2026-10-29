// src/types/study.ts — agenda, tempo de estudo e plano do dia
export interface AgendaEntry {
  id: string;
  source: 'personal' | 'teacher';
  kind: 'task' | 'reminder';
  title: string;
  notes?: string;
  dueAt: string | null;
  done: boolean;
  // só para tarefas do professor
  taskId?: string;
  status?: 'pending' | 'in_progress' | 'submitted';
  late?: boolean;
  overdue?: boolean;
  score?: number | null;
  notebookTitle?: string;
  lessonTitle?: string;
}

export interface PlanBlock {
  id: string;
  kind: 'task' | 'agenda' | 'weakness' | 'flashcards' | 'explore';
  title: string;
  minutes: number;
  reason: string;
  link: { type: 'task' | 'quiz' | 'flashcards' | 'lesson' | 'agenda'; id?: string };
  done: boolean;
}

export interface StudyPlan {
  day: string;
  minutes: number;
  intro: string;
  blocks: PlanBlock[];
}

export interface StudyWeek {
  days: { date: string; minutes: number }[];
  totalMinutes: number;
  goalMinutes: number;
  byKind: Record<string, number>;
  bySubject: { notebookId: string; title: string; minutes: number }[];
}
