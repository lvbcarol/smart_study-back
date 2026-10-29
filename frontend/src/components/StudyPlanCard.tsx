// src/components/StudyPlanCard.tsx — "Quanto tempo você tem hoje?" monta o plano de estudo personalizado do dia
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Clock, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { PlanBlock, StudyPlan } from '../types/study';
import { Button } from './ds/Button';
import { Field } from './ds/Field';
import { Badge, Skeleton } from './ds/Misc';
import { cn } from '@/lib/utils';

const PRESETS = [15, 30, 45, 60, 90];
const tz = () => new Date().getTimezoneOffset();

function blockLink(b: PlanBlock): string {
  switch (b.link.type) {
    case 'task': return `/tasks/${b.link.id}`;
    case 'quiz': return `/quizz/${b.link.id}`;
    case 'flashcards': return '/flashcards';
    case 'lesson': return `/subjects/${b.link.id}`;
    default: return '/agenda';
  }
}

const StudyPlanCard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [plan, setPlan] = useState<StudyPlan | null | undefined>(undefined);
  const [choosing, setChoosing] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [custom, setCustom] = useState('');
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    api.get<{ plan: StudyPlan | null }>('/study/plan', { params: { tzOffset: tz() } })
      .then((r) => setPlan(r.data.plan))
      .catch(() => setPlan(null));
  }, []);

  const chosen = custom ? Number(custom) : minutes;
  const valid = Number.isInteger(chosen) && chosen >= 5 && chosen <= 480;

  const build = async () => {
    if (!valid) return;
    setBuilding(true);
    try {
      const { data } = await api.post<{ plan: StudyPlan }>('/study/plan', { minutes: chosen, language: i18n.language, tzOffset: tz() });
      setPlan(data.plan);
      setChoosing(false);
    } catch {
      toast.error(t('plan.error'));
    } finally {
      setBuilding(false);
    }
  };

  const toggle = async (block: PlanBlock) => {
    try {
      const { data } = await api.put<{ plan: StudyPlan }>(`/study/plan/blocks/${encodeURIComponent(block.id)}`, { done: !block.done, tzOffset: tz() });
      setPlan(data.plan);
    } catch {
      toast.error(t('plan.error'));
    }
  };

  if (plan === undefined) return <Skeleton className="h-40" />;

  const showChooser = !plan || choosing;

  return (
    <section aria-labelledby="plan-title" className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="plan-title" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" /> {plan && !choosing ? t('plan.titleToday') : t('plan.question')}
        </h2>
        {plan && !choosing && (
          <Button variant="ghost" size="sm" onClick={() => setChoosing(true)}><RefreshCw className="h-4 w-4" aria-hidden="true" /> {t('plan.redo')}</Button>
        )}
      </div>

      {showChooser ? (
        <div className="mt-4 space-y-4">
          <p className="text-muted-foreground">{t('plan.hint')}</p>
          <div role="radiogroup" aria-label={t('plan.question')} className="flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <button
                key={m} type="button" role="radio" aria-checked={!custom && minutes === m} onClick={() => { setMinutes(m); setCustom(''); }}
                className={cn(
                  'min-h-11 rounded-full border-2 px-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !custom && minutes === m ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:border-primary'
                )}
              >
                {t('plan.minutesShort', { count: m })}
              </button>
            ))}
            <div className="w-36">
              <Field label={t('plan.other')} type="number" inputMode="numeric" min={5} max={480} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="25" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={build} loading={building} disabled={!valid}><Clock className="h-4 w-4" aria-hidden="true" /> {t('plan.build', { count: valid ? chosen : 0 })}</Button>
            {plan && <Button variant="ghost" onClick={() => setChoosing(false)}>{t('common.cancel')}</Button>}
          </div>
        </div>
      ) : plan && (
        <div className="mt-4 space-y-4">
          <p className="text-muted-foreground">{plan.intro}</p>
          {plan.blocks.length > 0 && (
            <>
              <p className="text-sm font-medium" aria-live="polite">{t('plan.progress', { done: plan.blocks.filter((b) => b.done).length, total: plan.blocks.length })}</p>
              <ol className="space-y-3">
                {plan.blocks.map((b) => (
                  <li key={b.id} className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
                    <button
                      type="button" onClick={() => toggle(b)} aria-pressed={b.done} aria-label={t(b.done ? 'plan.markUndone' : 'plan.markDone', { title: b.title })}
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        b.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
                      )}
                    >
                      {b.done && <Check className="h-4 w-4" aria-hidden="true" />}
                    </button>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className={cn('flex flex-wrap items-center gap-2 font-semibold', b.done && 'text-muted-foreground line-through')}>
                        {b.title} <Badge variant="primary">{t('plan.minutesShort', { count: b.minutes })}</Badge>
                      </p>
                      <details className="text-sm text-muted-foreground">
                        <summary className="cursor-pointer font-medium text-foreground">{t('plan.why')}</summary>
                        <p className="mt-1">{b.reason}</p>
                      </details>
                    </div>
                    <Link to={blockLink(b)} aria-label={t('plan.go', { title: b.title })} className="mt-0.5 rounded-lg p-1 text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <ChevronRight className="h-6 w-6" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default StudyPlanCard;
