import React, { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useTheme } from '@/theme/ThemeContext';
import { formatDate } from '@/lib/format';
import { QuizPlayer } from '@/components/QuizPlayer';
import { AttemptReview } from '@/components/AttemptReview';
import type { AttemptDetail, StudentTaskSummary, TaskStart } from '@/types';
import { Badge, Button, Card, Loading, Row, scoreVariant, Screen, T } from '@/ui';

export default function TaskScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [task, setTask] = useState<StudentTaskSummary | null>(null);
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [started, setStarted] = useState<TaskStart | null>(null);
  const [starting, setStarting] = useState(false);
  const [justSent, setJustSent] = useState<number | null>(null);
  const [error, setError] = useState('');
  useStudyTimer('task', undefined, !!started);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<StudentTaskSummary>(`/tasks/${taskId}`);
      setTask(data);
      if (data.status === 'submitted') setAttempt((await api.get<AttemptDetail>(`/tasks/${taskId}/my-attempt`)).data);
    } catch {
      setError(t('tasks.loadError'));
    }
  }, [taskId, t]);
  useEffect(() => { load(); }, [load]);

  const start = async () => {
    setStarting(true); setError('');
    try {
      setStarted((await api.post<TaskStart>(`/tasks/${taskId}/start`, { language: i18n.language })).data);
    } catch {
      setError(t('tasks.loadError'));
    } finally {
      setStarting(false);
    }
  };

  if (!task) return <Screen>{error ? <T variant="muted" color={colors.destructive}>{error}</T> : <Loading />}</Screen>;

  if (started) {
    return (
      <Screen edges={['left', 'right', 'bottom']} scroll={false} contentStyle={{ padding: 0, gap: 0 }}>
        <Stack.Screen options={{ title: started.title }} />
        <QuizPlayer
          header={started.answeredCount > 0 ? <T variant="small">{t('tasks.resumeNote', { count: started.answeredCount, total: started.questions.length })}</T> : undefined}
          draftId={started.draftId} questions={started.questions} startIndex={started.answeredCount} taskMode
          onComplete={(s) => { setStarted(null); setAttempt(null); setJustSent(s.score); load(); }}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: task.title }} />
      <T variant="title">{task.title}</T>
      <Row>
        <Badge variant={task.status === 'submitted' ? 'success' : task.status === 'in_progress' ? 'primary' : 'neutral'}>{t(`tasks.status.${task.status}`)}</Badge>
        <Badge>{t('tasks.questions', { count: task.questionsCount })}</Badge>
        {task.late && <Badge variant="warning">{t('tasks.late')}</Badge>}
      </Row>
      <T variant="muted">{[task.notebookTitle, task.lessonTitle].filter(Boolean).join(' · ')}</T>
      <T variant="small">{task.dueDate ? t('tasks.due', { date: formatDate(task.dueDate, i18n.language) }) : t('tasks.noDue')}</T>
      {task.description ? <T variant="body">{task.description}</T> : null}

      {justSent !== null && (
        <Card style={{ backgroundColor: colors.accent }}><T variant="heading" color={colors.accentFg} accessibilityLiveRegion="polite">{t('tasks.sent', { score: justSent })}</T></Card>
      )}

      {task.status === 'submitted' ? (
        <>
          <Card style={{ gap: 6 }}>
            <T variant="heading">{t('tasks.alreadySubmitted')}</T>
            {task.score !== null && <Badge variant={scoreVariant(task.score)}>{t('tasks.score', { score: task.score })}</Badge>}
          </Card>
          <T variant="heading">{t('tasks.myAnswers')}</T>
          {attempt ? <AttemptReview questions={attempt.questions} answers={attempt.answers} results={attempt.results} /> : <Loading />}
        </>
      ) : (
        <>
          <Card><T variant="muted">{t('tasks.instructions')}</T></Card>
          {error ? <T variant="small" color={colors.destructive}>{error}</T> : null}
          <Button title={task.status === 'in_progress' ? t('tasks.resume') : t('tasks.start')} onPress={start} loading={starting} />
        </>
      )}
    </Screen>
  );
}
