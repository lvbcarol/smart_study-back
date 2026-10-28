// src/routes/ai.routes.ts
import { Router, Request } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware } from '../middleware/auth.middleware';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();
router.use(authMiddleware);

// Verificação da chave de API na inicialização
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY not found in .env file');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Rota para gerar resumos
router.post('/summarize', async (req: AuthRequest, res) => {
  const { topic, context, language } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required.' });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const langInstruction = language === 'pt' 
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
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    res.json({ summary: text });
  } catch (error) {
    console.error('AI API Error:', error);
    res.status(500).json({ error: 'Failed to generate summary.' });
  }
});

// Rota para gerar o Quizz
router.post('/generate-quizz', async (req: AuthRequest, res) => {
  const { topic, context, language } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required.' });

  let textFromAI = '';

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const langInstruction = language === 'pt'
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
    
    const result = await model.generateContent(prompt);
    textFromAI = result.response.text();

    const firstBrace = textFromAI.indexOf('{');
    const lastBrace = textFromAI.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('Valid JSON not found in AI response');
    }
    
    const jsonString = textFromAI.substring(firstBrace, lastBrace + 1);
    const quizzData = JSON.parse(jsonString);
    return res.json(quizzData);

  } catch (error: any) {
    console.error('--- AI QUIZZ GENERATION FAILED ---');
    console.error('Error Object:', error);
    console.error('--- RAW RESPONSE FROM AI ---');
    console.error(textFromAI);
    console.error('-----------------------------');
    res.status(500).json({ error: 'Failed to generate quizz.' });
  }
});

// Rota para analisar o resultado do Quizz
router.post('/analyze-quizz', async (req: AuthRequest, res) => {
  const { quizzData, userAnswers, language } = req.body;
  if (!quizzData || !userAnswers) {
    return res.status(400).json({ error: 'Quizz data and user answers are required.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const mistakes = quizzData.filter((q: any, index: number) => userAnswers[index] !== q.correctAnswerIndex);
    
    if (mistakes.length === 0) {
      const successMessage = language === 'pt'
        ? "Excelente trabalho! Você acertou tudo. Você tem um ótimo entendimento deste tópico. Continue assim!"
        : "Excellent work! You got a perfect score. You have a solid understanding of this topic. Keep up the great work!";
      return res.json({ feedback: successMessage });
    }

    const langInstruction = language === 'pt'
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

    const result = await model.generateContent(prompt);
    const feedback = result.response.text();
    res.json({ feedback });

  } catch (error) {
    console.error('AI Quizz Analysis Error:', error);
    res.status(500).json({ error: 'Failed to generate quizz feedback.' });
  }
});

export default router;