// src/seed.ts
// Dados de demonstração para desenvolvimento (o Mongo em memória zera a cada reinício).
import Usuario from './models/Usuario';
import Turma from './models/Turma';
import Notebook from './models/Notebook';
import QuizAttempt from './models/QuizAttempt';
import Material from './models/Material';
import Task from './models/Task';
import FlashcardDeck from './models/FlashcardDeck';
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

  const demoMaterial = (title: string, text: string, lesson?: unknown) =>
    Material.create({ notebook: matematica._id, lesson, title, kind: 'text', extractedText: text, charCount: text.length, truncated: false, uploadedBy: teacher._id });
  await demoMaterial(
    'Regras de derivação (resumo da professora)',
    "Regra da potência: d/dx x^n = n·x^(n-1). Regra da soma: a derivada da soma é a soma das derivadas. Regra do produto: (f·g)' = f'·g + f·g'. Regra da cadeia: (f∘g)' = f'(g)·g'.",
    derivadas._id
  );
  await demoMaterial('Plano de curso de Cálculo', 'Unidade 1: limites e continuidade. Unidade 2: derivadas e aplicações. Unidade 3: integrais. Avaliações: 2 provas e listas semanais.');

  await Notebook.create({ title: 'Anotações de Física', owner: ana._id, lessons: [{ title: 'Cinemática' }] });

  // aluno avulso: não está em nenhuma turma, estuda só com os próprios cadernos (pode entrar em uma turma pelo código)
  const diego = await Usuario.create({ name: 'Diego', email: 'aluno4@demo.com', password: DEMO_PASSWORD, role: 'student', language: 'pt-BR' });
  await Notebook.create({ title: 'Inglês para viagem', owner: diego._id, lessons: [{ title: 'Present Simple' }, { title: 'Vocabulário de aeroporto' }] });

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

  // tarefa publicada: a Ana já entregou, o Bruno e a Carla ainda não
  const taskQuestions = makeQuestions('Derivadas');
  const task = await Task.create({
    turma: turma._id, notebook: matematica._id, lesson: derivadas._id, title: 'Lista de Derivadas', description: 'Resolva com calma e envie até o prazo.',
    questions: taskQuestions, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), published: true, createdBy: teacher._id,
  });
  const taskResults = makeResults(taskQuestions, 75);
  await QuizAttempt.create({
    user: ana._id, notebook: matematica._id, lesson: derivadas._id, task: task._id, source: 'task', late: false,
    attemptNumber: 1, score: 75, questions: taskQuestions, answers: [0, ['conceito'], 'texto', '42'], results: taskResults,
  });
  await recordResults(ana._id as any, derivadas._id as any, taskQuestions, taskResults);

  // baralho da Ana: 3 cartões vencem agora (1 revisão atrasada + 2 novos), 3 só nos próximos dias
  const day = 24 * 60 * 60 * 1000;
  const card = (front: string, back: string, box: number, dueInMs: number) => ({
    front, back, topic: 'Derivadas', box, dueAt: new Date(Date.now() + dueInMs), lapses: 0, reps: box > 0 ? box : 0,
  });
  await FlashcardDeck.create({
    user: ana._id, notebook: matematica._id, lesson: derivadas._id, title: 'Derivadas',
    cards: [
      card('O que é uma derivada?', 'A taxa de variação instantânea de uma função em um ponto.', 2, -2 * day),
      card('Qual é a derivada de x²?', '2x (regra da potência).', 0, 0),
      card('Enuncie a regra do produto.', "(f·g)' = f'·g + f·g'.", 0, 0),
      card('Qual é a derivada de uma constante?', 'Zero.', 3, 2 * day),
      card('O que diz a regra da cadeia?', "A derivada de f(g(x)) é f'(g(x))·g'(x).", 4, 5 * day),
      card('Qual é a derivada de sen(x)?', 'cos(x).', 5, 15 * day),
    ],
  });

  console.log(`🌱 Dados de demonstração criados (senha de todos: ${DEMO_PASSWORD})`);
  console.log('   professor@demo.com · aluno1@demo.com · aluno2@demo.com · aluno3@demo.com · aluno4@demo.com (avulso)');
  console.log(`   código da turma "3º Ano A": ${turma.joinCode}`);
}
