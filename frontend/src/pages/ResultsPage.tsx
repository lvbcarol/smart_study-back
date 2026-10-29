// src/pages/ResultsPage.tsx — "Resultados": dashboard do professor com a visão geral de cada turma
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../services/api';
import { ClassOutcomes, ClassOverviewRow, ClassRisk, ClassTimeline, ClassWeakness, LearningStyles } from '../types/dashboard';
import { QUESTION_TYPES } from '../types/quiz';
import { buttonVariants } from '../components/ds/Button';
import { SelectField } from '../components/ds/SelectField';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { PageHeader, StatCard } from '../components/ds/PageParts';
import { axisTick, chartColor, ChartCard, DataTable, reducedMotion, tooltipStyle } from '../components/dash/ChartCard';
import ResultsTab from '../components/ResultsTab';
import { cn } from '@/lib/utils';

const RANGES = [7, 30, 90] as const;

const ResultsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [turmas, setTurmas] = useState<ClassOverviewRow[] | null>(null);
  const [turmaId, setTurmaId] = useState('');
  const [range, setRange] = useState<number>(30);
  const [timeline, setTimeline] = useState<ClassTimeline | null>(null);
  const [weakness, setWeakness] = useState<ClassWeakness | null>(null);
  const [risk, setRisk] = useState<ClassRisk | null>(null);
  const [styles, setStyles] = useState<LearningStyles | null>(null);
  const [outcomes, setOutcomes] = useState<ClassOutcomes | null>(null);

  useEffect(() => {
    api.get<{ turmas: ClassOverviewRow[] }>('/results/overview')
      .then((r) => { setTurmas(r.data.turmas); setTurmaId((cur) => cur || r.data.turmas[0]?.turmaId || ''); })
      .catch(() => setTurmas([]));
  }, []);

  useEffect(() => {
    if (!turmaId) return;
    setTimeline(null); setWeakness(null); setRisk(null); setStyles(null); setOutcomes(null);
    api.get<ClassRisk>(`/results/turmas/${turmaId}/risk`).then((r) => setRisk(r.data)).catch(() => setRisk({ studentsTotal: 0, students: [] }));
    api.get<LearningStyles>(`/results/turmas/${turmaId}/learning-styles`).then((r) => setStyles(r.data)).catch(() => setStyles(null));
    api.get<ClassOutcomes>(`/results/turmas/${turmaId}/outcomes`, { params: { range } }).then((r) => setOutcomes(r.data)).catch(() => setOutcomes(null));
    api.get<ClassTimeline>(`/results/turmas/${turmaId}/timeline`, { params: { range, tzOffset: new Date().getTimezoneOffset() } }).then((r) => setTimeline(r.data)).catch(() => setTimeline({ range, days: [] }));
    api.get<ClassWeakness>(`/results/turmas/${turmaId}/weakness`).then((r) => setWeakness(r.data)).catch(() => setWeakness({ studentsTotal: 0, topics: [], byType: [] }));
  }, [turmaId, range]);

  if (turmas === null) return <div role="status" aria-label={t('common.loading')} className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  if (turmas.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={t('dash.teacherTitle')} subtitle={t('dash.teacherSubtitle')} />
        <EmptyState title={t('dash.noClasses')} description={t('dash.noClassesDesc')} action={<Link to="/classes" className={buttonVariants()}>{t('navbar.teacherClasses')}</Link>} />
      </div>
    );
  }

  const turma = turmas.find((x) => x.turmaId === turmaId) ?? turmas[0];
  const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' });
  const typeLabel = (type: string) => t(`quizzPage.types.${type}`);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t('dash.teacherTitle')} subtitle={t('dash.teacherSubtitle')} className="mb-2" />

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-72">
          <SelectField label={t('dash.pickClass')} value={turma.turmaId} onChange={(e) => setTurmaId(e.target.value)}>
            {turmas.map((x) => <option key={x.turmaId} value={x.turmaId}>{x.name}</option>)}
          </SelectField>
        </div>
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
        <Link to={`/classes/${turma.turmaId}`} className={buttonVariants({ variant: 'outline' })}>{t('dash.openClass')}</Link>
      </div>

      <section aria-label={t('dash.kpis')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dash.kpiStudents')} value={turma.students} />
        <StatCard label={t('dash.kpiClassAverage')} value={turma.average === null ? '–' : `${turma.average}%`} />
        <StatCard label={t('dash.kpiActive')} value={`${turma.activeStudents}/${turma.students}`} />
        <StatCard label={t('dash.kpiDelivery')} value={turma.deliveryRate === null ? '–' : `${turma.deliveryRate}%`} />
        {turma.sharedStudyMinutes !== null && <StatCard label={t('risk.sharedMinutes')} value={`${turma.sharedStudyMinutes} min`} />}
      </section>

      {/* alerta de atenção: sinais simples e explicáveis */}
      <section aria-labelledby="risk-title" className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 id="risk-title" className="font-display text-xl font-bold">{t('risk.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('risk.desc')}</p>
        {risk === null ? <Skeleton className="mt-4 h-20" /> : risk.students.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t('risk.empty')}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {risk.students.map((s) => (
              <li key={s.studentId} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/classes/${turma.turmaId}/students/${s.studentId}`} className="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{s.name}</Link>
                  <Badge variant={s.level === 'high' ? 'destructive' : 'warning'}>{t(`risk.${s.level}`)}</Badge>
                </div>
                <ul className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {s.flags.map((f) => (
                    <li key={f} className="rounded-full bg-secondary px-3 py-1">
                      {f === 'inactive' && t('risk.flags.inactive', { days: s.daysInactive })}
                      {f === 'falling' && s.trend && t('risk.flags.falling', { previous: s.trend.previous, recent: s.trend.recent })}
                      {f === 'overdue' && t('risk.flags.overdue', { count: s.overdueTasks })}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {weakness && weakness.topics[0] && risk && risk.students.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">{t('risk.reinforceHint', { topic: weakness.topics[0].topic })}</p>
            <Link
              to={`/tasks/new?notebook=${weakness.topics[0].notebookId}&lesson=${weakness.topics[0].lessonId}&topic=${encodeURIComponent(weakness.topics[0].topic)}`}
              className={buttonVariants({ variant: 'outline' })}
            >
              {t('risk.reinforce')}
            </Link>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {timeline === null ? <Skeleton className="h-72" /> : (
          <ChartCard
            title={t('dash.classTimelineTitle')} description={t('dash.classTimelineDesc')}
            empty={timeline.days.length === 0 ? t('dash.noClassQuizzes') : undefined}
            table={<DataTable caption={t('dash.classTimelineTitle')} head={[t('dash.day'), t('dash.kpiClassAverage'), t('dash.kpiAttempts'), t('dash.kpiStudents')]} rows={timeline.days.map((d) => [dateLabel(d.date), `${d.average}%`, d.attempts, d.students])} />}
          >
            <div className="h-64" role="img" aria-label={`${t('dash.classTimelineTitle')}: ${timeline.days.map((d) => `${dateLabel(d.date)} ${d.average}%`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline.days.map((d) => ({ ...d, name: dateLabel(d.date) }))} margin={{ left: -16, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, t('dash.kpiClassAverage')]} />
                  <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--card))' }} activeDot={{ r: 6 }} isAnimationActive={!reducedMotion()} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}

        {weakness === null ? <Skeleton className="h-72" /> : (
          <ChartCard
            title={t('dash.classTypesTitle')} description={t('dash.classTypesDesc')}
            empty={weakness.byType.every((x) => x.accuracy === null) ? t('dash.noClassQuizzes') : undefined}
            table={<DataTable caption={t('dash.classTypesTitle')} head={[t('dash.type'), t('dash.accuracy'), t('dash.answered')]} rows={weakness.byType.map((x) => [typeLabel(x.type), x.accuracy === null ? '–' : `${x.accuracy}%`, x.answers])} />}
          >
            <div className="h-64" role="img" aria-label={`${t('dash.classTypesTitle')}: ${weakness.byType.filter((x) => x.accuracy !== null).map((x) => `${typeLabel(x.type)} ${x.accuracy}%`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={weakness.byType.map((x) => ({ ...x, name: typeLabel(x.type), value: x.accuracy }))} margin={{ left: 24, right: 16, top: 4 }}>
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
        )}
      </div>

      <section aria-labelledby="class-weak" className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 id="class-weak" className="font-display text-xl font-bold">{t('dash.classWeakTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('dash.classWeakDesc')}</p>
        {weakness === null ? <Skeleton className="mt-4 h-24" /> : weakness.topics.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t('dash.noClassQuizzes')}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {weakness.topics.map((w) => (
              <li key={`${w.lesson}:${w.topic}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{w.topic}</span>
                  <span className="block truncate text-sm text-muted-foreground">{w.lesson}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge>{t('dash.studentsStruggling', { count: w.students, total: weakness.studentsTotal })}</Badge>
                  <Badge variant="destructive">{t('weakness.errorRate', { rate: w.errorRate })}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {styles && (
          <ChartCard
            title={t('risk.stylesTitle')} description={t('risk.stylesDesc')}
            empty={Object.entries(styles.styles).filter(([k]) => k !== 'insufficient').every(([, n]) => n === 0) ? t('risk.stylesEmpty') : undefined}
            table={<DataTable caption={t('risk.stylesTitle')} head={[t('risk.style'), t('dash.kpiStudents')]} rows={(['diverging', 'assimilating', 'converging', 'accommodating', 'insufficient'] as const).map((k) => [k === 'insufficient' ? t('risk.insufficient') : t(`kolb.styles.${k}`), styles.styles[k]])} />}
          >
            <div className="h-64" role="img" aria-label={`${t('risk.stylesTitle')}: ${(['diverging', 'assimilating', 'converging', 'accommodating'] as const).map((k) => `${t(`kolb.styles.${k}`)} ${styles.styles[k]}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={(['diverging', 'assimilating', 'converging', 'accommodating'] as const).map((k) => ({ name: t(`kolb.styles.${k}`), value: styles.styles[k] }))} margin={{ left: 24, right: 16, top: 4 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={axisTick} />
                  <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={tooltipStyle} formatter={(v: number) => [v, t('dash.kpiStudents')]} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={22} isAnimationActive={!reducedMotion()}>
                    {[0, 1, 2, 3].map((i) => <Cell key={i} fill={chartColor(i)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {(styles.styles.insufficient > 0 || styles.hidden > 0) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {styles.styles.insufficient > 0 && `${t('risk.insufficientCount', { count: styles.styles.insufficient })} `}
                {styles.hidden > 0 && t('risk.hiddenCount', { count: styles.hidden })}
              </p>
            )}
          </ChartCard>
        )}

        {outcomes && (
          <ChartCard
            title={t('risk.outcomesTitle')} description={t('risk.outcomesDesc')}
            empty={outcomes.byBloom.every((b) => b.accuracy === null) ? t('dash.noClassQuizzes') : undefined}
            table={<DataTable caption={t('risk.outcomesTitle')} head={[t('bloom.level'), t('dash.accuracy'), t('dash.answered')]} rows={outcomes.byBloom.map((b) => [t(`bloom.levels.${b.level}`), b.accuracy === null ? '–' : `${b.accuracy}%`, b.answers])} />}
          >
            <div className="h-56" role="img" aria-label={`${t('risk.outcomesTitle')}: ${outcomes.byBloom.filter((b) => b.accuracy !== null).map((b) => `${t(`bloom.levels.${b.level}`)} ${b.accuracy}%`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outcomes.byBloom.map((b) => ({ name: t(`bloom.levels.${b.level}`), value: b.accuracy }))} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} interval={0} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={axisTick} />
                  <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, t('dash.accuracy')]} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={40} isAnimationActive={!reducedMotion()}>
                    {outcomes.byBloom.map((b, i) => <Cell key={b.level} fill={chartColor(i)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {outcomes.byCompetency.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-border pt-4" aria-label={t('competencies.studentTitle')}>
                {outcomes.byCompetency.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant={c.accuracy >= 70 ? 'success' : c.accuracy >= 50 ? 'warning' : 'destructive'}>{c.accuracy}%</Badge>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        )}
      </div>

      <section aria-labelledby="class-heatmap" className="space-y-3">
        <h2 id="class-heatmap" className="font-display text-xl font-bold">{t('dash.heatmapTitle')}</h2>
        <ResultsTab key={turma.turmaId} turmaId={turma.turmaId} />
      </section>
    </div>
  );
};

export default ResultsPage;
