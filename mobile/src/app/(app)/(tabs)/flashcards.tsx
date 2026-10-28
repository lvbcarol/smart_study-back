import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import { useRemote } from '@/hooks/useRemote';
import type { DeckSummary, Notebook } from '@/types';
import { Badge, Button, Card, EmptyState, Field, Loading, Row, Screen, T } from '@/ui';

export default function Flashcards() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ lessonId?: string }>();
  const { data, refreshing, refresh, reload } = useRemote(async () => {
    const [decks, notebooks] = await Promise.all([
      api.get<DeckSummary[]>('/flashcards/decks').then((r) => r.data),
      api.get<Notebook[]>('/notebooks').then((r) => r.data),
    ]);
    return { decks, notebooks };
  });

  const [open, setOpen] = useState(!!params.lessonId);
  const [lessonId, setLessonId] = useState(params.lessonId ?? '');
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  if (!data) return <Screen><Loading /></Screen>;

  const lessons = data.notebooks.flatMap((n) => n.lessons.map((l) => ({ id: l._id, label: `${n.title} · ${l.title}` })));

  const generate = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const res = await api.post<{ added: number }>('/flashcards/decks/generate', { lessonId, topic, language: i18n.language, count: 10 });
      setMessage(res.data.added > 0 ? t('flashcards.generated', { count: res.data.added }) : t('flashcards.noneNew'));
      setOpen(false); setTopic('');
      reload();
    } catch {
      setMessage(t('flashcards.generateError'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: 4, paddingTop: 8 }}>
        <T variant="title">{t('flashcards.title')}</T>
        <T variant="muted">{t('flashcards.subtitle')}</T>
      </View>

      <Button title={open ? t('common.cancel') : `+ ${t('flashcards.generate')}`} variant={open ? 'ghost' : 'primary'} onPress={() => setOpen((o) => !o)} />
      {message ? <T variant="small" color={colors.primary} accessibilityLiveRegion="polite">{message}</T> : null}

      {open && (
        <Card style={{ gap: 12 }}>
          <T variant="heading">{t('flashcards.generateTitle')}</T>
          {lessons.length === 0 ? <T variant="muted">{t('flashcards.noLessons')}</T> : (
            <>
              <T variant="label">{t('flashcards.lesson')}</T>
              <View style={{ gap: 8 }}>
                {lessons.map((l) => (
                  <Pressable
                    key={l.id} onPress={() => setLessonId(l.id)} accessibilityRole="radio" accessibilityState={{ selected: lessonId === l.id }}
                    style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: lessonId === l.id ? colors.primary : colors.border, backgroundColor: lessonId === l.id ? colors.accent : colors.card, justifyContent: 'center', paddingHorizontal: 14 }}
                  >
                    <T variant="label" color={lessonId === l.id ? colors.accentFg : undefined}>{l.label}</T>
                  </Pressable>
                ))}
              </View>
              <Field label={t('flashcards.topic')} placeholder={t('flashcards.topicPlaceholder')} value={topic} onChangeText={setTopic} autoCapitalize="sentences" maxLength={200} />
              <Button title={generating ? t('flashcards.generating') : t('flashcards.generate')} onPress={generate} loading={generating} disabled={!lessonId || !topic.trim()} />
            </>
          )}
        </Card>
      )}

      {data.decks.length === 0 ? (
        <EmptyState title={t('flashcards.emptyTitle')} description={t('flashcards.emptyDesc')} />
      ) : (
        data.decks.map((deck) => (
          <Card key={deck._id} style={{ gap: 12 }}>
            <View>
              <T variant="heading">{deck.lessonTitle ?? deck.title}</T>
              <T variant="muted">{deck.notebookTitle}</T>
            </View>
            <Row style={{ gap: 8, flexWrap: 'nowrap' }}>
              {([['due', deck.due, deck.due > 0 ? 'primary' : 'neutral'], ['new', deck.new, 'neutral'], ['learned', deck.learned, 'success']] as const).map(([key, value, variant]) => (
                <View key={key} style={{ flex: 1, alignItems: 'center', gap: 4, backgroundColor: colors.secondary, borderRadius: 12, paddingVertical: 10 }}>
                  <T variant="title">{value}</T>
                  <Badge variant={variant}>{t(`flashcards.${key}`)}</Badge>
                </View>
              ))}
            </Row>
            {deck.due > 0 ? (
              <Button title={`${t('flashcards.study')} (${deck.due})`} onPress={() => router.push(`/flashcards/${deck._id}`)} />
            ) : (
              <T variant="muted" align="center">{t('flashcards.nothingDue')}</T>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}
