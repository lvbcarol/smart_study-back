// src/pages/ProgressPage.tsx — "Desempenho": dashboard interativo do aluno
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../services/api';
import { Notebook } from '../types';
import { StudentDashboard } from '../types/dashboard';
import { QUESTION_TYPES } from '../types/quiz';
import { SelectField } from '../components/ds/SelectField';
import { Badge, Skeleton } from '../components/ds/Misc';
import { PageHeader, StatCard } from '../components/ds/PageParts';
import { axisTick, chartColor, ChartCard, DataTable, reducedMotion, tooltipStyle } from '../components/dash/ChartCard';
import StudyTimerCard from '../components/dash/StudyTimerCard';
import StudyWeekCard from '../components/dash/StudyWeekCard';
import KolbCard from '../components/dash/KolbCard';
import { cn } from '@/lib/utils';

const RANGES = [7, 30, 90] as const;

const ProgressPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<number>(30);
  const [notebookId, setNotebookId] = useState('');
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [error, setError] = useState(false);
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<StudentDashboard>('/dashboard/student', { params: { range, tzOffset: new Date().getTimezoneOffset(), ...(notebookId ? { notebook: notebookId } : {}) } })
      .then((r) => { setData(r.data); setError(false); })
      .catch(() => setError(true));
  }, [range, notebookId]);

  useEffect(() => { api.get<Notebook[]>('/notebooks').then((r) => setNotebooks(r.data)).catch(() => undefined); }, []);
  useEffect(() => { setData(null); load(); }, [load]);

  const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' });

  if (error) return <p role="alert" className="rounded-2xl border border-destructive p-6 text-destructive">{t('dash.loadError')}</p>;

  const subject = data?.subjects.find((s) => s.notebookId === subjectId);
  const typeLabel = (type: string) => t(`quizzPage.types.${type}`);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t('dash.title')} subtitle={t('dash.subtitle')} className="mb-2" />

      {/* filtros: período e matéria, numa linha acima dos gráficos */}
      <div className="flex flex-wrap items-end gap-4">
        <div role="radiogroup" aria-label={t('dash.range')} className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r} type="button" role="radio" aria-checked={range === r} onClick={() => setRange(r)}
              className={cn(
                'min-h-11 rounded-full border-2 px-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                range === r ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:border-primary'
              )}
            >
              {t('dash.lastDays', { count: r })}
            </button>
          ))}
        </div>
        <div className="w-64">
          <SelectField label={t('dash.subject')} value={notebookId} onChange={(e) => { setNotebookId(e.target.value); setSubjectId(null); }}>
            <option value="">{t('dash.allSubjects')}</option>
            {notebooks.map((n) => <option key={n._id} value={n._id}>{n.title}</option>)}
          </SelectField>
        </div>
      </div>

      {!data ? (
        <div role="status" aria-label={t('common.loading')} className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      ) : (
        <>
          <section aria-label={t('dash.kpis')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label={t('dash.kpiAverage')} value={data.kpis.average === null ? '–' : `${data.kpis.average}%`} />
            <StatCard label={t('dash.kpiAttempts')} value={data.kpis.attempts} />
            <StatCard label={t('dash.kpiStreak')} value={t('dash.days', { count: data.kpis.streakDays })} />
            <StatCard label={t('dash.kpiTasks')} value={`${data.kpis.tasksSubmitted}/${data.kpis.tasksSubmitted + data.kpis.tasksPending}`} />
            <StatCard label={t('dash.kpiCards')} value={`${data.kpis.flashcardsLearned} · ${data.kpis.flashcardsDue}`} />
          </section>
          <p className="-mt-3 text-xs text-muted-foreground">{t('dash.kpiCardsHint')}</p>

          <StudyTimerCard onSaved={load} />
          <StudyWeekCard week={data.study} onGoalSaved={load} />

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title={t('dash.timelineTitle')} description={t('dash.timelineDesc')}
              empty={data.timeline.length === 0 ? t('dash.noQuizzes') : undefined}
              table={<DataTable caption={t('dash.timelineTitle')} head={[t('dash.day'), t('dash.kpiAverage'), t('dash.kpiAttempts')]} rows={data.timeline.map((d) => [dateLabel(d.date), `${d.average}%`, d.attempts])} />}
            >
              <div className="h-64" role="img" aria-label={`${t('dash.timelineTitle')}: ${data.timeline.map((d) => `${dateLabel(d.date)} ${d.average}%`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeline.map((d) => ({ ...d, name: dateLabel(d.date) }))} margin={{ left: -16, right: 12, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={axisTick} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, t('dash.kpiAverage')]} />
                    <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--card))' }} activeDot={{ r: 6 }} isAnimationActive={!reducedMotion()} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title={t('dash.subjectsTitle')} description={t('dash.subjectsDesc')}
              empty={data.subjects.length === 0 ? t('dash.noQuizzes') : undefined}
              table={<DataTable caption={t('dash.subjectsTitle')} head={[t('dash.subject'), t('dash.kpiAverage'), t('dash.kpiAttempts')]} rows={data.subjects.map((s) => [s.title, `${s.average}%`, s.attempts])} />}
            >
              <div className="h-64" role="img" aria-label={`${t('dash.subjectsTitle')}: ${data.subjects.map((s) => `${s.title} ${s.average}%`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.subjects.map((s) => ({ ...s, name: s.title }))} margin={{ left: -16, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={axisTick} />
                    <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, t('dash.kpiAverage')]} />
                    <Bar dataKey="average" radius={[8, 8, 0, 0]} maxBarSize={56} cursor="pointer" isAnimationActive={!reducedMotion()} onClick={(item) => { const id = (item as unknown as { notebookId?: string }).notebookId; if (id) setSubjectId(id); }}>
                      {data.subjects.map((s) => <Cell key={s.notebookId} fill="hsl(var(--primary))" opacity={subjectId && subjectId !== s.notebookId ? 0.4 : 1} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* o gráfico é clicável, mas o detalhe também abre por botão (teclado e leitor de tela) */}
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('dash.openSubject')}>
                {data.subjects.map((s) => (
                  <button
                    key={s.notebookId} type="button" aria-pressed={subjectId === s.notebookId} onClick={() => setSubjectId(subjectId === s.notebookId ? null : s.notebookId)}
                    className={cn('min-h-9 rounded-full border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', subjectId === s.notebookId ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:border-primary')}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
              {subject && (
                <div className="mt-4 border-t border-border pt-4">
                <h3 className="mb-2 font-semibold">{t('dash.lessonsOf', { title: subject.title })}</h3>
                <ul className="space-y-2">
                  {subject.lessons.map((l) => (
                    <li key={l.lessonId} className="flex items-center justify-between gap-3 text-sm">
                      <Link to={`/quizz/${l.lessonId}`} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{l.title}</Link>
                      <span className="flex items-center gap-2 text-muted-foreground">{t('dash.attemptsCount', { count: l.attempts })} <Badge variant={l.average >= 70 ? 'success' : l.average >= 50 ? 'warning' : 'destructive'}>{l.average}%</Badge></span>
                    </li>
                  ))}
                </ul>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title={t('dash.typesTitle')} description={t('dash.typesDesc')}
              empty={data.byType.every((x) => x.accuracy === null) ? t('dash.noQuizzes') : undefined}
              table={<DataTable caption={t('dash.typesTitle')} head={[t('dash.type'), t('dash.accuracy'), t('dash.answered')]} rows={data.byType.map((x) => [typeLabel(x.type), x.accuracy === null ? '–' : `${x.accuracy}%`, x.answered])} />}
            >
              <div className="h-64" role="img" aria-label={`${t('dash.typesTitle')}: ${data.byType.filter((x) => x.accuracy !== null).map((x) => `${typeLabel(x.type)} ${x.accuracy}%`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={data.byType.map((x) => ({ ...x, name: typeLabel(x.type), value: x.accuracy }))} margin={{ left: 24, right: 16, top: 4 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={axisTick} />
                    <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={axisTick} />
                    <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, t('dash.accuracy')]} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={22} isAnimationActive={!reducedMotion()}>
                      {QUESTION_TYPES.map((type, i) => <Cell key={type} fill={chartColor(i)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <section aria-labelledby="weak-title" className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 id="weak-title" className="font-display text-xl font-bold">{t('dash.weakTitle')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('dash.weakDesc')}</p>
              {data.weakTopics.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t('dash.weakEmpty')}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.weakTopics.map((w) => (
                    <li key={`${w.lessonId}:${w.topic}`} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{w.topic}</span>
                        <span className="block truncate text-sm text-muted-foreground">{w.notebook} · {w.lesson}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge variant="destructive">{t('weakness.errorRate', { rate: Math.round(w.errorRate) })}</Badge>
                        <Link to={`/quizz/${w.lessonId}`} aria-label={t('dash.reinforce', { topic: w.topic })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {t('weakness.review')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <KolbCard kolb={data.kolb} onChanged={load} />

            <ChartCard
              title={t('bloom.title')} description={t('bloom.desc')}
              empty={data.byBloom.every((b) => b.accuracy === null) ? t('dash.noQuizzes') : undefined}
              table={<DataTable caption={t('bloom.title')} head={[t('bloom.level'), t('dash.accuracy'), t('dash.answered')]} rows={data.byBloom.map((b) => [t(`bloom.levels.${b.level}`), b.accuracy === null ? '–' : `${b.accuracy}%`, b.answered])} />}
            >
              <div className="h-64" role="img" aria-label={`${t('bloom.title')}: ${data.byBloom.filter((b) => b.accuracy !== null).map((b) => `${t(`bloom.levels.${b.level}`)} ${b.accuracy}%`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byBloom.map((b) => ({ ...b, name: t(`bloom.levels.${b.level}`), value: b.accuracy }))} margin={{ left: -16, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} interval={0} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={axisTick} />
                    <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, t('dash.accuracy')]} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={40} isAnimationActive={!reducedMotion()}>
                      {data.byBloom.map((b, i) => <Cell key={b.level} fill={chartColor(i)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          {data.byCompetency.length > 0 && (
            <section aria-labelledby="comp-title" className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 id="comp-title" className="font-display text-xl font-bold">{t('competencies.studentTitle')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('competencies.studentDesc')}</p>
              <ul className="mt-4 space-y-3">
                {data.byCompetency.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3">
                    <span className="font-medium">{c.name}</span>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">{t('dash.attemptsCount', { count: c.answered })} <Badge variant={c.accuracy >= 70 ? 'success' : c.accuracy >= 50 ? 'warning' : 'destructive'}>{c.accuracy}%</Badge></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ProgressPage;
