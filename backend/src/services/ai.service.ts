// src/services/ai.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface QuizzQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface AIInput {
  topic: string;
  context?: string;
  language?: string;
}

export interface AIService {
  summarize(input: AIInput): Promise<string>;
  generateQuizz(input: AIInput): Promise<{ quizz: QuizzQuestion[] }>;
  analyzeQuizz(input: { quizzData: QuizzQuestion[]; userAnswers: number[]; language?: string }): Promise<string>;
}

const isPt = (language?: string) => !!language && language.toLowerCase().startsWith('pt');

// ---------------------------------------------------------------------------
// MOCK: respostas ficticias, sem chave e sem rede
// ---------------------------------------------------------------------------
const mockService: AIService = {
  async summarize({ topic, context, language }) {
    const pt = isPt(language);
    return pt
      ? `# Resumo: ${topic}\n\n> ⚠️ Resposta de **demonstração** (IA em modo mock).\n\n## Ideias principais\n* **Definição:** visão geral de "${topic}"${context ? ` no contexto de ${context}` : ''}.\n* **Importância:** por que o tema aparece com frequência nos estudos.\n* **Aplicações:** exemplos práticos para fixar o conteúdo.\n\n## Fontes\n* Khan Academy\n* MIT OpenCourseWare\n\n## Para aprofundar\n1. Conceitos fundamentais de ${topic}\n2. Exercícios resolvidos\n3. Aplicações em projetos reais`
      : `# Summary: ${topic}\n\n> ⚠️ **Demo** response (AI in mock mode).\n\n## Key ideas\n* **Definition:** overview of "${topic}"${context ? ` in the context of ${context}` : ''}.\n* **Importance:** why the topic shows up so often in your studies.\n* **Applications:** practical examples to reinforce the content.\n\n## Sources\n* Khan Academy\n* MIT OpenCourseWare\n\n## To Deepen Your Knowledge\n1. Core concepts of ${topic}\n2. Worked exercises\n3. Applications in real projects`;
  },

  async generateQuizz({ topic, language }) {
    const pt = isPt(language);
    const quizz: QuizzQuestion[] = Array.from({ length: 8 }, (_, i) => {
      const correctAnswerIndex = i % 4;
      const options = [0, 1, 2, 3].map((o) =>
        o === correctAnswerIndex
          ? pt ? `Alternativa correta (questão ${i + 1})` : `Correct option (question ${i + 1})`
          : pt ? `Alternativa incorreta ${o + 1}` : `Incorrect option ${o + 1}`
      );
      return {
        question: pt
          ? `[Mock] Questão ${i + 1} sobre ${topic}: qual alternativa está correta?`
          : `[Mock] Question ${i + 1} about ${topic}: which option is correct?`,
        options,
        correctAnswerIndex,
        explanation: pt
          ? `Explicação de demonstração: a alternativa ${correctAnswerIndex + 1} é a correta.`
          : `Demo explanation: option ${correctAnswerIndex + 1} is the correct one.`,
      };
    });
    return { quizz };
  },

  async analyzeQuizz({ quizzData, userAnswers, language }) {
    return buildAnalysisOrNull(quizzData, userAnswers, language) ?? (isPt(language)
      ? '## Feedback (demonstração)\nBom esforço! Revise as questões que errou.\n\n**Principais tópicos para revisar**\n* Conceitos básicos do tema\n\n**Recursos recomendados**\n* Khan Academy'
      : '## Feedback (demo)\nGreat effort! Review the questions you missed.\n\n**Key Topics to Review**\n* Basic concepts of the topic\n\n**Recommended Resources**\n* Khan Academy');
  },
};

// Atalho comum aos dois modos: se acertou tudo, nao precisa chamar a IA
function buildAnalysisOrNull(quizzData: QuizzQuestion[], userAnswers: number[], language?: string): string | null {
  const mistakes = quizzData.filter((q, index) => userAnswers[index] !== q.correctAnswerIndex);
  if (mistakes.length > 0) return null;
  return isPt(language)
    ? 'Excelente trabalho! Você acertou tudo. Você tem um ótimo entendimento deste tópico. Continue assim!'
    : 'Excellent work! You got a perfect score. You have a solid understanding of this topic. Keep up the great work!';
}

