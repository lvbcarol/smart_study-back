import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import { useRemote } from '@/hooks/useRemote';
import { Badge, Card, Loading, Row, Screen, T } from '@/ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function LessonHub() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { data } = useRemote(() => api.get<{ notebookTitle: string; lessonTitle: string; readOnly?: boolean; materialsCount?: number }>(`/lessons/${lessonId}`).then((r) => r.data));

  if (!data) return <Screen><Loading /></Screen>;

  const tile = (icon: IconName, title: string, description: string, onPress: () => void) => (
    <Card onPress={onPress} accessibilityLabel={title} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={24} color={colors.accentFg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading">{title}</T>
        <T variant="muted">{description}</T>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.mutedFg} />
    </Card>
  );

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: data.lessonTitle }} />
      <View style={{ gap: 6 }}>
        <T variant="muted">{data.notebookTitle}</T>
        <T variant="title">{data.lessonTitle}</T>
        {data.readOnly && <Row><Badge variant="primary">{t('notebooks.fromTeacher')}</Badge></Row>}
      </View>

      {!!data.materialsCount && (
        <Card style={{ backgroundColor: colors.accent, padding: 12 }}>
          <T variant="small" color={colors.accentFg}>📎 {t('lesson.materials', { count: data.materialsCount })}</T>
        </Card>
      )}

      {tile('book-outline', t('lesson.summary'), t('lesson.summaryDesc'), () => router.push(`/summary/${lessonId}`))}
      {tile('help-circle-outline', t('lesson.quiz'), t('lesson.quizDesc'), () => router.push(`/quiz/${lessonId}`))}
      {tile('layers-outline', t('lesson.flashcards'), t('lesson.flashcardsDesc'), () => router.push({ pathname: '/flashcards', params: { lessonId: String(lessonId) } }))}
    </Screen>
  );
}
