// src/components/dash/KolbCard.tsx — "Seu jeito de aprender": perfil dinâmico (ciclo de Kolb) com o porquê de cada número
import React, { useState } from 'react';
import { EyeOff, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ds/Button';
import { Badge } from '../ds/Misc';
import { axisTick, ChartCard, DataTable, reducedMotion, tooltipStyle } from './ChartCard';
import type { KolbProfile } from '../../types/dashboard';

const KolbCard: React.FC<{ kolb: KolbProfile | null; onChanged: () => void }> = ({ kolb, onChanged }) => {
  const { t } = useTranslation();
  const { savePreferences } = useAuth();
  const [busy, setBusy] = useState(false);

  const setVisible = async (visible: boolean) => {
    setBusy(true);
    try {
      await savePreferences({ showLearningProfile: visible });
      onChanged();
    } catch {
      toast.error(t('privacy.saveError'));
    } finally {
      setBusy(false);
    }
  };

  if (!kolb) {
    return (
      <section aria-labelledby="kolb-title" className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 id="kolb-title" className="font-display text-xl font-bold">{t('kolb.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('kolb.hidden')}</p>
        <Button className="mt-4" variant="outline" size="sm" loading={busy} onClick={() => setVisible(true)}><Eye className="h-4 w-4" aria-hidden="true" /> {t('kolb.show')}</Button>
      </section>
    );
  }

  const name = (id: string) => t(`kolb.quadrants.${id}`);
  const data = kolb.quadrants.map((q) => ({ id: q.id, name: name(q.id), value: Math.round(q.share * 100) }));
  const gap = kolb.hasGap && kolb.weakest ? kolb.quadrants.find((q) => q.id === kolb.weakest) : null;

  return (
    <ChartCard
      title={t('kolb.title')} description={t('kolb.desc')}
      empty={kolb.enough ? undefined : t('kolb.notEnough')}
      actions={<Button variant="ghost" size="sm" loading={busy} onClick={() => setVisible(false)}><EyeOff className="h-4 w-4" aria-hidden="true" /> {t('kolb.hide')}</Button>}
      table={<DataTable caption={t('kolb.title')} head={[t('kolb.quadrant'), t('kolb.practice'), t('dash.accuracy'), t('kolb.evidence')]} rows={kolb.quadrants.map((q) => [name(q.id), `${Math.round(q.share * 100)}%`, q.accuracy === null ? '–' : `${Math.round(q.accuracy * 100)}%`, t('kolb.evidenceValue', { answers: Math.round(q.answers), minutes: q.minutes })])} />}
    >
      {kolb.style && (
        <div className="mb-3 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">{t('kolb.styleLabel')} <Badge variant="primary" className="text-sm">{t(`kolb.styles.${kolb.style}`)}</Badge></p>
          <p className="text-sm text-muted-foreground">{t(`kolb.styleDesc.${kolb.style}`)}</p>
        </div>
      )}
      <div className="h-64" role="img" aria-label={`${t('kolb.practice')}: ${data.map((d) => `${d.name} ${d.value}%`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="name" tick={axisTick} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, t('kolb.practice')]} />
            <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} isAnimationActive={!reducedMotion()} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {gap && (
        <p className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm text-accent-foreground">
          {t('kolb.gap', { name: name(gap.id), pct: Math.round(gap.share * 100), hint: t(`kolb.hints.${gap.id}`) })}
        </p>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold">{t('kolb.whyTitle')}</summary>
        <p className="mt-2 text-muted-foreground">{t('kolb.whyText')}</p>
        <ul className="mt-2 space-y-1">
          {kolb.quadrants.map((q) => (
            <li key={q.id}><span className="font-medium">{name(q.id)}:</span> <span className="text-muted-foreground">{t('kolb.evidenceValue', { answers: Math.round(q.answers), minutes: q.minutes })}</span></li>
          ))}
        </ul>
      </details>
    </ChartCard>
  );
};

export default KolbCard;
