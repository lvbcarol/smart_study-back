// "Quanto tempo você tem hoje?" monta o plano de estudo personalizado do dia
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import type { PlanBlock, StudyPlan } from '@/types';
import { Badge, Button, Card, Chip, Field, Row, T } from '@/ui';

const PRESETS = [15, 30, 45, 60, 90];
const tz = () => new Date().getTimezoneOffset();

function blockRoute(b: PlanBlock): string {
  switch (b.link.type) {
    case 'task': return `/task/${b.link.id}`;
    case 'quiz': return `/quiz/${b.link.id}`;
    case 'flashcards': return '/flashcards';
    case 'lesson': return `/lesson/${b.link.id}`;
    default: return '/agenda';
  }
}

export function StudyPlanCard() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [plan, setPlan] = useState<StudyPlan | null | undefined>(undefined);
  const [choosing, setChoosing] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [custom, setCustom] = useState('');
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ plan: StudyPlan | null }>('/study/plan', { params: { tzOffset: tz() } })
      .then((r) => setPlan(r.data.plan)).catch(() => setPlan(null));
  }, []);

  const chosen = custom ? Number(custom) : minutes;
  const valid = Number.isInteger(chosen) && chosen >= 5 && chosen <= 480;

  const build = async () => {
    if (!valid) return;
    setBuilding(true); setError('');
    try {
      const { data } = await api.post<{ plan: StudyPlan }>('/study/plan', { minutes: chosen, language: i18n.language, tzOffset: tz() });
      setPlan(data.plan); setChoosing(false);
    } catch {
      setError(t('plan.error'));
    } finally {
      setBuilding(false);
    }
  };

  const toggle = async (b: PlanBlock) => {
    try {
      const { data } = await api.put<{ plan: StudyPlan }>(`/study/plan/blocks/${encodeURIComponent(b.id)}`, { done: !b.done, tzOffset: tz() });
      setPlan(data.plan);
    } catch {
      setError(t('plan.error'));
    }
  };

  if (plan === undefined) return null;
  const showChooser = !plan || choosing;

  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <T variant="heading" style={{ flex: 1 }}>{plan && !choosing ? t('plan.titleToday') : t('plan.question')}</T>
        {plan && !choosing && <Button title={t('plan.redo')} variant="ghost" onPress={() => setChoosing(true)} />}
      </Row>

      {showChooser ? (
        <>
          <T variant="muted">{t('plan.hint')}</T>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map((m) => <Chip key={m} label={t('plan.minutesShort', { count: m })} selected={!custom && minutes === m} onPress={() => { setMinutes(m); setCustom(''); }} />)}
          </View>
          <Field label={t('plan.other')} value={custom} onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={3} placeholder="25" />
          {error ? <T variant="small" color={colors.destructive}>{error}</T> : null}
          <Button title={t('plan.build', { count: valid ? chosen : 0 })} onPress={build} loading={building} disabled={!valid} />
          {plan && <Button title={t('common.cancel')} variant="ghost" onPress={() => setChoosing(false)} />}
        </>
      ) : plan && (
        <>
          <T variant="muted">{plan.intro}</T>
          {plan.blocks.length > 0 && <T variant="small" accessibilityLiveRegion="polite">{t('plan.progress', { done: plan.blocks.filter((b) => b.done).length, total: plan.blocks.length })}</T>}
          {plan.blocks.map((b) => (
            <View key={b.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, backgroundColor: colors.background }}>
              <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <Pressable
                  onPress={() => toggle(b)} accessibilityRole="checkbox" accessibilityState={{ checked: b.done }}
                  accessibilityLabel={t(b.done ? 'plan.markUndone' : 'plan.markDone', { title: b.title })}
                  style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: b.done ? colors.primary : colors.border, backgroundColor: b.done ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                >
                  {b.done && <Ionicons name="checkmark" size={18} color={colors.primaryFg} />}
                </Pressable>
                <View style={{ flex: 1, gap: 6 }}>
                  <T variant="label" style={{ textDecorationLine: b.done ? 'line-through' : 'none' }}>{b.title}</T>
                  <Row><Badge variant="primary">{t('plan.minutesShort', { count: b.minutes })}</Badge></Row>
                </View>
                <Pressable onPress={() => router.push(blockRoute(b) as never)} accessibilityRole="button" accessibilityLabel={t('plan.go', { title: b.title })} hitSlop={8}>
                  <Ionicons name="chevron-forward" size={26} color={colors.primary} />
                </Pressable>
              </Row>
              <Pressable onPress={() => setOpen(open === b.id ? null : b.id)} accessibilityRole="button" accessibilityState={{ expanded: open === b.id }}>
                <T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>{t('plan.why')} {open === b.id ? '▲' : '▼'}</T>
              </Pressable>
              {open === b.id && <T variant="small">{b.reason}</T>}
            </View>
          ))}
        </>
      )}
    </Card>
  );
}
