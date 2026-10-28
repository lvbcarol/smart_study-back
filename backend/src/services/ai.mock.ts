// src/services/ai.mock.ts — IA de demonstração: sem chave, sem rede, determinística
import { keywordFallback } from '../quiz/grading';
import { Question, QUESTION_TYPES, QuestionType } from '../quiz/questions';
import type { AIService } from './ai.service';

const isPt = (language?: string) => !!language && language.toLowerCase().startsWith('pt');

const SUBTOPICS = {
  pt: ['conceitos básicos', 'aplicações', 'resolução de problemas', 'exemplos'],
  en: ['basic concepts', 'applications', 'problem solving', 'examples'],
};

function mockQuestion(type: QuestionType, topic: string, n: number, pt: boolean, reinforcement = false): Question {
  const tag = reinforcement ? (pt ? '[Mock · reforço]' : '[Mock · review]') : '[Mock]';
  const common = { id: `q${n}`, topic, reinforcement: reinforcement || undefined };

  switch (type) {
    case 'multiple_choice': {
      const correctAnswerIndex = n % 4;
      return {
        ...common, type, correctAnswerIndex,
        question: pt ? `${tag} Questão ${n} sobre ${topic}: qual alternativa está correta?` : `${tag} Question ${n} about ${topic}: which option is correct?`,
        options: [0, 1, 2, 3].map((o) => o === correctAnswerIndex
          ? (pt ? `Alternativa correta (questão ${n})` : `Correct option (question ${n})`)
          : (pt ? `Alternativa incorreta ${o + 1}` : `Incorrect option ${o + 1}`)),
        explanation: pt ? `Resposta de demonstração: a alternativa ${correctAnswerIndex + 1} é a correta.` : `Demo answer: option ${correctAnswerIndex + 1} is the correct one.`,
      };
    }
    case 'fill_blank':
      return {
        ...common, type,
        question: pt ? `${tag} Complete: em ${topic}, o conceito central é ____.` : `${tag} Fill in: in ${topic}, the core concept is ____.`,
        acceptedAnswers: [pt ? ['conceito', 'conceito central'] : ['concept', 'core concept']],
        explanation: pt ? 'Resposta de demonstração: "conceito".' : 'Demo answer: "concept".',
      };
    case 'open_text':
      return {
        ...common, type,
        question: pt ? `${tag} Explique com suas palavras: ${topic}.` : `${tag} Explain in your own words: ${topic}.`,
        expectedAnswer: pt ? 'Uma definição clara do conceito, acompanhada de um exemplo aplicado.' : 'A clear definition of the concept, followed by an applied example.',
        rubric: pt ? ['definição clara do conceito', 'exemplo aplicado'] : ['clear definition of the concept', 'applied example'],
        explanation: pt ? 'Uma boa resposta traz definição e exemplo.' : 'A good answer includes a definition and an example.',
      };
    case 'practical': {
      const a = n + 2;
      const b = n + 3;
      return {
        ...common, type,
        question: pt ? `${tag} Problema prático (${topic}): quanto é ${a} × ${b}?` : `${tag} Practical problem (${topic}): what is ${a} × ${b}?`,
        expectedAnswer: String(a * b),
        numeric: { value: a * b, tolerance: 0 },
        rubric: [],
        explanation: `${a} × ${b} = ${a * b}.`,
      };
    }
    case 'real_case':
      return {
        ...common, type,
        scenario: pt
          ? `${tag} Uma equipe precisa aplicar ${topic} num projeto real, com prazo curto e poucos recursos disponíveis.`
          : `${tag} A team needs to apply ${topic} in a real project, with a short deadline and few resources.`,
        question: pt ? `Como você aplicaria ${topic} nessa situação?` : `How would you apply ${topic} in this situation?`,
        expectedAnswer: pt ? 'Descrever o contexto, aplicar o conceito e justificar as escolhas.' : 'Describe the context, apply the concept and justify the choices.',
        rubric: pt ? ['contexto da situação', 'aplicação do conceito', 'justificativa das escolhas'] : ['situation context', 'application of the concept', 'justification of choices'],
        explanation: pt ? 'Conecte o conceito à situação e justifique.' : 'Connect the concept to the situation and justify it.',
      };
  }
}

export const mockQuizzer: Pick<AIService, 'generateQuizz' | 'gradeAnswer'> = {
  async generateQuizz({ topic, language, plan }) {
    const pt = isPt(language);
    const subs = pt ? SUBTOPICS.pt : SUBTOPICS.en;

    // intercala os tipos (round-robin) para o quiz não vir em blocos
    const queues = QUESTION_TYPES.map((t) => ({ type: t, left: plan.mix[t] }));
    const questions: Question[] = [];
    let n = 1;
    while (queues.some((q) => q.left > 0)) {
      for (const q of queues) {
        if (q.left <= 0) continue;
        q.left -= 1;
        questions.push(mockQuestion(q.type, `${topic}: ${subs[(n - 1) % subs.length]}`, n, pt));
        n += 1;
      }
    }
    // reforços vão para o fim: "voltar ao ponto fraco depois, de outra maneira"
    for (const item of plan.reinforce) {
      questions.push(mockQuestion(item.suggestedType, item.topic, n, pt, true));
      n += 1;
    }
    return questions;
  },

  async gradeAnswer({ question, answer, language }) {
    const rubric = 'rubric' in question ? question.rubric : [];
    const expected = 'expectedAnswer' in question ? question.expectedAnswer : '';
    const score = keywordFallback(rubric, expected, answer);
    return {
      score,
      feedback: isPt(language) ? 'Correção de demonstração (por palavras-chave da rubrica).' : 'Demo grading (rubric keywords).',
    };
  },
};
