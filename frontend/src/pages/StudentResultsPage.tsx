// src/pages/StudentResultsPage.tsx — desempenho de um aluno (visão do professor)
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { StudentResults } from '../types/tasks';
import { formatDateTime, scoreVariant } from '../lib/format';
import { WeaknessView } from '../components/quiz/WeaknessPanel';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { BackLink, StatCard } from '../components/ds/PageParts';

const StudentResultsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { turmaId, studentId } = useParams<{ turmaId: string; studentId: string }>();
  const [data, setData] = useState<StudentResults | null | undefined>(undefined);

  useEffect(() => {
    api.get<StudentResults>(`/results/turmas/${turmaId}/students/${studentId}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null));
  }, [turmaId, studentId]);

  if (data === undefined) return <div role="status" aria-label={t('common.loading')} className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  if (data === null) {
    return (
      <div className="space-y-6">
        <BackLink to={`/classes/${turmaId}`}>{t('results.backToClass')}</BackLink>
        <EmptyState title={t('notFound.title')} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <BackLink to={`/classes/${turmaId}`}>{t('results.backToClass')}</BackLink>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t('results.studentTitle', { name: data.student.name })}</h1>
        <p className="text-muted-foreground">{data.student.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t('results.average')} value={data.average === null ? '–' : `${data.average}%`} />
        <StatCard label={t('results.attempts')} value={data.attemptsCount} />
      </div>

      {data.attemptsCount === 0 ? (
        <EmptyState title={t('results.noHistory')} />
      ) : (
        <>
          <section aria-labelledby="lessons-avg" className="space-y-3">
            <h2 id="lessons-avg" className="text-2xl font-extrabold tracking-tight">{t('results.lessonsAverage')}</h2>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
              {data.lessons.map((l) => (
                <li key={l.lessonId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span><span className="block font-semibold">{l.lesson}</span><span className="text-sm text-muted-foreground">{l.notebook} · {t('results.attempts')}: {l.attempts}</span></span>
                  <Badge variant={scoreVariant(l.average)} className="text-sm">{l.average}%</Badge>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="weak-title" className="space-y-3">
            <h2 id="weak-title" className="text-2xl font-extrabold tracking-tight">{t('results.weak')}</h2>
            <WeaknessView data={data.weakness} />
          </section>

          <section aria-labelledby="history-title" className="space-y-3">
            <h2 id="history-title" className="text-2xl font-extrabold tracking-tight">{t('results.history')}</h2>
            <ul className="space-y-2">
              {data.attempts.slice().reverse().map((a) => (
                <li key={a._id}>
                  <Link to={`/results/attempts/${a._id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted">
                    <span>
                      <span className="block font-semibold">{a.source === 'task' ? t('results.task', { title: a.taskTitle }) : t('results.practice')}</span>
                      <span className="text-sm text-muted-foreground">{a.notebook} · {a.lesson} · {formatDateTime(a.date, i18n.language)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {a.late && <Badge variant="warning">{t('tasks.late')}</Badge>}
                      <Badge variant={scoreVariant(a.score)} className="text-sm">{a.score}%</Badge>
                      <span className="text-sm font-semibold text-primary">{t('results.viewAnswers')}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
};

export default StudentResultsPage;
