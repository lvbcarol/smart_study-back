// src/types/flashcards.ts
export interface DeckSummary {
  _id: string;
  lessonId: string;
  notebookId: string;
  title: string;
  notebookTitle?: string;
  lessonTitle?: string;
  total: number;
  due: number;
  new: number;
  learned: number;
}

export interface SessionCard {
  _id: string;
  front: string;
  back: string;
  topic: string;
  box: number;
}

export interface StudySession {
  title: string;
  cards: SessionCard[];
  stats: { total: number; due: number; new: number; learned: number };
}
