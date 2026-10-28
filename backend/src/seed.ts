// src/seed.ts
// Dados de demonstração para desenvolvimento (o Mongo em memória zera a cada reinício).
import Usuario from './models/Usuario';
import Turma from './models/Turma';
import Notebook from './models/Notebook';
import QuizAttempt from './models/QuizAttempt';

export const DEMO_PASSWORD = 'demo1234';

const makeQuestions = (topic: string) =>
  Array.from({ length: 4 }, (_, i) => ({
    type: 'multiple_choice',
    topic,
    question: `Questão ${i + 1} sobre ${topic}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswerIndex: i % 4,
    explanation: 'Explicação de demonstração.',
  }));

export async function seedDemo(): Promise<void> {
  if (await Usuario.exists({ email: 'professor@demo.com' })) return;

  const teacher = await Usuario.create({
    name: 'Profa. Helena', email: 'professor@demo.com', password: DEMO_PASSWORD, role: 'teacher', language: 'pt-BR',
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

  const personal = await Notebook.create({
    title: 'Anotações de Física', owner: ana._id, lessons: [{ title: 'Cinemática' }],
  });

  const attempt = (user: typeof ana, lesson: typeof derivadas, n: number, score: number, topic: string) =>
    QuizAttempt.create({
      user: user._id, notebook: matematica._id, lesson: lesson._id, source: 'practice',
      attemptNumber: n, score, questions: makeQuestions(topic), answers: [0, 1, 2, 3],
    });
  await attempt(ana, derivadas, 1, 75, 'Derivadas');
  await attempt(ana, derivadas, 2, 100, 'Derivadas');
  await attempt(bruno, derivadas, 1, 50, 'Derivadas');
  await attempt(bruno, derivadas, 2, 75, 'Derivadas');
  await attempt(carla, integrais, 1, 50, 'Integrais');

  console.log(`🌱 Dados de demonstração criados (senha de todos: ${DEMO_PASSWORD})`);
  console.log('   professor@demo.com · aluno1@demo.com · aluno2@demo.com · aluno3@demo.com');
  void personal;
}
