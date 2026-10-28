// src/pages/QuizzPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { AnswerValue, AttemptDetail, PublicQuestion, QuestionResult } from '../types/quiz';
import ActiveQuiz from '../components/ActiveQuiz';
import WeaknessPanel from '../components/quiz/WeaknessPanel';
import { Button } from '../components/ds/Button';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { BackLink, PageHeader } from '../components/ds/PageParts';

const scoreVariant = (score: number) => (score >= 70 ? 'success' : score >= 50 ? 'warning' : 'destructive');

/** Uma pergunta da tentativa, com a resposta do aluno e o resultado. */
const ReviewItem: React.FC<{ index: number; question: PublicQuestion; answer: AnswerValue; result?: QuestionResult }> = ({ index, question, answer, result }) => {
  const { t } = useTranslation();
  const answerText =
    answer === null || answer === undefined ? t('quizzPage.noAnswer')
    : question.type === 'multiple_choice' ? (question.options?.[answer as number] ?? '')
    : Array.isArray(answer) ? answer.map((a) => a || '—').join(' · ')
    : String(answer);
  const pct = result ? Math.round(result.score * 100) : 0;
  const verdict = result?.correct ? 'success' : result && result.score > 0 ? 'warning' : 'destructive';
  const verdictText = result?.correct ? t('quizzPage.verdictCorrect') : result && result.score > 0 ? t('quizzPage.verdictPartial', { pct }) : t('quizzPage.verdictWrong');

  return (
    <li className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display font-bold">{index + 1}.</span>
        <Badge variant="primary">{t(`quizzPage.types.${question.type}`)}</Badge>
        {question.reinforcement && <Badge variant="warning">{t('quizzPage.reinforcement')}</Badge>}
        <Badge variant={verdict} className="ml-auto">{verdictText}</Badge>
      </div>
      {question.scenario && <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{question.scenario}</p>}
      <p className="font-medium">{question.question}</p>
      <dl className="space-y-2 text-sm">
        <div><dt className="text-muted-foreground">{t('quizzPage.yourAnswer')}</dt><dd className="whitespace-pre-wrap font-medium">{answerText}</dd></div>
        {result && !result.correct && (
          <div><dt className="text-muted-foreground">{t('quizzPage.expected')}</dt><dd className="font-medium">{result.correctAnswer}</dd></div>
        )}
        {result?.feedback && <div><dt className="text-muted-foreground">{t('quizzPage.feedback')}</dt><dd>{result.feedback}</dd></div>}
        {result?.explanation && <div><dt className="text-muted-foreground">{t('chat.explanationLabel')}</dt><dd>{result.explanation}</dd></div>}
      </dl>
    </li>
  );
};

const QuizzPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { t, i18n } = useTranslation();

  const [view, setView] = useState<'list' | 'active_quiz' | 'view_attempt'>('list');
  const [attempts, setAttempts] = useState<AttemptDetail[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (view !== 'list' || !lessonId) return;
    setIsLoading(true);
    api.get(`/lessons/${lessonId}`)
      .then((response) => setAttempts(response.data.quizzAttempts || []))
      .catch(() => toast.error(t('quizzPage.loadError')))
      .finally(() => setIsLoading(false));
  }, [lessonId, view, t]);

  if (view === 'active_quiz' && lessonId) {
    return (
      <div className="space-y-2">
        <div className="chat-container">
          <Button variant="ghost" size="sm" onClick={() => setView('list')}>{t('quizzPage.backToAttempts')}</Button>
        </div>
        <ActiveQuiz lessonId={lessonId} onFinish={() => setView('list')} />
      </div>
    );
  }

  if (view === 'view_attempt' && selectedAttempt) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">{t('quizzPage.reviewingAttempt', { number: selectedAttempt.attemptNumber, score: selectedAttempt.score })}</h1>
          <Button variant="outline" onClick={() => setView('list')}>{t('quizzPage.backToAttempts')}</Button>
        </div>
        <ol className="space-y-4">
          {selectedAttempt.questions.map((q, i) => (
            <ReviewItem key={q.id ?? i} index={i} question={q} answer={selectedAttempt.answers[i]} result={selectedAttempt.results[i]} />
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <BackLink to={`/subjects/${lessonId}`}>{t('chat.backToSubject')}</BackLink>
        <PageHeader
          className="mt-3"
          title={t('quizzPage.heading')}
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

      {attempts.length > 0 && (
        <section aria-labelledby="lesson-weakness" className="space-y-4">
          <h2 id="lesson-weakness" className="text-2xl font-extrabold tracking-tight">{t('weakness.title')}</h2>
          <WeaknessPanel lessonId={lessonId} />
        </section>
      )}
    </div>
  );
};

export default QuizzPage;
