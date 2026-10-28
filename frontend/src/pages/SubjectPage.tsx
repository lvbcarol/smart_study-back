// src/pages/SubjectPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, ClipboardCheck, FileText, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Badge, Skeleton } from '../components/ds/Misc';
import { BackLink, FeatureTile } from '../components/ds/PageParts';

interface SubjectDetails {
  notebookId: string;
  inTurma: boolean;
  notebookTitle: string;
  lessonTitle: string;
  readOnly?: boolean;
  materialsCount?: number;
}

const SubjectPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
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

      {!!details?.materialsCount && (
        <p className="flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" /> {t('chat.materialsBanner', { count: details.materialsCount })}
        </p>
      )}

      {isTeacher ? (
        // professor não estuda com IA: cria tarefas para a turma e cuida dos materiais
        details && (
          <div className="grid gap-4 sm:grid-cols-2">
            {details.inTurma && (
              <FeatureTile
                to={`/tasks/new?notebook=${details.notebookId}&lesson=${lessonId}`} icon={<ClipboardCheck className="h-5 w-5" />}
                title={t('subject.teacherTaskTitle')} description={t('subject.teacherTaskDesc')}
              />
            )}
            <FeatureTile
              to={`/notebook/${details.notebookId}?tab=materials`} icon={<FileText className="h-5 w-5" />}
              title={t('subject.teacherMaterialsTitle')} description={t('subject.teacherMaterialsDesc')}
            />
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureTile to={`/summary/${lessonId}`} icon={<BookOpen className="h-5 w-5" />} title={t('subject.summaryTitle')} description={t('subject.summaryDesc')} />
          <FeatureTile to={`/quizz/${lessonId}`} icon={<ListChecks className="h-5 w-5" />} title={t('subject.quizzTitle')} description={t('subject.quizzDesc')} />
        </div>
      )}
    </div>
  );
};

export default SubjectPage;
