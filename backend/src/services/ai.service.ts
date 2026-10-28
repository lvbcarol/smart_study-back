// src/services/ai.service.ts — interface única de IA; AI_MODE escolhe a implementação (mock | gemini)
import type { Question } from '../quiz/questions';
import type { QuizPlan } from '../quiz/weakness';
import { createGeminiService } from './ai.gemini';
import { mockQuizzer } from './ai.mock';

export interface AIInput {
  topic: string;
  context?: string;
  language?: string;
  /** Texto dos materiais de apoio do professor (quando houver) */
  materials?: string;
}

export interface QuizGenInput extends AIInput {
  plan: QuizPlan;
}

export interface ChatInput extends AIInput {
  /** conversa até aqui (sem a mensagem atual) */
  history: { sender: 'user' | 'bot'; text: string }[];
  message: string;
}

export interface FlashcardDraft {
  front: string;
  back: string;
  topic: string;
}

export interface AIService {
  summarize(input: AIInput): Promise<string>;
  generateFlashcards(input: AIInput & { count: number }): Promise<FlashcardDraft[]>;
  chat(input: ChatInput): Promise<string>;
  generateQuizz(input: QuizGenInput): Promise<Question[]>;
  gradeAnswer(input: { question: Question; answer: string; language?: string }): Promise<{ score: number; feedback: string }>;
}

const isPt = (language?: string) => !!language && language.toLowerCase().startsWith('pt');

/** Títulos dos materiais que o servidor colocou no contexto ("### Material: título") */
const materialTitles = (materials?: string) => [...(materials ?? '').matchAll(/^### Material: (.+)$/gm)].map((m) => m[1]);

const mockService: AIService = {
  async summarize({ topic, context, language, materials }) {
    const pt = isPt(language);
    const titles = materialTitles(materials);
    const note = titles.length
      ? (pt ? `> 📎 Baseado nos materiais do professor: ${titles.join(', ')}.\n\n` : `> 📎 Based on the teacher's materials: ${titles.join(', ')}.\n\n`)
      : '';
    return pt
      ? `# Resumo: ${topic}\n\n${note}> ⚠️ Resposta de **demonstração** (IA em modo mock).\n\n## Ideias principais\n* **Definição:** visão geral de "${topic}"${context ? ` no contexto de ${context}` : ''}.\n* **Importância:** por que o tema aparece com frequência nos estudos.\n* **Aplicações:** exemplos práticos para fixar o conteúdo.\n\n## Fontes\n* Khan Academy\n* MIT OpenCourseWare\n\n## Para aprofundar\n1. Conceitos fundamentais de ${topic}\n2. Exercícios resolvidos\n3. Aplicações em projetos reais`
      : `# Summary: ${topic}\n\n${note}> ⚠️ **Demo** response (AI in mock mode).\n\n## Key ideas\n* **Definition:** overview of "${topic}"${context ? ` in the context of ${context}` : ''}.\n* **Importance:** why the topic shows up so often in your studies.\n* **Applications:** practical examples to reinforce the content.\n\n## Sources\n* Khan Academy\n* MIT OpenCourseWare\n\n## To Deepen Your Knowledge\n1. Core concepts of ${topic}\n2. Worked exercises\n3. Applications in real projects`;
  },

  async chat({ message, language, materials }) {
    const pt = isPt(language);
    const titles = materialTitles(materials);
    const base = pt
      ? `Resposta de demonstração (IA em modo mock) para: "${message}".`
      : `Demo answer (AI in mock mode) for: "${message}".`;
    const note = titles.length
      ? (pt ? `\n\n📎 Consultei os materiais do professor: ${titles.join(', ')}.` : `\n\n📎 I checked the teacher's materials: ${titles.join(', ')}.`)
      : '';
    return base + note;
  },

  async generateFlashcards({ topic, count, language }) {
    const pt = isPt(language);
    const aspects = pt
      ? ['definição', 'exemplo', 'aplicação', 'erro comum', 'propriedade', 'por que importa', 'como começar', 'resumo']
      : ['definition', 'example', 'application', 'common mistake', 'property', 'why it matters', 'how to start', 'summary'];
    return Array.from({ length: count }, (_, i) => {
      const aspect = aspects[i % aspects.length];
      const n = Math.floor(i / aspects.length) + 1;
      return {
        front: pt ? `[Mock] Qual é a ${aspect} de ${topic}? (${n})` : `[Mock] What is the ${aspect} of ${topic}? (${n})`,
        back: pt ? `Resposta de demonstração sobre ${aspect} de ${topic}.` : `Demo answer about the ${aspect} of ${topic}.`,
        topic: `${topic}: ${aspect}`,
      };
    });
  },

  ...mockQuizzer,
};

// Escolha preguiçosa: a falta de chave só falha no modo gemini, sem derrubar o servidor
let service: AIService | null = null;

export function getAIService(): AIService {
  if (!service) {
    service = process.env.AI_MODE === 'gemini' ? createGeminiService() : mockService;
  }
  return service;
}
