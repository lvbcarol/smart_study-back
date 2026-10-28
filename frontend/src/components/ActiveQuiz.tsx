// src/components/ActiveQuiz.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import ChatMessage from './ChatMessage';
import QuizzOptions from './QuizzOptions';
import { Button } from './ds/Button';
import { ChatInput } from './ds/ChatInput';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}
interface Message {
  sender: 'user' | 'bot';
  text: string;
  quizzOptions?: QuizQuestion;
  questionIndex?: number;
}

interface ActiveQuizProps {
  lessonTitle: string;
  onQuizComplete: (score: number, chatHistory: Message[], quizData: QuizQuestion[], userAnswers: (number | null)[]) => void;
}

const ActiveQuiz: React.FC<ActiveQuizProps> = ({ lessonTitle, onQuizComplete }) => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quizData, setQuizData] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [quizFlowState, setQuizFlowState] = useState<'initial' | 'started' | 'finished'>('initial');
  const hasInitialized = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasInitialized.current) {
      addMessage('bot', t('chat.quizzInitial'));
      hasInitialized.current = true;
    }
  }, [t]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const addMessage = (sender: 'user' | 'bot', text: string, quizzOptions?: QuizQuestion, questionIndex?: number) => {
    setMessages((prev) => [...prev, { sender, text, quizzOptions, questionIndex }]);
  };

  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = userInput.trim();
    if (!topic || isLoading) return;

    addMessage('user', topic);
    setUserInput('');
    setIsLoading(true);
    setQuizFlowState('started');

    try {
      const response = await api.post('/ai/generate-quizz', { topic, context: lessonTitle, language: i18n.language });
      const quizz: QuizQuestion[] = response.data.quizz;
      setQuizData(quizz);
      setUserAnswers(Array(quizz.length).fill(null));
      addMessage('bot', `${t('chat.questionLabel', { number: 1 })}: ${quizz[0].question}`, quizz[0], 0);
    } catch {
      addMessage('bot', t('chat.aiError'));
      setQuizFlowState('initial');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (selectedIndex: number, questionIndex: number) => {
    const updatedAnswers = [...userAnswers];
    updatedAnswers[questionIndex] = selectedIndex;
    setUserAnswers(updatedAnswers);

    setTimeout(() => {
      addMessage('bot', `${t('chat.explanationLabel')}: ${quizData[questionIndex].explanation}`);

      setTimeout(() => {
        const nextIndex = questionIndex + 1;
        if (nextIndex < quizData.length) {
          addMessage('bot', `${t('chat.questionLabel', { number: nextIndex + 1 })}: ${quizData[nextIndex].question}`, quizData[nextIndex], nextIndex);
        } else {
          finishQuizz(updatedAnswers);
        }
      }, 2000);
    }, 1000);
  };

  const scoreOf = (answers: (number | null)[]) => {
    const correct = answers.filter((answer, index) => answer === quizData[index].correctAnswerIndex).length;
    return { correct, score: Math.round((correct / quizData.length) * 100) };
  };

  const finishQuizz = (finalAnswers: (number | null)[]) => {
    setQuizFlowState('finished');
    const { correct, score } = scoreOf(finalAnswers);
    addMessage('bot', t('chat.quizzFinished', { correct, total: quizData.length, score }));
    // Para aqui, esperando o usuário clicar em "Salvar".
  };

  const handleSaveAndExit = () => {
    onQuizComplete(scoreOf(userAnswers).score, messages, quizData, userAnswers);
  };

  return (
    <div className="chat-container flex flex-col">
      <div role="log" aria-live="polite" aria-label={t('chat.assistant')} className="min-h-[50vh]">
        {messages.map((msg, index) => (
          <div key={index}>
            <ChatMessage message={msg} />
            {msg.quizzOptions && (
              <QuizzOptions
                options={msg.quizzOptions.options}
                correctAnswerIndex={msg.quizzOptions.correctAnswerIndex}
                selectedAnswerIndex={userAnswers[msg.questionIndex!] ?? null}
                onSelectAnswer={(selectedIndex) => handleAnswerSelect(selectedIndex, msg.questionIndex!)}
              />
            )}
          </div>
        ))}
        {isLoading && <ChatMessage message={{ sender: 'bot', text: t('chat.thinking') }} />}
        <div ref={chatEndRef} />
      </div>

      <div className="sticky bottom-4 mt-4">
        {quizFlowState === 'initial' && (
          <ChatInput value={userInput} onChange={setUserInput} onSubmit={handleTopicSubmit} placeholder={t('chat.typeSubject')} disabled={isLoading} />
        )}
        {quizFlowState === 'finished' && (
          <div className="flex justify-center">
            <Button size="lg" onClick={handleSaveAndExit}><Save className="h-5 w-5" aria-hidden="true" /> {t('chat.saveQuizz')}</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveQuiz;
