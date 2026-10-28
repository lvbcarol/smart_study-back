// src/pages/SubjectPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Badge, Skeleton } from '../components/ds/Misc';
import { BackLink, FeatureTile } from '../components/ds/PageParts';

interface SubjectDetails {
  notebookTitle: string;
  lessonTitle: string;
  readOnly?: boolean;
}

const SubjectPage: React.FC = () => {
  const { t } = useTranslation();
  const { lessonId } = useParams<{ lessonId: string }>();
  const [details, setDetails] = useState<SubjectDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!lessonId) return;
    api.get(`/lessons/${lessonId}`)
      .then((response) => setDetails(response.data))
      .catch((error) => console.error('Error fetching lesson details:', error))
      .finally(() => setIsLoading(false));
  }, [lessonId]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <BackLink to="/my-notebooks">{t('subject.goBack')}</BackLink>

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label={t('common.loading')}>
          <Skeleton className="h-5 w-48" /><Skeleton className="h-10 w-3/4" />
        </div>
      ) : (
        <header className="space-y-2">
          {details && (
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
              {details.notebookTitle} <span aria-hidden="true">/</span> {details.lessonTitle}
              {details.readOnly && <Badge variant="primary">{t('myNotebooks.fromTeacher')}</Badge>}
            </p>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t('subject.title')}</h1>
        </header>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FeatureTile to={`/summary/${lessonId}`} icon={<BookOpen className="h-5 w-5" />} title={t('subject.summaryTitle')} description={t('subject.summaryDesc')} />
        <FeatureTile to={`/quizz/${lessonId}`} icon={<ListChecks className="h-5 w-5" />} title={t('subject.quizzTitle')} description={t('subject.quizzDesc')} />
      </div>
    </div>
  );
};

export default SubjectPage;
