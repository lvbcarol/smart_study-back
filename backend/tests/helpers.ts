import request from 'supertest';
import type { Express } from 'express';
import QuizDraft from '../src/models/QuizDraft';

/** Resposta certa ou errada para uma pergunta, lendo o gabarito direto do banco (o aluno nunca o vê). */
export function answerFor(q: any, mode: 'right' | 'wrong'): unknown {
  switch (q.type) {
    case 'multiple_choice':
      return mode === 'right' ? q.correctAnswerIndex : (q.correctAnswerIndex + 1) % 4;
    case 'fill_blank':
      return q.acceptedAnswers.map((a: string[]) => (mode === 'right' ? a[0] : 'zzz'));
    case 'practical':
      return mode === 'right' ? String(q.numeric.value) : '0';
    default:
      return mode === 'right' ? q.rubric.join(' ') : 'nada a declarar';
  }
}

export async function startQuiz(app: Express, auth: string, lessonId: string, topic = 'Derivadas', count = 8) {
  const created = await request(app).post('/api/quizz/drafts').set('Authorization', auth).send({ lessonId, topic, language: 'pt-BR', count });
  if (created.status !== 201) throw new Error(`falha ao criar quiz: ${created.status} ${JSON.stringify(created.body)}`);
  const draft = await QuizDraft.findById(created.body.draftId);
  return { draftId: created.body.draftId as string, publicQuestions: created.body.questions as any[], reinforcing: created.body.reinforcing as string[], draft: draft! };
}

/** Faz um quiz completo; `mode` pode ser uma função por pergunta para misturar acertos e erros. */
export async function takeQuiz(
  app: Express, auth: string, lessonId: string,
  mode: 'right' | 'wrong' | ((q: any, i: number) => 'right' | 'wrong'),
  topic = 'Derivadas'
) {
  const quiz = await startQuiz(app, auth, lessonId, topic);
  const questions = quiz.draft.questions as any[];
  for (let i = 0; i < questions.length; i++) {
    const m = typeof mode === 'function' ? mode(questions[i], i) : mode;
    const res = await request(app).post(`/api/quizz/drafts/${quiz.draftId}/answer`).set('Authorization', auth).send({ index: i, answer: answerFor(questions[i], m) });
    if (res.status !== 200) throw new Error(`falha ao responder ${i}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const finished = await request(app).post(`/api/quizz/drafts/${quiz.draftId}/finish`).set('Authorization', auth);
  return { ...quiz, finished };
}
