// src/components/ActiveQuiz.tsx — quiz em formato de conversa, com 5 tipos de pergunta e correção no servidor
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { AnswerValue, DraftResponse, PublicQuestion, QuestionResult } from '../types/quiz';
import ChatMessage from './ChatMessage';
import QuizzOptions from './QuizzOptions';
import AnswerForm from './quiz/AnswerForm';
import { Badge } from './ds/Misc';
import { Button } from './ds/Button';
import { ChatInput } from './ds/ChatInput';

interface ChatMsg {
  sender: 'user' | 'bot';
  text: string;
  /** índice da pergunta quando a mensagem traz alternativas de múltipla escolha */
  qIndex?: number;
}

type Phase = 'topic' | 'generating' | 'answering' | 'grading' | 'feedback' | 'finishing' | 'done';

interface ActiveQuizProps {
  lessonId: string;
  onFinish: () => void;
}

const escapeMd = (s: string) => s.replace(/_/g, '\\_');

const ActiveQuiz: React.FC<ActiveQuizProps> = ({ lessonId, onFinish }) => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [phase, setPhase] = useState<Phase>('topic');
  const [draftId, setDraftId] = useState('');
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerValue[]>([]);
  const [results, setResults] = useState<(QuestionResult | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const initialized = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const push = (...msgs: ChatMsg[]) => setMessages((prev) => [...prev, ...msgs]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      push({ sender: 'bot', text: t('chat.quizzInitial') });
    }
  }, [t]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase]);

  const questionText = (q: PublicQuestion, index: number, total: number) => {
    const head = [`**${t('quizzPage.questionOf', { current: index + 1, total })}**`, t(`quizzPage.types.${q.type}`)];
    if (q.reinforcement) head.push(`🎯 ${t('quizzPage.reinforcement')}`);
    const scenario = q.scenario ? `> ${escapeMd(q.scenario)}\n\n` : '';
    return `${head.join(' · ')}\n\n${scenario}${escapeMd(q.question)}`;
  };

  const answerText = (q: PublicQuestion, answer: string | string[] | number): string => {
    if (q.type === 'multiple_choice') return q.options?.[answer as number] ?? '';
    if (Array.isArray(answer)) return answer.map((a) => a || '—').join(' · ');
    return String(answer);
  };

  const feedbackText = (r: QuestionResult) => {
    const pct = Math.round(r.score * 100);
    const verdict = r.correct ? `✅ **${t('quizzPage.verdictCorrect')}**` : r.score > 0 ? `◑ **${t('quizzPage.verdictPartial', { pct })}**` : `❌ **${t('quizzPage.verdictWrong')}**`;
    const lines = [verdict];
    if (r.feedback) lines.push(escapeMd(r.feedback));
    if (!r.correct) lines.push(`**${t('quizzPage.expected')}:** ${escapeMd(r.correctAnswer)}`);
    if (r.explanation) lines.push(`**${t('chat.explanationLabel')}:** ${escapeMd(r.explanation)}`);
    return lines.join('\n\n');
  };

  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = topicInput.trim();
    if (!topic || phase !== 'topic') return;

    push({ sender: 'user', text: topic });
    setTopicInput('');
    setPhase('generating');
    try {
      const { data } = await api.post<DraftResponse>('/quizz/drafts', { lessonId, topic, language: i18n.language, count: 8 });
      setDraftId(data.draftId);
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => null));
      setResults(data.questions.map(() => null));
      setCurrent(0);
      const intro: ChatMsg[] = [];
      if (data.materialsUsed > 0) intro.push({ sender: 'bot', text: `📎 ${t('chat.materialsBanner', { count: data.materialsUsed })}` });
      if (data.reinforcing.length > 0) intro.push({ sender: 'bot', text: t('quizzPage.reinforcing', { topics: data.reinforcing.join(', ') }) });
      intro.push({ sender: 'bot', text: questionText(data.questions[0], 0, data.questions.length), qIndex: 0 });
      push(...intro);
      setPhase('answering');
    } catch {
      push({ sender: 'bot', text: t('chat.aiError') });
      setPhase('topic');
    }
  };

  const submitAnswer = async (answer: string | string[] | number) => {
    const q = questions[current];
    setPhase('grading');
    if (q.type === 'multiple_choice') {
      setAnswers((prev) => prev.map((a, i) => (i === current ? (answer as number) : a)));
    } else {
      push({ sender: 'user', text: answerText(q, answer) });
    }
    try {
      const { data } = await api.post<{ result: QuestionResult }>(`/quizz/drafts/${draftId}/answer`, { index: current, answer });
      setAnswers((prev) => prev.map((a, i) => (i === current ? (answer as AnswerValue) : a)));
      setResults((prev) => prev.map((r, i) => (i === current ? data.result : r)));
      push({ sender: 'bot', text: feedbackText(data.result) });
      setPhase('feedback');
    } catch {
      toast.error(t('quizzPage.answerError'));
      if (q.type === 'multiple_choice') setAnswers((prev) => prev.map((a, i) => (i === current ? null : a)));
      setPhase('answering');
    }
  };

  const next = async () => {
    if (current + 1 < questions.length) {
      const i = current + 1;
      setCurrent(i);
      push({ sender: 'bot', text: questionText(questions[i], i, questions.length), qIndex: i });
      setPhase('answering');
      return;
    }
    setPhase('finishing');
    try {
      const { data } = await api.post<{ score: number; correctCount: number; total: number }>(`/quizz/drafts/${draftId}/finish`);
      push({ sender: 'bot', text: t('chat.quizzFinished', { correct: data.correctCount, total: data.total, score: data.score }) });
      setPhase('done');
    } catch {
      toast.error(t('quizzPage.saveError'));
      setPhase('feedback');
    }
  };

  const q = questions[current];
  const isLast = current + 1 >= questions.length;
  const busy = phase === 'generating' || phase === 'grading' || phase === 'finishing';

  return (
    <div className="chat-container flex flex-col">
      {questions.length > 0 && phase !== 'done' && (
        <div className="sticky top-16 z-10 -mx-1 mb-2 space-y-2 bg-background px-1 py-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{t('quizzPage.questionOf', { current: current + 1, total: questions.length })}</span>
            <span className="flex items-center gap-2">
              {q.reinforcement && <Badge variant="warning">{t('quizzPage.reinforcement')}</Badge>}
              <Badge variant="primary">{t(`quizzPage.types.${q.type}`)}</Badge>
            </span>
          </div>
          <div
            role="progressbar" aria-label={t('quizzPage.progress')} aria-valuemin={0} aria-valuemax={questions.length}
            aria-valuenow={current + (phase === 'feedback' ? 1 : 0)} className="h-2 overflow-hidden rounded-full bg-secondary"
          >
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((current + (phase === 'feedback' ? 1 : 0)) / questions.length) * 100}%` }} />
          </div>
        </div>
      )}

      <div role="log" aria-live="polite" aria-label={t('chat.assistant')} className="min-h-[40vh]">
        {messages.map((msg, index) => (
          <div key={index}>
            <ChatMessage message={msg} />
            {msg.qIndex !== undefined && questions[msg.qIndex]?.type === 'multiple_choice' && (
              <QuizzOptions
                options={questions[msg.qIndex].options ?? []}
                selectedIndex={typeof answers[msg.qIndex] === 'number' ? (answers[msg.qIndex] as number) : null}
                correctIndex={results[msg.qIndex]?.correctIndex ?? null}
                onSelect={submitAnswer}
                disabled={msg.qIndex !== current || phase !== 'answering'}
              />
            )}
          </div>
        ))}
        {busy && <ChatMessage message={{ sender: 'bot', text: phase === 'generating' ? t('quizzPage.generating') : t('chat.thinking') }} />}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-4 mt-4 space-y-3">
        {phase === 'topic' && (
          <ChatInput value={topicInput} onChange={setTopicInput} onSubmit={handleTopicSubmit} placeholder={t('chat.typeSubject')} />
        )}
        {(phase === 'answering' || phase === 'grading') && q && q.type !== 'multiple_choice' && (
          <AnswerForm key={q.id} question={q} onSubmit={submitAnswer} disabled={phase === 'grading'} />
        )}
        {phase === 'answering' && q?.type === 'multiple_choice' && (
          <p className="text-center text-sm text-muted-foreground">{t('quizzPage.pickOption')}</p>
        )}
        {phase === 'feedback' && (
          <div className="flex justify-center">
            <Button size="lg" onClick={next}>
              {isLast ? <><Flag className="h-5 w-5" aria-hidden="true" /> {t('quizzPage.seeResult')}</> : <>{t('quizzPage.next')} <ArrowRight className="h-5 w-5" aria-hidden="true" /></>}
            </Button>
          </div>
        )}
        {phase === 'done' && (
          <div className="flex justify-center">
            <Button size="lg" onClick={onFinish}>{t('quizzPage.viewAttempts')}</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveQuiz;
