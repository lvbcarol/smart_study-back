// src/components/dash/StudyWeekCard.tsx — minutos estudados nesta semana, meta semanal e quanto falta
import React, { useState } from 'react';
import { Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import type { StudyWeek } from '../../types/study';
import { Button } from '../ds/Button';
import { Field } from '../ds/Field';
import { axisTick, ChartCard, DataTable, reducedMotion, tooltipStyle } from './ChartCard';

const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);

const StudyWeekCard: React.FC<{ week: StudyWeek; onGoalSaved: () => void }> = ({ week, onGoalSaved }) => {
  const { t, i18n } = useTranslation();
  const { savePreferences } = useAuth();
  const [goal, setGoal] = useState(week.goalMinutes ? String(week.goalMinutes) : '');
  const [saving, setSaving] = useState(false);

  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { weekday: 'short' });
  const data = week.days.map((d) => ({ name: day(d.date), date: d.date, minutes: d.minutes }));
  const pct = week.goalMinutes ? Math.min(100, Math.round((week.totalMinutes / week.goalMinutes) * 100)) : 0;
  const left = Math.max(0, week.goalMinutes - week.totalMinutes);

  const saveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = goal.trim() === '' ? 0 : Number(goal);
    if (!Number.isInteger(value) || value < 0 || value > 6000) return toast.error(t('dash.goalInvalid'));
    setSaving(true);
    try {
      await savePreferences({ weeklyGoalMinutes: value });
      toast.success(t('dash.goalSaved'));
      onGoalSaved();
    } catch {
      toast.error(t('dash.goalError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
    <ChartCard
      title={t('dash.weekTitle')} description={t('dash.weekDesc', { total: fmtMinutes(week.totalMinutes) })}
      empty={week.totalMinutes === 0 ? t('dash.weekEmpty') : undefined}
      table={<DataTable caption={t('dash.weekTitle')} head={[t('dash.day'), t('dash.minutes')]} rows={week.days.map((d) => [day(d.date), d.minutes])} />}
    >
      <div className="h-56" role="img" aria-label={`${t('dash.weekTitle')}: ${data.map((d) => `${d.name} ${d.minutes} min`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
            <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={tooltipStyle} formatter={(v: number) => [`${v} min`, t('dash.minutes')]} />
            <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={!reducedMotion()} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>

    {/* a meta fica fora do gráfico para aparecer mesmo quando ainda não há tempo registrado */}
    <section aria-label={t('dash.goalLabel')} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
        {week.goalMinutes > 0 ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              <span className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" aria-hidden="true" /> {t('dash.goalProgress', { done: fmtMinutes(week.totalMinutes), goal: fmtMinutes(week.goalMinutes) })}</span>
              <span aria-live="polite">{left > 0 ? t('dash.goalLeft', { left: fmtMinutes(left) }) : t('dash.goalDone')}</span>
            </div>
            <div role="progressbar" aria-label={t('dash.goalLabel')} aria-valuemin={0} aria-valuemax={week.goalMinutes} aria-valuenow={Math.min(week.totalMinutes, week.goalMinutes)} className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('dash.goalNone')}</p>
        )}
        <form onSubmit={saveGoal} className="flex flex-wrap items-end gap-3">
          <div className="w-56"><Field label={t('dash.goalLabel')} type="number" inputMode="numeric" min={0} max={6000} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="300" /></div>
          <Button type="submit" variant="outline" loading={saving}>{t('dash.goalSave')}</Button>
        </form>
    </section>
    </div>
  );
};

export default StudyWeekCard;
