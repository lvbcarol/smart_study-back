// src/seed.ts
// Dados de demonstração para desenvolvimento (o Mongo em memória zera a cada reinício).
import Usuario from './models/Usuario';
import Turma from './models/Turma';
import Notebook from './models/Notebook';
import QuizAttempt from './models/QuizAttempt';
import { GradeResult } from './quiz/grading';
import { Question } from './quiz/questions';
import { recordResults } from './quiz/weakness.service';

export const DEMO_PASSWORD = 'demo1234';

const makeQuestions = (topic: string): Question[] => [
  { id: 'q1', type: 'multiple_choice', topic: `${topic}: conceitos`, question: `Qual afirmação sobre ${topic} está correta?`, options: ['A', 'B', 'C', 'D'], correctAnswerIndex: 0, explanation: 'Explicação de demonstração.' },
  { id: 'q2', type: 'fill_blank', topic: `${topic}: conceitos`, question: `Em ${topic}, o conceito central é ____.`, acceptedAnswers: [['conceito']], explanation: 'Explicação de demonstração.' },
  { id: 'q3', type: 'open_text', topic: `${topic}: aplicações`, question: `Explique ${topic} com suas palavras.`, expectedAnswer: 'Definição com exemplo.', rubric: ['definição', 'exemplo'], explanation: 'Explicação de demonstração.' },
  { id: 'q4', type: 'practical', topic: `${topic}: problemas`, question: 'Quanto é 6 × 7?', expectedAnswer: '42', numeric: { value: 42, tolerance: 0 }, rubric: [], explanation: '6 × 7 = 42.' },
];

const makeResults = (questions: Question[], score: number): GradeResult[] => {
  const correctCount = Math.round((score / 100) * questions.length);
  return questions.map((q, i) => ({
    type: q.type, topic: q.topic, score: i < correctCount ? 1 : 0, correct: i < correctCount,
    correctAnswer: '—', explanation: q.explanation, method: 'exact' as const,
  }));
};

export async function seedDemo(): Promise<void> {
  if (await Usuario.exists({ email: 'professor@demo.com' })) return;

  const teacher = await Usuario.create({
    name: 'Helena Souza', email: 'professor@demo.com', password: DEMO_PASSWORD, role: 'teacher', language: 'pt-BR',
  });
  const [ana, bruno, carla] = await Promise.all(
    [['Ana', 'aluno1@demo.com'], ['Bruno', 'aluno2@demo.com'], ['Carla', 'aluno3@demo.com']].map(([name, email]) =>
      Usuario.create({ name, email, password: DEMO_PASSWORD, role: 'student', language: 'pt-BR' })
    )
  );

  const turma = await Turma.create({
    name: '3º Ano A',
    teacher: teacher._id,
    students: [ana._id, bruno._id, carla._id],
    pendingEmails: ['novo.aluno@demo.com'],
  });

  const matematica = await Notebook.create({
    title: 'Matemática',
    owner: teacher._id,
    turma: turma._id,
    lessons: [{ title: 'Derivadas' }, { title: 'Integrais' }],
  });
  const [derivadas, integrais] = matematica.lessons;

  await Notebook.create({ title: 'Anotações de Física', owner: ana._id, lessons: [{ title: 'Cinemática' }] });

  // cada tentativa também alimenta as estatísticas de deficiência (usadas no reforço adaptativo)
  const attempt = async (user: { _id: any }, lesson: { _id: any }, n: number, score: number, topic: string) => {
    const questions = makeQuestions(topic);
    const results = makeResults(questions, score);
    await QuizAttempt.create({
      user: user._id, notebook: matematica._id, lesson: lesson._id, source: 'practice',
      attemptNumber: n, score, questions, answers: [0, ['conceito'], 'texto', '42'], results,
    });
    await recordResults(user._id, lesson._id, questions, results);
  };
  await attempt(ana, derivadas, 1, 75, 'Derivadas');
  await attempt(ana, derivadas, 2, 100, 'Derivadas');
  await attempt(bruno, derivadas, 1, 50, 'Derivadas');
  await attempt(bruno, derivadas, 2, 75, 'Derivadas');
  await attempt(carla, integrais, 1, 50, 'Integrais');

  console.log(`🌱 Dados de demonstração criados (senha de todos: ${DEMO_PASSWORD})`);
  console.log('   professor@demo.com · aluno1@demo.com · aluno2@demo.com · aluno3@demo.com');
}
