// src/types/dashboard.ts — respostas dos painéis de desempenho (aluno e professor)
import type { StudyWeek } from './study';

export type QuestionTypeId = 'multiple_choice' | 'fill_blank' | 'open_text' | 'practical' | 'real_case';

export interface StudentDashboard {
  range: number;
  kpis: {
    average: number | null; attempts: number; tasksSubmitted: number; tasksPending: number; streakDays: number;
    flashcardsDue: number; flashcardsLearned: number; studyMinutesWeek: number; goalMinutes: number;
  };
  timeline: { date: string; average: number; attempts: number }[];
  subjects: { notebookId: string; title: string; average: number; attempts: number; lessons: { lessonId: string; title: string; average: number; attempts: number }[] }[];
  byType: { type: QuestionTypeId; answered: number; accuracy: number | null }[];
  weakTopics: { topic: string; lessonId: string; lesson: string; notebook: string; errorRate: number }[];
  study: StudyWeek;
}

export interface ClassOverviewRow {
  turmaId: string; name: string; students: number; average: number | null; attempts: number; lastActivityAt: string | null;
  activeStudents: number; tasksPublished: number; deliveryRate: number | null;
}

export interface ClassTimeline { range: number; days: { date: string; average: number; attempts: number; students: number }[] }

export interface ClassWeakness {
  studentsTotal: number;
  topics: { topic: string; lesson: string; errorRate: number; answers: number; students: number }[];
  byType: { type: QuestionTypeId; answers: number; accuracy: number | null }[];
}
