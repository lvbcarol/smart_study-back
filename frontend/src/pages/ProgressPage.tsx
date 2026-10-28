// src/pages/ProgressPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../services/api';
import { Notebook } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ds/Misc';
import { PageHeader } from '../components/ds/PageParts';

interface BarDatum { name: string; value: number }

const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };
const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  color: 'hsl(var(--foreground))',
};

const ScoreChart: React.FC<{ data: BarDatum[]; label: string; summary: string; color: string }> = ({ data, label, summary, color }) => (
  <div className="h-72" role="img" aria-label={`${summary}: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={axisTick} />
        <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name={label} fill={color} radius={[8, 8, 0, 0]} isAnimationActive={!window.matchMedia('(prefers-reduced-motion: reduce)').matches} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

const mean = (scores: number[]) => (scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0);

const ProgressPage: React.FC = () => {
  const { t } = useTranslation();
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [notebookForLessons, setNotebookForLessons] = useState('');
  const [notebookForAttempts, setNotebookForAttempts] = useState('');
  const [lessonForAttempts, setLessonForAttempts] = useState('');

  useEffect(() => {
    api.get<Notebook[]>('/notebooks').then((r) => setNotebooks(r.data)).catch(() => setNotebooks([]));
  }, []);

  const overview = useMemo<BarDatum[]>(
    () =>
      (notebooks ?? []).map((nb) => ({
        name: nb.title,
        value: mean(nb.lessons.flatMap((l) => (l.quizzAttempts ?? []).map((a) => a.score))),
      })),
    [notebooks]
  );

  const lessonsData = useMemo<BarDatum[]>(() => {
    const nb = notebooks?.find((n) => n._id === notebookForLessons);
    return (nb?.lessons ?? []).map((l) => ({ name: l.title, value: mean((l.quizzAttempts ?? []).map((a) => a.score)) }));
  }, [notebooks, notebookForLessons]);

  const attemptsData = useMemo<BarDatum[]>(() => {
    const lesson = notebooks?.find((n) => n._id === notebookForAttempts)?.lessons.find((l) => l._id === lessonForAttempts);
    return (lesson?.quizzAttempts ?? []).map((a, i) => ({ name: t('progress.attemptN', { n: i + 1 }), value: a.score }));
  }, [notebooks, notebookForAttempts, lessonForAttempts, t]);

  const hasAnyAttempt = (notebooks ?? []).some((n) => n.lessons.some((l) => (l.quizzAttempts ?? []).length > 0));

  if (notebooks === null) {
    return (
      <div role="status" aria-label={t('progress.loading')} className="space-y-4">
        <Skeleton className="h-10 w-64" /><Skeleton className="h-80" />
      </div>
    );
  }

  if (!hasAnyAttempt) {
    return (
      <>
        <PageHeader title={t('progress.title')} subtitle={t('progress.subtitle')} />
        <EmptyState icon={<BarChart3 className="h-6 w-6" />} title={t('progress.noDataTitle')} description={t('progress.noDataSubtitle')} />
      </>
    );
  }

  const notebookSelect = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={placeholder}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{notebooks.map((nb) => <SelectItem key={nb._id} value={nb._id}>{nb.title}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <>
      <PageHeader title={t('progress.title')} subtitle={t('progress.subtitle')} />

      <Tabs defaultValue="overview">
        <TabsList aria-label={t('progress.tabsLabel')}>
          <TabsTrigger value="overview">{t('progress.tabOverview')}</TabsTrigger>
          <TabsTrigger value="lessons">{t('progress.tabLessons')}</TabsTrigger>
          <TabsTrigger value="attempts">{t('progress.tabAttempts')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="shadow-soft">
            <CardHeader><CardTitle>{t('progress.card1.title')}</CardTitle><CardDescription>{t('progress.card1.legendText')}</CardDescription></CardHeader>
            <CardContent><ScoreChart data={overview} label={t('progress.average')} summary={t('progress.chartSummary')} color="hsl(var(--chart-1))" /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lessons">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>{t('progress.card2.title')}</CardTitle>
              <CardDescription>{t('progress.card2.legendText')}</CardDescription>
              <div className="pt-3 sm:max-w-xs">{notebookSelect(notebookForLessons, setNotebookForLessons, t('progress.card2.selectPlaceholder'))}</div>
            </CardHeader>
            <CardContent>
              {lessonsData.length > 0
                ? <ScoreChart data={lessonsData} label={t('progress.average')} summary={t('progress.chartSummary')} color="hsl(var(--chart-2))" />
                : <EmptyState title={t('progress.card2.noData')} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attempts">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>{t('progress.card3.title')}</CardTitle>
              <CardDescription>{t('progress.card3.legendText')}</CardDescription>
              <div className="grid gap-3 pt-3 sm:max-w-xl sm:grid-cols-2">
                {notebookSelect(notebookForAttempts, (v) => { setNotebookForAttempts(v); setLessonForAttempts(''); }, t('progress.card3.selectNotebookPlaceholder'))}
                <Select value={lessonForAttempts} onValueChange={setLessonForAttempts} disabled={!notebookForAttempts}>
                  <SelectTrigger aria-label={t('progress.card3.selectLessonPlaceholder')}><SelectValue placeholder={t('progress.card3.selectLessonPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {notebooks.find((n) => n._id === notebookForAttempts)?.lessons.map((l) => <SelectItem key={l._id} value={l._id}>{l.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {attemptsData.length > 0
                ? <ScoreChart data={attemptsData} label={t('progress.score')} summary={t('progress.chartSummary')} color="hsl(var(--chart-3))" />
                : <EmptyState title={t(notebookForAttempts && lessonForAttempts ? 'progress.card3.noAttempts' : 'progress.card3.pleaseSelect')} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
};

export default ProgressPage;
