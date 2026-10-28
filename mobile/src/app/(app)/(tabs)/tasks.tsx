import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import { useRemote } from '@/hooks/useRemote';
import { formatDate } from '@/lib/format';
import type { StudentTaskRow } from '@/types';
import { Badge, Card, EmptyState, Loading, Row, scoreVariant, Screen, T } from '@/ui';

export default function Tasks() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { data, refreshing, refresh } = useRemote(() => api.get<StudentTaskRow[]>('/tasks/mine').then((r) => r.data));

  if (!data) return <Screen><Loading /></Screen>;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ paddingTop: 8 }}><T variant="title">{t('tasks.title')}</T></View>
      {data.length === 0 ? (
        <EmptyState title={t('tasks.emptyTitle')} description={t('tasks.emptyDesc')} />
      ) : (
        data.map((task) => (
          <Card key={task._id} onPress={() => router.push(`/task/${task._id}`)} accessibilityLabel={task.title} style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <T variant="heading" style={{ flex: 1 }}>{task.title}</T>
              {task.score !== null && <Badge variant={scoreVariant(task.score)}>{task.score}%</Badge>}
            </Row>
            <T variant="muted">{[task.notebookTitle, task.lessonTitle].filter(Boolean).join(' · ')}</T>
            <Row>
              <Badge variant={task.status === 'submitted' ? 'success' : task.status === 'in_progress' ? 'primary' : 'neutral'}>{t(`tasks.status.${task.status}`)}</Badge>
              {task.overdue && <Badge variant="destructive">{t('tasks.overdue')}</Badge>}
              {task.late && <Badge variant="warning">{t('tasks.late')}</Badge>}
            </Row>
            <T variant="small" color={task.overdue ? colors.destructive : undefined}>{task.dueDate ? t('tasks.due', { date: formatDate(task.dueDate, i18n.language) }) : t('tasks.noDue')}</T>
          </Card>
        ))
      )}
    </Screen>
  );
}
