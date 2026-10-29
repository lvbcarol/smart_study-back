// src/types/dashboard.ts — respostas dos painéis de desempenho (aluno e professor)
import type { StudyWeek } from './study';
import type { BloomLevel } from './quiz';

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
  byBloom: { level: BloomLevel; answered: number; accuracy: number | null }[];
  byCompetency: { name: string; answered: number; accuracy: number }[];
  kolb: KolbProfile | null;
  weakTopics: { topic: string; lessonId: string; lesson: string; notebook: string; errorRate: number }[];
  study: StudyWeek;
}

export type KolbQuadrantId = 'EC' | 'OR' | 'CA' | 'EA';
export type KolbStyleId = 'diverging' | 'assimilating' | 'converging' | 'accommodating';
export interface KolbProfile {
  quadrants: { id: KolbQuadrantId; share: number; accuracy: number | null; answers: number; minutes: number }[];
  style: KolbStyleId | null;
  enough: boolean;
  weakest: KolbQuadrantId | null;
  hasGap: boolean;
  totalWeight: number;
}

export interface RiskRow {
  studentId: string; name: string; level: 'high' | 'medium'; flags: ('inactive' | 'falling' | 'overdue')[];
  daysInactive: number; trend: { recent: number; previous: number } | null; overdueTasks: number;
}
export interface ClassRisk { studentsTotal: number; students: RiskRow[] }
export interface LearningStyles {
  studentsTotal: number; hidden: number; styles: Record<KolbStyleId | 'insufficient', number>; quadrants: { id: KolbQuadrantId; share: number }[];
}
export interface ClassOutcomes {
  range: number;
  byBloom: { level: BloomLevel; answers: number; accuracy: number | null }[];
  byCompetency: { name: string; answers: number; accuracy: number }[];
}

export interface ClassOverviewRow {
  turmaId: string; name: string; students: number; average: number | null; attempts: number; lastActivityAt: string | null;
  activeStudents: number; tasksPublished: number; deliveryRate: number | null; sharedStudyMinutes: number | null;
}

export interface ClassTimeline { range: number; days: { date: string; average: number; attempts: number; students: number }[] }

export interface ClassWeakness {
  studentsTotal: number;
  topics: { topic: string; lesson: string; lessonId: string; notebookId: string; errorRate: number; answers: number; students: number }[];
  byType: { type: QuestionTypeId; answers: number; accuracy: number | null }[];
}
