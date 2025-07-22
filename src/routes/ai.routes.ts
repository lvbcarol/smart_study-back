// src/routes/ai.routes.ts
import { Router, Request } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware } from '../middleware/auth.middleware';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();
router.use(authMiddleware);

// Inicializa o cliente da IA com sua chave de API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// Rota para gerar resumos

router.post('/summarize', async (req: AuthRequest, res) => {
  const { topic, context } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // ✅ PROMPT APRIMORADO E DETALHADO
    const prompt = `
      You are "StudyBot", a friendly and didactic AI tutor for university students.
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

export default router;
