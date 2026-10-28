// src/components/quiz/AttemptReview.tsx — revisão pergunta a pergunta (usada por aluno e professor)
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnswerValue, PublicQuestion, QuestionResult } from '../../types/quiz';
import { Badge } from '../ds/Misc';

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

interface AttemptReviewProps {
  questions: PublicQuestion[];
  answers: AnswerValue[];
  results: QuestionResult[];
}

export const AttemptReview: React.FC<AttemptReviewProps> = ({ questions, answers, results }) => (
  <ol className="space-y-4">
    {questions.map((q, i) => <ReviewItem key={q.id ?? i} index={i} question={q} answer={answers[i]} result={results[i]} />)}
  </ol>
);