// ---------------------------------------------------------------------------
// GEMINI: IA real
// ---------------------------------------------------------------------------
function createGeminiService(): AIService {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('AI_MODE=gemini exige GEMINI_API_KEY no .env');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const getModel = (json = false) =>
    genAI.getGenerativeModel({
      model: modelName,
      ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    });

  return {
    async summarize({ topic, context, language }) {
      const langInstruction = isPt(language)
        ? 'Your entire response MUST be in Brazilian Portuguese.'
        : 'Your entire response MUST be in English.';

      const prompt = `
      You are "StudyBot", a friendly and didactic AI tutor for university students.
      ${langInstruction}
      Your personality is encouraging and supportive.
      A student has asked for a summary of the following topic. Please provide a response that follows all these rules:
      1.  **Tone**: Be friendly and didactic. Your goal is to make complex topics easy to understand.
      2.  **Content**: Explain the most relevant and important points of the topic. Base your explanation on established academic knowledge, textbooks, and current materials.
      3.  **Formatting**: Use Markdown extensively for clear formatting. Use headings (#), bold text (**term**), bullet points (*), and numbered lists to structure the information for easy reading and studying.
      4.  **Citations**: At the end of your summary, include a section titled "Sources" and list credible sources you conceptually drew upon (e.g., specific well-known textbooks, academic websites like Khan Academy, MIT OpenCourseWare, etc.). Do not invent URLs.
      5.  **Further Study**: After the sources, include a section titled "To Deepen Your Knowledge". Suggest 2-3 related sub-topics the student could explore next.
      6.  **Book/Site Suggestions**: Also in the "To Deepen Your Knowledge" section, suggest 1-2 specific, real books or websites the student can consult.
      Here is the student's request:
      Topic: "${topic}"
      Course Context: "${context || 'General'}"
    `;
      const result = await getModel().generateContent(prompt);
      return result.response.text();
    },

    async generateQuizz({ topic, context, language }) {
      const langInstruction = isPt(language)
        ? 'All text content in your JSON response (questions, options, explanations) MUST be in Brazilian Portuguese.'
        : 'All text content in your JSON response (questions, options, explanations) MUST be in English.';

      const prompt = `
      You are an expert academic tutor.
      ${langInstruction}
      Based on the following topic, generate a challenging 8-question multiple-choice quiz for a university student.
      Your response MUST be a valid JSON object only, without any surrounding text or markdown markers.
      The JSON object must have a single key "quizz" which is an array of 8 question objects.
      Each question object must have these exact keys:
      - "question": string (the question text)
      - "options": an array of 4 strings (the possible answers)
      - "correctAnswerIndex": number (the 0-based index of the correct answer in the "options" array)
      - "explanation": string (a brief and didactic explanation of why the correct answer is right)
      Topic: "${topic}"
      Course Context: "${context || 'General'}"
    `;
      const result = await getModel(true).generateContent(prompt);
      const text = result.response.text();

      // Fallback: extrai o JSON caso o modelo devolva texto ao redor
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('Valid JSON not found in AI response');
      }
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    },

    async analyzeQuizz({ quizzData, userAnswers, language }) {
      const perfect = buildAnalysisOrNull(quizzData, userAnswers, language);
      if (perfect) return perfect;

      const mistakes = quizzData.filter((q, index) => userAnswers[index] !== q.correctAnswerIndex);
      const langInstruction = isPt(language)
        ? 'Your entire response MUST be in Brazilian Portuguese.'
        : 'Your entire response MUST be in English.';

      const prompt = `
      You are "StudyBot", an encouraging AI tutor for university students.
      ${langInstruction}
      A student just finished a quiz and made these mistakes: ${JSON.stringify(mistakes, null, 2)}

      Please provide personalized feedback based on these mistakes. Your response MUST follow this structure exactly:

      1.  **Start with a positive and encouraging sentence**, like "Great effort on the quiz! Let's review some key concepts to solidify your knowledge."
      2.  **Mistake Analysis:** For each question they got wrong, briefly and didactically explain the core concept they may have misunderstood. Frame it constructively.
      3.  **Topics to Review:** Create a bulleted list under the heading "**Key Topics to Review**".
      4.  **Recommendations for Further Study:** Create another bulleted list under the heading "**Recommended Resources**". Suggest 2-3 specific, real, high-quality resources like textbooks (with authors), educational websites (like Khan Academy, Coursera, MIT OpenCourseWare), or YouTube channels that can help with the topics they need to review.

      Format your entire response using Markdown for readability (headings with ##, bold text with **, and bullet points with *).
    `;
      const result = await getModel().generateContent(prompt);
      return result.response.text();
    },
  };
}

// ---------------------------------------------------------------------------
// Selecao do modo (lazy, para que a falta de chave nao derrube o servidor)
// ---------------------------------------------------------------------------
let service: AIService | null = null;

export function getAIService(): AIService {
  if (!service) {
    service = process.env.AI_MODE === 'gemini' ? createGeminiService() : mockService;
  }
  return service;
}
