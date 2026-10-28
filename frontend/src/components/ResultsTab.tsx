// src/components/ResultsTab.tsx — painel de desempenho da turma (alunos × aulas)
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { ClassResults } from '../types/tasks';
import { formatDateTime, scoreVariant } from '../lib/format';
import { Badge, EmptyState, Skeleton } from './ds/Misc';
import { StatCard } from './ds/PageParts';

const ScoreCell: React.FC<{ value: number | null | undefined }> = ({ value }) =>
  value === null || value === undefined ? <span className="text-muted-foreground">–</span> : <Badge variant={scoreVariant(value)}>{value}%</Badge>;

const ResultsTab: React.FC<{ turmaId: string }> = ({ turmaId }) => {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<ClassResults | null>(null);

  useEffect(() => {
    api.get<ClassResults>(`/results/turmas/${turmaId}`)
      .then((r) => setData(r.data))
      .catch(() => { toast.error(t('results.loadError')); setData(null); });
  }, [turmaId, t]);

  const cell = useMemo(() => {
    const map = new Map<string, number>();
    data?.cells.forEach((c) => map.set(`${c.student}:${c.lesson}`, c.average));
    return map;
  }, [data]);

  if (!data) return <Skeleton className="h-64" />;

  const totalAttempts = data.students.reduce((sum, s) => sum + s.attempts, 0);
  const weighted = data.students.reduce((sum, s) => sum + (s.average ?? 0) * s.attempts, 0);
  const classAverage = totalAttempts ? Math.round(weighted / totalAttempts) : null;
  const participating = data.students.filter((s) => s.attempts > 0).length;
  const lessons = data.notebooks.flatMap((n) => n.lessons.map((l) => ({ ...l, notebook: n.title })));

  if (data.students.length === 0 || lessons.length === 0) {
    return <EmptyState icon={<BarChart3 className="h-6 w-6" />} title={t('results.empty')} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold">{t('results.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('results.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('results.classAverage')} value={classAverage === null ? '–' : `${classAverage}%`} />
        <StatCard label={t('results.attempts')} value={totalAttempts} />
        <StatCard label={t('results.studentsTable')} value={t('results.participation', { count: participating, total: data.students.length })} />
      </div>

      <section aria-labelledby="heatmap-title" className="space-y-3">
        <div>
          <h3 id="heatmap-title" className="font-display text-lg font-bold">{t('results.heatmap')}</h3>
          <p className="text-sm text-muted-foreground">{t('results.heatmapDesc')}</p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft" tabIndex={0} role="region" aria-label={t('results.heatmap')}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">{t('results.heatmap')}</caption>
            <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t('tasks.detail.student')}</th>
                {lessons.map((l) => (
                  <th key={l._id} scope="col" className="px-3 py-3 text-center font-semibold">
                    <span className="block text-xs font-normal">{l.notebook}</span>{l.title}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-center font-semibold">{t('results.average')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('results.lastActivity')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.students.map((s) => (
                <tr key={s._id}>
                  <th scope="row" className="px-4 py-3 font-semibold">
                    <Link to={`/classes/${turmaId}/students/${s._id}`} className="text-primary hover:underline">{s.name}</Link>
                  </th>
                  {lessons.map((l) => <td key={l._id} className="px-3 py-3 text-center"><ScoreCell value={cell.get(`${s._id}:${l._id}`)} /></td>)}
                  <td className="px-4 py-3 text-center"><ScoreCell value={s.average} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{s.lastAt ? formatDateTime(s.lastAt, i18n.language) : t('results.never')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-secondary/40">
              <tr>
                <th scope="row" className="px-4 py-3 font-semibold">{t('results.classAverage')}</th>
                {lessons.map((l) => (
                  <td key={l._id} className="px-3 py-3 text-center">
                    <ScoreCell value={l.average} />
                    <span className="mt-1 block text-xs text-muted-foreground">{l.participation}/{data.students.length}</span>
                  </td>
                ))}
                <td className="px-4 py-3 text-center"><ScoreCell value={classAverage} /></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section aria-labelledby="class-tasks" className="space-y-3">
        <h3 id="class-tasks" className="font-display text-lg font-bold">{t('results.tasksTitle')}</h3>
        {data.tasks.length === 0 ? (
          <p className="text-muted-foreground">{t('results.noTasks')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
            {data.tasks.map((task) => (
              <li key={task._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <Link to={`/tasks/${task._id}`} className="font-semibold text-primary hover:underline">{task.title}</Link>
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {!task.published && <Badge>{t('tasks.draft')}</Badge>}
                  <span>{t('results.delivered', { submitted: task.submitted, total: task.total })}</span>
                  {task.late > 0 && <Badge variant="warning">{t('results.lateCount', { count: task.late })}</Badge>}
                  <ScoreCell value={task.average} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ResultsTab;
