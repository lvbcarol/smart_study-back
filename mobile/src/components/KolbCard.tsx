// "Seu jeito de aprender": perfil dinâmico (ciclo de Kolb) com o porquê de cada número
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { BarChartH } from '@/components/charts';
import type { KolbProfile } from '@/types';
import { Badge, Button, Card, T } from '@/ui';

export function KolbCard({ kolb, onChanged }: { kolb: KolbProfile | null; onChanged: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { savePreferences } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const setVisible = async (visible: boolean) => {
    setBusy(true); setError('');
    try { await savePreferences({ showLearningProfile: visible }); onChanged(); } catch { setError(t('privacy.saveError')); } finally { setBusy(false); }
  };

  if (!kolb) {
    return (
      <Card style={{ gap: 10 }}>
        <T variant="heading">{t('kolb.title')}</T>
        <T variant="muted">{t('kolb.hidden')}</T>
        <Button title={t('kolb.show')} variant="outline" onPress={() => setVisible(true)} loading={busy} />
        {error ? <T variant="small" color={colors.destructive}>{error}</T> : null}
      </Card>
    );
  }

  const name = (id: string) => t(`kolb.quadrants.${id}`);
  const gap = kolb.hasGap && kolb.weakest ? kolb.quadrants.find((q) => q.id === kolb.weakest) : null;

  return (
    <Card style={{ gap: 12 }}>
      <T variant="heading">{t('kolb.title')}</T>
      <T variant="small">{t('kolb.desc')}</T>
      {!kolb.enough ? <T variant="muted">{t('kolb.notEnough')}</T> : (
        <>
          {kolb.style && (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <T variant="label">{t('kolb.styleLabel')}</T>
                <Badge variant="primary">{t(`kolb.styles.${kolb.style}`)}</Badge>
              </View>
              <T variant="small">{t(`kolb.styleDesc.${kolb.style}`)}</T>
            </View>
          )}
          <BarChartH
            data={kolb.quadrants.map((q, i) => ({ label: name(q.id), value: Math.round(q.share * 100), color: colors.charts[i % colors.charts.length] }))}
            summary={`${t('kolb.practice')}: ${kolb.quadrants.map((q) => `${name(q.id)} ${Math.round(q.share * 100)}%`).join(', ')}`}
          />
          {gap && (
            <View style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 10 }}>
              <T variant="small" color={colors.accentFg}>{t('kolb.gap', { name: name(gap.id), pct: Math.round(gap.share * 100), hint: t(`kolb.hints.${gap.id}`) })}</T>
            </View>
          )}
        </>
      )}
      <Button title={t('kolb.whyTitle')} variant="ghost" onPress={() => setOpen((o) => !o)} accessibilityLabel={`${t('kolb.whyTitle')} ${open ? '▲' : '▼'}`} />
      {open && (
        <View style={{ gap: 6 }}>
          <T variant="small">{t('kolb.whyText')}</T>
          {kolb.quadrants.map((q) => <T key={q.id} variant="small"><T variant="small" style={{ fontWeight: '700' }} color={colors.foreground}>{name(q.id)}: </T>{t('kolb.evidenceValue', { answers: Math.round(q.answers), minutes: q.minutes })}</T>)}
        </View>
      )}
      <Button title={t('kolb.hide')} variant="outline" onPress={() => setVisible(false)} loading={busy} />
      {error ? <T variant="small" color={colors.destructive}>{error}</T> : null}
    </Card>
  );
}
