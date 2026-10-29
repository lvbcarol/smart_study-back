import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { useRemote } from '@/hooks/useRemote';
import type { Notebook, StudentTaskRow } from '@/types';
import { StudyPlanCard } from '@/components/StudyPlanCard';
import { Button, Card, Loading, Screen, T } from '@/ui';

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <Card style={{ flexGrow: 1, flexBasis: '45%', padding: 14 }}>
    <T variant="small">{label}</T>
    <T variant="title">{value}</T>
  </Card>
);

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const { data, refreshing, refresh } = useRemote(async () => {
    const [notebooks, tasks, cards] = await Promise.all([
      api.get<Notebook[]>('/notebooks').then((r) => r.data),
      api.get<StudentTaskRow[]>('/tasks/mine').then((r) => r.data),
      api.get<{ due: number }>('/flashcards/summary').then((r) => r.data),
    ]);
    return { notebooks, tasks, cards };
  });

  if (!data) return <Screen><Loading /></Screen>;

  const lessons = data.notebooks.reduce((sum, n) => sum + n.lessons.length, 0);
  const scores = data.notebooks.flatMap((n) => n.lessons.flatMap((l) => (l.quizzAttempts ?? []).map((a) => a.score)));
  const average = scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : '–';
  const pending = data.tasks.filter((x) => x.status !== 'submitted');
  const next = pending[0];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: 4, paddingTop: 8 }}>
        <T variant="muted" color={colors.primary} style={{ fontWeight: '700' }}>{t('home.greeting', { name: user?.name.split(' ')[0] })}</T>
        <T variant="display">{t('home.title')}</T>
      </View>

      <StudyPlanCard />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label={t('home.statNotebooks')} value={data.notebooks.length} />
        <Stat label={t('home.statLessons')} value={lessons} />
        <Stat label={t('home.statAverage')} value={average} />
        <Stat label={t('home.statTasks')} value={pending.length} />
      </View>

      {next && (
        <Card onPress={() => router.push(`/task/${next._id}`)} accessibilityLabel={`${t('home.nextTask')}: ${next.title}`} style={{ backgroundColor: colors.accent }}>
          <T variant="small" color={colors.accentFg}>{t('home.nextTask')}</T>
          <T variant="heading" color={colors.accentFg}>{next.title}</T>
          <T variant="muted" color={colors.accentFg}>{[next.notebookTitle, next.lessonTitle].filter(Boolean).join(' · ')}</T>
        </Card>
      )}

      <View style={{ gap: 10 }}>
        <T variant="heading">{t('home.quick')}</T>
        {data.cards.due > 0 && (
          <Button title={`${t('home.reviewCards')} (${data.cards.due})`} onPress={() => router.push('/flashcards')} />
        )}
        <Button title={t('home.openNotebooks')} variant={data.cards.due > 0 ? 'outline' : 'primary'} onPress={() => router.push('/notebooks')} />
      </View>
    </Screen>
  );
}
