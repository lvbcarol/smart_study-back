// src/components/ActiveQuiz.tsx — quiz de uma pergunta por tela, com 5 tipos de pergunta e correção no servidor
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Flag, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useStudyTimer } from '../hooks/useStudyTimer';
import { cn } from '@/lib/utils';
import { AnswerValue, DraftResponse, PublicQuestion, QuestionResult } from '../types/quiz';
import { TaskStart } from '../types/tasks';
import QuizzOptions from './QuizzOptions';
import AnswerForm from './quiz/AnswerForm';
import { Badge } from './ds/Misc';
import { Button } from './ds/Button';
import { Field } from './ds/Field';
import { Mascot } from './mascot/Mascot';

type Phase = 'topic' | 'generating' | 'answering' | 'grading' | 'feedback' | 'finishing' | 'done';

interface ActiveQuizProps {
  lessonId: string;
  onFinish: (attemptId?: string) => void;
  /** Modo tarefa: perguntas fixas do professor, sem correção na hora; retoma de onde o aluno parou */
  task?: TaskStart;
}

/** O servidor aceita de 4 a 12 perguntas por quiz */
const QUESTION_COUNTS = [4, 6, 8, 10, 12];

const ActiveQuiz: React.FC<ActiveQuizProps> = ({ lessonId, onFinish, task }) => {
  const { t, i18n } = useTranslation();
  const [topicInput, setTopicInput] = useState('');
  const [count, setCount] = useState(8);
  const [phase, setPhase] = useState<Phase>(task ? 'answering' : 'topic');
  const [draftId, setDraftId] = useState(task?.draftId ?? '');
  const [questions, setQuestions] = useState<PublicQuestion[]>(task?.questions ?? []);
  const [answers, setAnswers] = useState<AnswerValue[]>(task ? task.questions.map(() => null) : []);
  const [results, setResults] = useState<(QuestionResult | null)[]>(task ? task.questions.map(() => null) : []);
  const [current, setCurrent] = useState(task?.answeredCount ?? 0);
  const [attemptId, setAttemptId] = useState<string | undefined>();
  const [banners, setBanners] = useState<string[]>(task && task.answeredCount > 0 ? [t('tasks.resumeNote', { count: task.answeredCount, total: task.questions.length })] : []);
  const [finalMessage, setFinalMessage] = useState('');
  const [sentAnswer, setSentAnswer] = useState('');
  const topRef = useRef<HTMLDivElement>(null);
  // conta o tempo só enquanto o aluno está respondendo (não na escolha do tópico nem no resultado)
  useStudyTimer(task ? 'task' : 'quiz', task ? undefined : lessonId, phase !== 'topic' && phase !== 'generating' && phase !== 'done');

  // cada pergunta nova começa no topo da tela
  useEffect(() => { if (questions.length) topRef.current?.scrollIntoView({ block: 'start' }); }, [current, questions.length]);

  const answerText = (q: PublicQuestion, answer: string | string[] | number): string => {
    if (q.type === 'multiple_choice') return q.options?.[answer as number] ?? '';
    if (Array.isArray(answer)) return answer.map((a) => a || '—').join(' · ');
    return String(answer);
  };

  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = topicInput.trim();
    if (!topic || phase !== 'topic') return;
    setPhase('generating');
    try {
      const { data } = await api.post<DraftResponse>('/quizz/drafts', { lessonId, topic, language: i18n.language, count });
      setDraftId(data.draftId);
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => null));
      setResults(data.questions.map(() => null));
      setCurrent(0);
      const notes: string[] = [];
      if (data.materialsUsed > 0) notes.push(`📎 ${t('chat.materialsBanner', { count: data.materialsUsed })}`);
      if (data.reinforcing.length > 0) notes.push(`🎯 ${t('quizzPage.reinforcing', { topics: data.reinforcing.join(', ') })}`);
      setBanners(notes);
      setPhase('answering');
    } catch {
      toast.error(t('chat.aiError'));
      setPhase('topic');
    }
  };

  const submitAnswer = async (answer: string | string[] | number) => {
    const q = questions[current];
    setPhase('grading');
    if (q.type === 'multiple_choice') setAnswers((prev) => prev.map((a, i) => (i === current ? (answer as number) : a)));
    else setSentAnswer(answerText(q, answer));
    try {
      const { data } = await api.post<{ result?: QuestionResult; saved?: boolean }>(`/quizz/drafts/${draftId}/answer`, { index: current, answer });
      setAnswers((prev) => prev.map((a, i) => (i === current ? (answer as AnswerValue) : a)));
      // em tarefas o servidor não devolve o resultado: ele só aparece depois do envio
      if (data.result) {
        const result = data.result;
        setResults((prev) => prev.map((r, i) => (i === current ? result : r)));
      }
      setPhase('feedback');
    } catch {
      toast.error(t('quizzPage.answerError'));
      if (q.type === 'multiple_choice') setAnswers((prev) => prev.map((a, i) => (i === current ? null : a)));
      setSentAnswer('');
      setPhase('answering');
    }
  };

  const next = async () => {
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      setSentAnswer('');
      setPhase('answering');
      return;
    }
    setPhase('finishing');
    try {
      const { data } = await api.post<{ attemptId: string; score: number; correctCount: number; total: number }>(`/quizz/drafts/${draftId}/finish`);
      setAttemptId(data.attemptId);
      setFinalMessage(task ? t('tasks.sent', { score: data.score }) : t('chat.quizzFinished', { correct: data.correctCount, total: data.total, score: data.score }));
      setPhase('done');
    } catch {
      toast.error(t('quizzPage.saveError'));
      setPhase('feedback');
    }
  };

  /* ---------- escolha do tópico e da quantidade ---------- */
  if (phase === 'topic') {
    return (
      <form onSubmit={handleTopicSubmit} className="mx-auto max-w-xl space-y-6 rounded-3xl border border-border bg-card p-6 shadow-soft animate-fade-in-up">
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight">{t('quizzPage.topicTitle')}</h2>
          <p className="text-muted-foreground">{t('quizzPage.topicHint')}</p>
        </div>
        <Field label={t('quizzPage.topicLabel')} placeholder={t('chat.typeSubject')} value={topicInput} onChange={(e) => setTopicInput(e.target.value)} maxLength={200} autoFocus autoComplete="off" />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('quizzPage.countLabel')}</legend>
          <div role="radiogroup" aria-label={t('quizzPage.countLabel')} className="flex flex-wrap gap-2">
            {QUESTION_COUNTS.map((n) => (
              <button
                key={n} type="button" role="radio" aria-checked={count === n} onClick={() => setCount(n)}
                className={cn(
                  'min-h-11 min-w-14 rounded-full border-2 px-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  count === n ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:border-primary'
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{t('quizzPage.countOption', { count })}</p>
        </fieldset>
        <Button type="submit" size="lg" className="w-full" disabled={!topicInput.trim()}>
          <Sparkles className="h-5 w-5" aria-hidden="true" /> {t('quizzPage.start')}
        </Button>
      </form>
    );
  }

  if (phase === 'generating') {
    return (
      <div role="status" aria-live="polite" className="mx-auto flex max-w-xl flex-col items-center gap-4 py-24 text-center">
        <Mascot pose="think" size={120} />
        <p className="text-2xl font-extrabold">{t('quizzPage.generating')}</p>
        <p className="text-muted-foreground">{t('quizzPage.generatingHint')}</p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto max-w-xl space-y-6 rounded-3xl border border-border bg-card p-8 text-center shadow-soft animate-fade-in-up">
        <p role="status" className="whitespace-pre-line text-lg font-medium">{finalMessage}</p>
        <Button size="lg" onClick={() => onFinish(attemptId)}>{task ? t('tasks.viewResult') : t('quizzPage.viewAttempts')}</Button>
      </div>
    );
  }

  /* ---------- uma pergunta por tela ---------- */
  const q = questions[current];
  const result = results[current];
  const isLast = current + 1 >= questions.length;
  const doneCount = current + (phase === 'feedback' ? 1 : 0);
  const busy = phase === 'grading' || phase === 'finishing';
  const verdict = result
    ? result.correct ? { text: t('quizzPage.verdictCorrect'), variant: 'success' as const }
    : result.score > 0 ? { text: t('quizzPage.verdictPartial', { pct: Math.round(result.score * 100) }), variant: 'warning' as const }
    : { text: t('quizzPage.verdictWrong'), variant: 'destructive' as const }
    : null;

  return (
    <div ref={topRef} className="mx-auto flex max-w-2xl scroll-mt-20 flex-col gap-6">
      <div className="space-y-3">
        <div
          role="progressbar" aria-label={t('quizzPage.progress')} aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={doneCount}
          className="flex gap-1"
        >
          {questions.map((_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < doneCount ? 'bg-primary' : i === current ? 'bg-accent' : 'bg-secondary')} />
          ))}
        </div>
        <div className="flex items-center justify-between text-sm font-medium">
          <span aria-live="polite">{t('quizzPage.questionOf', { current: current + 1, total: questions.length })}</span>
          <span className="flex items-center gap-2">
            {q.reinforcement && <Badge variant="warning">{t('quizzPage.reinforcement')}</Badge>}
            <Badge variant="primary">{t(`quizzPage.types.${q.type}`)}</Badge>
          </span>
        </div>
      </div>

      {/* a key reinicia a animação de entrada a cada pergunta */}
      <section key={q.id} aria-label={t('quizzPage.questionOf', { current: current + 1, total: questions.length })} className="animate-quiz-slide space-y-5">
        {current === 0 && banners.map((b) => <p key={b} className="rounded-xl bg-accent px-4 py-2 text-sm text-accent-foreground">{b}</p>)}
        {q.scenario && <blockquote className="rounded-2xl bg-secondary p-4 text-muted-foreground">{q.scenario}</blockquote>}
        <h2 className="text-2xl font-bold leading-snug tracking-tight">{q.question}</h2>

        {q.type === 'multiple_choice' ? (
          <QuizzOptions
            className="space-y-2"
            options={q.options ?? []}
            selectedIndex={typeof answers[current] === 'number' ? (answers[current] as number) : null}
            correctIndex={result?.correctIndex ?? null}
            onSelect={submitAnswer}
            disabled={phase !== 'answering'}
          />
        ) : phase === 'answering' || phase === 'grading' ? (
          <AnswerForm key={q.id} question={q} onSubmit={submitAnswer} disabled={phase === 'grading'} />
        ) : sentAnswer ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-muted-foreground">{t('quizzPage.yourAnswer')}</p>
            <p className="mt-1 whitespace-pre-wrap">{sentAnswer}</p>
          </div>
        ) : null}

        {phase === 'answering' && q.type === 'multiple_choice' && <p className="text-sm text-muted-foreground">{t('quizzPage.pickOption')}</p>}

        {result && verdict && (
          <div
            role="status"
            className={cn('space-y-2 rounded-2xl border-2 bg-card p-4', result.correct ? 'border-success' : result.score > 0 ? 'border-warning' : 'border-destructive')}
          >
            <Badge variant={verdict.variant} className="text-sm">{verdict.text}</Badge>
            {result.feedback && <p>{result.feedback}</p>}
            {!result.correct && (
              <p><span className="block text-sm text-muted-foreground">{t('quizzPage.expected')}</span><span className="font-semibold">{result.correctAnswer}</span></p>
            )}
            {result.explanation && (
              <p><span className="block text-sm text-muted-foreground">{t('chat.explanationLabel')}</span>{result.explanation}</p>
            )}
          </div>
        )}
      </section>

      <div className="sticky bottom-4 flex justify-center">
        {phase === 'feedback' && (
          <Button size="lg" onClick={next}>
            {isLast ? <><Flag className="h-5 w-5" aria-hidden="true" /> {task ? t('tasks.sendTask') : t('quizzPage.seeResult')}</> : <>{t('quizzPage.next')} <ArrowRight className="h-5 w-5" aria-hidden="true" /></>}
          </Button>
        )}
        {busy && phase === 'finishing' && <Button size="lg" loading disabled>{t('chat.thinking')}</Button>}
      </div>
    </div>
  );
};

export default ActiveQuiz;
