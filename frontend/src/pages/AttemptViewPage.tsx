// src/pages/AttemptViewPage.tsx — o professor lê as respostas completas de uma tentativa
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { TeacherAttemptView } from '../types/tasks';
import { formatDateTime, scoreVariant } from '../lib/format';
import { AttemptReview } from '../components/quiz/AttemptReview';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { BackLink } from '../components/ds/PageParts';

const AttemptViewPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<TeacherAttemptView | null | undefined>(undefined);

  useEffect(() => {
    api.get<TeacherAttemptView>(`/results/attempts/${attemptId}`).then((r) => setAttempt(r.data)).catch(() => setAttempt(null));
  }, [attemptId]);

  if (attempt === undefined) return <div role="status" aria-label={t('common.loading')} className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  if (attempt === null) {
    return (
      <div className="space-y-6">
        <BackLink to="/classes">{t('classes.back')}</BackLink>
        <EmptyState title={t('notFound.title')} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <BackLink to={`/classes/${attempt.turmaId}/students/${attempt.student._id}`}>{t('results.backToStudent')}</BackLink>
        <h1 className="text-3xl font-extrabold tracking-tight">{t('results.attemptTitle', { name: attempt.student.name })}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={scoreVariant(attempt.score)} className="px-3 py-1 text-base">{attempt.score}%</Badge>
          <Badge variant="primary">{attempt.source === 'task' ? t('results.task', { title: attempt.taskTitle }) : t('results.practice')}</Badge>
          {attempt.late && <Badge variant="warning">{t('tasks.late')}</Badge>}
          <span className="text-muted-foreground">{[attempt.notebookTitle, attempt.lessonTitle].filter(Boolean).join(' · ')} · {formatDateTime(attempt.date, i18n.language)}</span>
        </div>
      </div>
      <AttemptReview questions={attempt.questions} answers={attempt.answers} results={attempt.results} />
    </div>
  );
};

export default AttemptViewPage;
