// src/pages/QuizzPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import ActiveQuiz from '../components/ActiveQuiz';
import ChatMessage from '../components/ChatMessage';
import QuizzOptions from '../components/QuizzOptions';
import { Button } from '../components/ds/Button';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { BackLink, PageHeader } from '../components/ds/PageParts';

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
interface Attempt {
  _id: string;
  attemptNumber: number;
  score: number;
  date: string;
  chatHistory: Message[];
  quizData: QuizQuestion[];
  userAnswers: (number | null)[];
}

const scoreVariant = (score: number) => (score >= 70 ? 'success' : score >= 50 ? 'warning' : 'destructive');

const QuizzPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { t, i18n } = useTranslation();

  const [view, setView] = useState<'list' | 'active_quiz' | 'view_attempt'>('list');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === 'view_attempt') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedAttempt, view]);

  const fetchAttempts = async () => {
    if (!lessonId) return;
    setIsLoading(true);
    try {
      const response = await api.get(`/lessons/${lessonId}`);
      setLessonTitle(response.data.lessonTitle);
      setAttempts(response.data.quizzAttempts || []);
    } catch {
      toast.error(t('quizzPage.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'list') fetchAttempts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, view]);

  const handleQuizSave = async (score: number, chatHistory: Message[], quizData: QuizQuestion[], userAnswers: (number | null)[]) => {
    if (!lessonId) return;
    const loadingToast = toast.loading(t('chat.savingQuizz'));
    try {
      await api.post(`/lessons/${lessonId}/quizz-attempts`, { score, chatHistory, quizData, userAnswers });
      toast.dismiss(loadingToast);
      toast.success(t('quizzPage.saveSuccess'));
      setView('list');
    } catch {
      toast.dismiss(loadingToast);
      toast.error(t('quizzPage.saveError'));
    }
  };

  if (view === 'active_quiz') {
    return (
      <div className="space-y-2">
        <div className="chat-container">
          <Button variant="ghost" size="sm" onClick={() => setView('list')}>{t('quizzPage.backToAttempts')}</Button>
        </div>
        <ActiveQuiz lessonTitle={lessonTitle} onQuizComplete={handleQuizSave} />
      </div>
    );
  }

  if (view === 'view_attempt' && selectedAttempt) {
    return (
      <div className="chat-container">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">{t('quizzPage.reviewingAttempt', { number: selectedAttempt.attemptNumber, score: selectedAttempt.score })}</h1>
          <Button variant="outline" onClick={() => setView('list')}>{t('quizzPage.backToAttempts')}</Button>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
          {selectedAttempt.chatHistory.map((msg, index) => (
            <div key={index}>
              <ChatMessage message={msg} />
              {msg.quizzOptions && selectedAttempt.quizData && selectedAttempt.userAnswers && (
                <QuizzOptions
                  options={msg.quizzOptions.options}
                  correctAnswerIndex={msg.quizzOptions.correctAnswerIndex}
                  selectedAnswerIndex={selectedAttempt.userAnswers[msg.questionIndex!] ?? null}
                  onSelectAnswer={() => undefined}
                />
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to={`/subjects/${lessonId}`}>{t('chat.backToSubject')}</BackLink>
      <PageHeader
        className="mt-3"
        title={t('quizzPage.title', { lessonTitle })}
        actions={<Button onClick={() => setView('active_quiz')}><Plus className="h-5 w-5" aria-hidden="true" /> {t('quizzPage.startNew')}</Button>}
      />

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label={t('quizzPage.loading')}>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : attempts.length === 0 ? (
        <EmptyState title={t('quizzPage.noAttempts')} />
      ) : (
        <ul className="space-y-3" aria-label={t('quizzPage.attemptsTitle')}>
          {attempts.slice().reverse().map((att, index) => (
            <li key={att._id} className="animate-fade-in-up" style={{ animationDelay: `${index * 60}ms` }}>
              <button
                onClick={() => { setSelectedAttempt(att); setView('view_attempt'); }}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>
                  <span className="block font-display text-lg font-bold">{t('quizzPage.attempt', { number: att.attemptNumber })}</span>
                  <span className="text-sm text-muted-foreground">{new Date(att.date).toLocaleString(i18n.language)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <Badge variant={scoreVariant(att.score)} className="px-3 py-1 text-base">{t('quizzPage.pointsLabel', { score: att.score })}</Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default QuizzPage;
