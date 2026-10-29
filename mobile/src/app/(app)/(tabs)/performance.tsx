// "Desempenho": dashboard do aluno (notas, tempo de estudo da semana com meta, pontos fracos)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { sendStudySession } from '@/hooks/useStudyTimer';
import { BarChartH, BarChartV, LineChart } from '@/components/charts';
import { KolbCard } from '@/components/KolbCard';
import type { Notebook, StudentDashboard } from '@/types';
import { Badge, Button, Card, Chip, EmptyState, Field, Loading, Row, Screen, T } from '@/ui';

const RANGES = [7, 30, 90] as const;
const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
const fmtClock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <Card style={{ flexGrow: 1, flexBasis: '45%', padding: 14 }}>
    <T variant="small">{label}</T>
    <T variant="title">{value}</T>
  </Card>
);

/** Cronômetro "Estudar agora": para estudo fora do app (livro, caderno, aula). */
function StudyTimer({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState('');
  const live = useRef({ startedAt, seconds });
  live.current = { startedAt, seconds };

  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.getTime()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // saiu da tela com o cronômetro ligado: guarda o que já estudou
  useEffect(() => () => {
    const { startedAt: s, seconds: sec } = live.current;
    if (s && sec >= 15) void sendStudySession('manual', sec, s);
  }, []);

  const toggle = async () => {
    setNote('');
    if (!startedAt) { setSeconds(0); setStartedAt(new Date()); return; }
    const done = seconds;
    const started = startedAt;
    setStartedAt(null);
    if (done < 15) { setNote(t('dash.timerTooShort')); return; }
    await sendStudySession('manual', done, started);
    setNote(t('dash.timerSaved', { minutes: Math.max(1, Math.round(done / 60)) }));
    onSaved();
  };

  return (
    <Card style={{ backgroundColor: colors.accent, gap: 10 }}>
      <T variant="heading" color={colors.accentFg}>{t('dash.timerTitle')}</T>
      <T variant="small" color={colors.accentFg}>{t('dash.timerHint')}</T>
      <T variant="display" color={colors.accentFg} accessibilityLiveRegion="none">{fmtClock(seconds)}</T>
      <Button title={startedAt ? t('dash.timerStop') : t('dash.timerStart')} onPress={toggle} variant={startedAt ? 'destructive' : 'primary'} />
      {note ? <T variant="small" color={colors.accentFg} accessibilityLiveRegion="polite">{note}</T> : null}
    </Card>
  );
}

export default function Performance() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { savePreferences } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState<number>(30);
  const [notebookId, setNotebookId] = useState('');
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [goalNote, setGoalNote] = useState<{ text: string; error: boolean } | null>(null);
  const goalTouched = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<StudentDashboard>('/dashboard/student', { params: { range, tzOffset: new Date().getTimezoneOffset(), ...(notebookId ? { notebook: notebookId } : {}) } });
      setData(r.data);
      setError(false);
      if (!goalTouched.current) setGoal(r.data.study.goalMinutes ? String(r.data.study.goalMinutes) : '');
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, [range, notebookId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { api.get<Notebook[]>('/notebooks').then((r) => setNotebooks(r.data)).catch(() => undefined); }, []);

  const saveGoal = async () => {
    const value = goal.trim() === '' ? 0 : Number(goal);
    if (!Number.isInteger(value) || value < 0 || value > 6000) { setGoalNote({ text: t('dash.goalInvalid'), error: true }); return; }
    try {
      await savePreferences({ weeklyGoalMinutes: value });
      goalTouched.current = false;
      setGoalNote({ text: t('dash.goalSaved'), error: false });
      load();
    } catch {
      setGoalNote({ text: t('dash.goalError'), error: true });
    }
  };

  if (error && !data) return <Screen><EmptyState title={t('dash.loadError')} action={<Button title={t('common.retry')} onPress={load} />} /></Screen>;
  if (!data) return <Screen><Loading /></Screen>;

  const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' });
  const weekday = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, { weekday: 'short' }).replace('.', '');
  const typeLabel = (type: string) => t(`quiz.types.${type}`);
  const subject = data.subjects.find((s) => s.notebookId === subjectId);
  const { study } = data;
  const left = Math.max(0, study.goalMinutes - study.totalMinutes);
  const pct = study.goalMinutes ? Math.min(100, Math.round((study.totalMinutes / study.goalMinutes) * 100)) : 0;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ paddingTop: 8, gap: 4 }}>
        <T variant="title">{t('dash.title')}</T>
        <T variant="muted">{t('dash.subtitle')}</T>
      </View>

      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {RANGES.map((r) => <Chip key={r} label={t('dash.lastDays', { count: r })} selected={range === r} onPress={() => setRange(r)} />)}
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip label={t('dash.allSubjects')} selected={!notebookId} onPress={() => { setNotebookId(''); setSubjectId(null); }} />
        {notebooks.map((n) => <Chip key={n._id} label={n.title} selected={notebookId === n._id} onPress={() => { setNotebookId(n._id); setSubjectId(null); }} />)}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label={t('dash.kpiAverage')} value={data.kpis.average === null ? '–' : `${data.kpis.average}%`} />
        <Stat label={t('dash.kpiAttempts')} value={data.kpis.attempts} />
        <Stat label={t('dash.kpiStreak')} value={t('dash.days', { count: data.kpis.streakDays })} />
        <Stat label={t('dash.kpiTasks')} value={`${data.kpis.tasksSubmitted}/${data.kpis.tasksSubmitted + data.kpis.tasksPending}`} />
      </View>

      <StudyTimer onSaved={load} />

      <Card style={{ gap: 12 }}>
        <T variant="heading">{t('dash.weekTitle')}</T>
        <T variant="muted">{t('dash.weekDesc', { total: fmtMinutes(study.totalMinutes) })}</T>
        <BarChartV
          data={study.days.map((d) => ({ key: d.date, label: weekday(d.date), value: d.minutes }))} unit="" height={120}
          summary={`${t('dash.weekTitle')}: ${study.days.map((d) => `${weekday(d.date)} ${d.minutes} min`).join(', ')}`}
        />
        {study.goalMinutes > 0 ? (
          <View style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <T variant="small" style={{ flex: 1 }}>{t('dash.goalProgress', { done: fmtMinutes(study.totalMinutes), goal: fmtMinutes(study.goalMinutes) })}</T>
              <T variant="small" accessibilityLiveRegion="polite">{left > 0 ? t('dash.goalLeft', { left: fmtMinutes(left) }) : t('dash.goalDone')}</T>
            </Row>
            <View accessibilityRole="progressbar" accessibilityLabel={t('dash.goalLabel')} accessibilityValue={{ min: 0, max: study.goalMinutes, now: Math.min(study.totalMinutes, study.goalMinutes) }} style={{ height: 12, borderRadius: 999, backgroundColor: colors.secondary, overflow: 'hidden' }}>
              <View style={{ height: 12, width: `${pct}%`, borderRadius: 999, backgroundColor: colors.primary }} />
            </View>
          </View>
        ) : <T variant="small">{t('dash.goalNone')}</T>}
        <Field label={t('dash.goalLabel')} value={goal} onChangeText={(v) => { goalTouched.current = true; setGoal(v.replace(/[^0-9]/g, '')); }} keyboardType="number-pad" maxLength={4} placeholder="300" />
        <Button title={t('dash.goalSave')} variant="outline" onPress={saveGoal} />
        {goalNote ? <T variant="small" color={goalNote.error ? colors.destructive : colors.primary} accessibilityLiveRegion="polite">{goalNote.text}</T> : null}
      </Card>

      <Card style={{ gap: 12 }}>
        <T variant="heading">{t('dash.timelineTitle')}</T>
        {data.timeline.length === 0 ? <T variant="muted">{t('dash.noQuizzes')}</T> : (
          <LineChart
            data={data.timeline.map((d) => ({ label: dateLabel(d.date), value: d.average }))}
            summary={`${t('dash.timelineTitle')}: ${data.timeline.map((d) => `${dateLabel(d.date)} ${d.average}%`).join(', ')}`}
          />
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <T variant="heading">{t('dash.subjectsTitle')}</T>
        {data.subjects.length === 0 ? <T variant="muted">{t('dash.noQuizzes')}</T> : (
          <>
            <T variant="small">{t('dash.subjectsDesc')}</T>
            <BarChartV
              data={data.subjects.map((s) => ({ key: s.notebookId, label: s.title, value: s.average }))} max={100} unit="%" height={120} selected={subjectId}
              onSelect={(k) => setSubjectId(subjectId === k ? null : k)}
              summary={`${t('dash.subjectsTitle')}: ${data.subjects.map((s) => `${s.title} ${s.average}%`).join(', ')}`}
            />
            {subject && (
              <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                <T variant="label">{t('dash.lessonsOf', { title: subject.title })}</T>
                {subject.lessons.map((l) => (
                  <Row key={l.lessonId} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <Pressable onPress={() => router.push(`/quiz/${l.lessonId}`)} accessibilityRole="link" accessibilityLabel={l.title} style={{ flex: 1 }}>
                      <T variant="body" color={colors.primary}>{l.title}</T>
                    </Pressable>
                    <Badge variant={l.average >= 70 ? 'success' : l.average >= 50 ? 'warning' : 'destructive'}>{l.average}%</Badge>
                  </Row>
                ))}
              </View>
            )}
          </>
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <T variant="heading">{t('dash.typesTitle')}</T>
        {data.byType.every((x) => x.accuracy === null) ? <T variant="muted">{t('dash.noQuizzes')}</T> : (
          <BarChartH
            data={data.byType.map((x, i) => ({ label: typeLabel(x.type), value: x.accuracy ?? -1, color: colors.charts[i % colors.charts.length] }))}
            summary={`${t('dash.typesTitle')}: ${data.byType.filter((x) => x.accuracy !== null).map((x) => `${typeLabel(x.type)} ${x.accuracy}%`).join(', ')}`}
          />
        )}
      </Card>

      <KolbCard kolb={data.kolb} onChanged={load} />

      <Card style={{ gap: 12 }}>
        <T variant="heading">{t('bloom.title')}</T>
        <T variant="small">{t('bloom.desc')}</T>
        {data.byBloom.every((b) => b.accuracy === null) ? <T variant="muted">{t('dash.noQuizzes')}</T> : (
          <BarChartH
            data={data.byBloom.map((b, i) => ({ label: t(`bloom.levels.${b.level}`), value: b.accuracy ?? -1, color: colors.charts[i % colors.charts.length] }))}
            summary={`${t('bloom.title')}: ${data.byBloom.filter((b) => b.accuracy !== null).map((b) => `${t(`bloom.levels.${b.level}`)} ${b.accuracy}%`).join(', ')}`}
          />
        )}
      </Card>

      {data.byCompetency.length > 0 && (
        <Card style={{ gap: 10 }}>
          <T variant="heading">{t('competencies.studentTitle')}</T>
          <T variant="small">{t('competencies.studentDesc')}</T>
          {data.byCompetency.map((c) => (
            <Row key={c.name} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <T variant="body" style={{ flex: 1 }}>{c.name}</T>
              <Badge variant={c.accuracy >= 70 ? 'success' : c.accuracy >= 50 ? 'warning' : 'destructive'}>{c.accuracy}%</Badge>
            </Row>
          ))}
        </Card>
      )}

      <Card style={{ gap: 10 }}>
        <T variant="heading">{t('dash.weakTitle')}</T>
        <T variant="small">{t('dash.weakDesc')}</T>
        {data.weakTopics.length === 0 ? <T variant="muted">{t('dash.weakEmpty')}</T> : data.weakTopics.map((w) => (
          <View key={`${w.lessonId}:${w.topic}`} style={{ gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 }}>
            <T variant="label">{w.topic}</T>
            <T variant="small">{w.notebook} · {w.lesson}</T>
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge variant="destructive">{t('dash.errorRate', { rate: Math.round(w.errorRate) })}</Badge>
              <Button title={t('dash.review')} variant="outline" onPress={() => router.push(`/quiz/${w.lessonId}`)} accessibilityLabel={t('dash.reinforce', { topic: w.topic })} />
            </Row>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
