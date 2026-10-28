import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import { useRemote } from '@/hooks/useRemote';
import type { Notebook } from '@/types';
import { Badge, Button, Card, EmptyState, Field, Loading, Row, Screen, T } from '@/ui';

export default function Notebooks() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { data, refreshing, refresh, reload } = useRemote(() => api.get<Notebook[]>('/notebooks').then((r) => r.data));
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [error, setError] = useState('');

  const createNotebook = async () => {
    try {
      await api.post('/notebooks', { title });
      setTitle(''); setCreating(false); setError('');
      reload();
    } catch { setError(t('notebooks.createError')); }
  };

  const createLesson = async (notebookId: string) => {
    try {
      await api.post(`/notebooks/${notebookId}/lessons`, { title: lessonTitle });
      setLessonTitle(''); setAddingTo(null); setError('');
      reload();
    } catch { setError(t('notebooks.createError')); }
  };

  if (!data) return <Screen><Loading /></Screen>;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Row style={{ justifyContent: 'space-between', paddingTop: 8 }}>
        <T variant="title">{t('notebooks.title')}</T>
        <Button title={t('notebooks.new')} variant={creating ? 'ghost' : 'primary'} onPress={() => setCreating((c) => !c)} style={{ minHeight: 40, paddingHorizontal: 14 }} />
      </Row>

      {creating && (
        <Card style={{ gap: 12 }}>
          <Field label={t('notebooks.new')} placeholder={t('notebooks.newPlaceholder')} value={title} onChangeText={setTitle} autoCapitalize="sentences" maxLength={120} onSubmitEditing={createNotebook} />
          <Button title={t('common.create')} onPress={createNotebook} disabled={!title.trim()} />
        </Card>
      )}
      {error ? <T variant="small" color={colors.destructive}>{error}</T> : null}

      {data.length === 0 ? (
        <EmptyState title={t('notebooks.emptyTitle')} description={t('notebooks.emptyDesc')} />
      ) : (
        data.map((nb) => (
          <Card key={nb._id} style={{ gap: 10 }}>
            <View style={{ gap: 6 }}>
              <T variant="heading">{nb.title}</T>
              <Row>
                <Badge>{t('notebooks.lessons', { count: nb.lessons.length })}</Badge>
                {nb.readOnly && <Badge variant="primary">{nb.ownerName ?? t('notebooks.fromTeacher')}</Badge>}
                {nb.turmaName && <Badge>{nb.turmaName}</Badge>}
              </Row>
            </View>
            {nb.lessons.length === 0 && <T variant="muted">{t('notebooks.noLessons')}</T>}
            {nb.lessons.map((lesson) => (
              <Pressable
                key={lesson._id} onPress={() => router.push(`/lesson/${lesson._id}`)} accessibilityRole="button" accessibilityLabel={lesson.title}
                style={({ pressed }) => ({ minHeight: 48, borderRadius: 14, backgroundColor: colors.secondary, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: pressed ? 0.8 : 1 })}
              >
                <T variant="label" style={{ flex: 1 }}>{lesson.title}</T>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedFg} />
              </Pressable>
            ))}
            {!nb.readOnly && (addingTo === nb._id ? (
              <View style={{ gap: 10 }}>
                <Field label={t('notebooks.newLesson')} placeholder={t('notebooks.lessonPlaceholder')} value={lessonTitle} onChangeText={setLessonTitle} autoCapitalize="sentences" maxLength={120} onSubmitEditing={() => createLesson(nb._id)} />
                <Row>
                  <Button title={t('common.create')} onPress={() => createLesson(nb._id)} disabled={!lessonTitle.trim()} style={{ flex: 1 }} />
                  <Button title={t('common.cancel')} variant="ghost" onPress={() => setAddingTo(null)} />
                </Row>
              </View>
            ) : (
              <Button title={`+ ${t('notebooks.newLesson')}`} variant="ghost" onPress={() => { setAddingTo(nb._id); setLessonTitle(''); }} style={{ alignSelf: 'flex-start' }} />
            ))}
          </Card>
        ))
      )}
    </Screen>
  );
}
