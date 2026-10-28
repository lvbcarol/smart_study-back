import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import { useRemote } from '@/hooks/useRemote';
import { formatDate } from '@/lib/format';
import { QuizPlayer } from '@/components/QuizPlayer';
import { AttemptReview } from '@/components/AttemptReview';
import type { AttemptDetail, DraftResponse } from '@/types';
import { Badge, Button, Card, Chip, EmptyState, Field, Loading, Row, scoreVariant, Screen, T } from '@/ui';

const QUESTION_COUNTS = [4, 6, 8, 10, 12];

type Phase = 'list' | 'topic' | 'generating' | 'playing' | 'done' | 'review';

export default function Quiz() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { data, reload } = useRemote(() => api.get<{ lessonTitle: string; quizzAttempts: AttemptDetail[] }>(`/lessons/${lessonId}`).then((r) => r.data));

  const [phase, setPhase] = useState<Phase>('list');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(8);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ score: number; correctCount: number; total: number } | null>(null);
  const [selected, setSelected] = useState<AttemptDetail | null>(null);

  const start = async () => {
    setPhase('generating'); setError('');
    try {
      const res = await api.post<DraftResponse>('/quizz/drafts', { lessonId, topic: topic.trim(), language: i18n.language, count });
      setDraft(res.data); setPhase('playing');
    } catch {
      setError(t('quiz.generateError')); setPhase('topic');
    }
  };

  if (!data) return <Screen><Loading /></Screen>;

  const backToList = () => { setPhase('list'); setTopic(''); setDraft(null); reload(); };

  return (
    // durante o quiz a tela não rola: o QuizPlayer cuida da rolagem e do rodapé fixo
    <Screen edges={['left', 'right', 'bottom']} scroll={phase !== 'playing'} contentStyle={phase === 'playing' ? { padding: 0, gap: 0 } : undefined}>
      <Stack.Screen options={{ title: t('quiz.title') }} />

      {phase === 'list' && (
        <>
          <T variant="title">{data.lessonTitle}</T>
          <Button title={t('quiz.startNew')} onPress={() => setPhase('topic')} />
          {data.quizzAttempts.length === 0 ? <EmptyState title={t('quiz.noAttempts')} /> : (
            data.quizzAttempts.slice().reverse().map((a) => (
              <Card key={a._id} onPress={() => { setSelected(a); setPhase('review'); }} accessibilityLabel={t('quiz.attemptN', { n: a.attemptNumber })} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <T variant="heading">{t('quiz.attemptN', { n: a.attemptNumber })}</T>
                  <T variant="small">{formatDate(a.date, i18n.language)}</T>
                </View>
                <Badge variant={scoreVariant(a.score)}>{a.score}%</Badge>
              </Card>
            ))
          )}
        </>
      )}

      {phase === 'topic' && (
        <>
          <T variant="title">{t('quiz.topicTitle')}</T>
          <T variant="muted">{t('quiz.topicHint')}</T>
          <Field label={t('flashcards.topic')} placeholder={t('quiz.topicPlaceholder')} value={topic} onChangeText={setTopic} autoCapitalize="sentences" maxLength={200} />
          <View style={{ gap: 8 }}>
            <T variant="label">{t('quiz.countLabel')}</T>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {QUESTION_COUNTS.map((n) => <Chip key={n} label={String(n)} selected={count === n} onPress={() => setCount(n)} />)}
            </View>
            <T variant="small">{t('quiz.countOption', { count })}</T>
          </View>
          {error ? <T variant="small" color={colors.destructive}>{error}</T> : null}
          <Button title={t('quiz.start')} onPress={start} disabled={!topic.trim()} />
          <Button title={t('common.cancel')} variant="ghost" onPress={backToList} />
        </>
      )}

      {phase === 'generating' && (
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: 16, paddingVertical: 64 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <T variant="title" align="center">{t('quiz.generating')}</T>
          <T variant="muted" align="center">{t('quiz.generatingHint')}</T>
        </View>
      )}

      {phase === 'playing' && draft && (
        <QuizPlayer
          draftId={draft.draftId} questions={draft.questions}
          header={(
            <View style={{ gap: 8 }}>
              {draft.reinforcing.length > 0 && (
                <Card style={{ backgroundColor: colors.accent, padding: 12 }}>
                  <T variant="small" color={colors.accentFg}>🎯 {t('quiz.reinforcing', { topics: draft.reinforcing.join(', ') })}</T>
                </Card>
              )}
              {draft.materialsUsed > 0 && <T variant="small">📎 {t('quiz.usingMaterials', { count: draft.materialsUsed })}</T>}
            </View>
          )}
          onComplete={(s) => { setSummary(s); setPhase('done'); }}
        />
      )}

      {phase === 'done' && summary && (
        <>
          <Card style={{ gap: 8, backgroundColor: colors.accent }}>
            <T variant="title" color={colors.accentFg}>{t('quiz.doneTitle')}</T>
            <T variant="body" color={colors.accentFg}>{t('quiz.doneScore', { score: summary.score, correct: summary.correctCount, total: summary.total })}</T>
          </Card>
          <Button title={t('quiz.title')} onPress={backToList} />
          <Button title={t('quiz.backToLesson')} variant="outline" onPress={() => router.back()} />
        </>
      )}

      {phase === 'review' && selected && (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="heading">{t('quiz.reviewTitle', { n: selected.attemptNumber, score: selected.score })}</T>
            <Button title={t('common.back')} variant="ghost" onPress={() => setPhase('list')} />
          </Row>
          <AttemptReview questions={selected.questions} answers={selected.answers} results={selected.results} />
        </>
      )}
    </Screen>
  );
}
