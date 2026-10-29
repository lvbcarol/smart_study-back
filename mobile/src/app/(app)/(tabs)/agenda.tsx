// Agenda do aluno: tarefas do professor + tarefas e lembretes próprios
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import { useRemote } from '@/hooks/useRemote';
import type { AgendaEntry } from '@/types';
import { Badge, Button, Card, Chip, EmptyState, Field, Loading, Row, Screen, T } from '@/ui';

type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'nodate' | 'done';
const ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'nodate', 'done'];
const DUE_CHOICES = [null, 0, 1, 3, 7] as const; // null = sem data; números = dias a partir de hoje

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function bucketOf(item: AgendaEntry, now: Date): Bucket {
  if (item.done) return 'done';
  if (!item.dueAt) return 'nodate';
  const days = Math.round((startOfDay(new Date(item.dueAt)).getTime() - startOfDay(now).getTime()) / 86400_000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return days <= 7 ? 'week' : 'later';
}

/** "18:30" -> [18, 30]; inválido cai em 18:00 */
function parseTime(text: string): [number, number] {
  const m = /^(\d{1,2})[:h.]?(\d{2})?$/.exec(text.trim());
  const h = m ? Number(m[1]) : NaN;
  const min = m && m[2] ? Number(m[2]) : 0;
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 ? [h, min] : [18, 0];
}

export default function Agenda() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { data, refreshing, refresh, reload } = useRemote(() => api.get<{ items: AgendaEntry[] }>('/agenda').then((r) => r.data.items));

  const [kind, setKind] = useState<'task' | 'reminder'>('task');
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<number | null>(null);
  const [time, setTime] = useState('18:00');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const groups = useMemo(() => {
    const now = new Date();
    const map = new Map<Bucket, AgendaEntry[]>();
    for (const item of data ?? []) {
      const b = bucketOf(item, now);
      map.set(b, [...(map.get(b) ?? []), item]);
    }
    return map;
  }, [data]);

  if (!data) return <Screen><Loading /></Screen>;

  const add = async () => {
    if (!title.trim()) return;
    if (kind === 'reminder' && days === null) { setNote({ text: t('agenda.reminderNeedsDate'), error: true }); return; }
    setSaving(true); setNote(null);
    try {
      let dueAt: string | undefined;
      if (days !== null) {
        const [h, m] = parseTime(time);
        const d = startOfDay(new Date());
        d.setDate(d.getDate() + days);
        d.setHours(h, m, 0, 0);
        dueAt = d.toISOString();
      }
      await api.post('/agenda', { kind, title: title.trim(), ...(dueAt ? { dueAt } : {}) });
      setTitle(''); setNote({ text: t('agenda.created'), error: false });
      reload();
    } catch {
      setNote({ text: t('agenda.saveError'), error: true });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: AgendaEntry) => {
    try { await api.put(`/agenda/${item.id}`, { done: !item.done }); reload(); } catch { setNote({ text: t('agenda.saveError'), error: true }); }
  };
  const remove = async (item: AgendaEntry) => {
    try { await api.delete(`/agenda/${item.id}`); reload(); } catch { setNote({ text: t('agenda.saveError'), error: true }); }
  };

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : t('agenda.noDate'));
  const dueLabel = (d: number | null) => (d === null ? t('agenda.noDate') : d === 0 ? t('agenda.sections.today') : d === 1 ? t('agenda.sections.tomorrow') : t('agenda.inDays', { count: d }));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ paddingTop: 8, gap: 4 }}>
        <T variant="title">{t('agenda.title')}</T>
        <T variant="muted">{t('agenda.subtitle')}</T>
      </View>

      <Card style={{ gap: 12 }}>
        <T variant="heading">{t('agenda.add')}</T>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('agenda.kindTask')} selected={kind === 'task'} onPress={() => setKind('task')} />
          <Chip label={t('agenda.kindReminder')} selected={kind === 'reminder'} onPress={() => setKind('reminder')} />
        </View>
        <Field label={t('agenda.titleLabel')} value={title} onChangeText={setTitle} maxLength={120} autoCapitalize="sentences" placeholder={t(kind === 'reminder' ? 'agenda.reminderPlaceholder' : 'agenda.taskPlaceholder')} />
        <T variant="label">{t('agenda.dueLabel')}</T>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DUE_CHOICES.map((d) => <Chip key={String(d)} label={dueLabel(d)} selected={days === d} onPress={() => setDays(d)} />)}
        </View>
        {days !== null && <Field label={t('agenda.timeLabel')} value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="18:00" />}
        {note ? <T variant="small" color={note.error ? colors.destructive : colors.primary} accessibilityLiveRegion="polite">{note.text}</T> : null}
        <Button title={t('agenda.addBtn')} onPress={add} loading={saving} disabled={!title.trim()} />
      </Card>

      {data.length === 0 ? (
        <EmptyState title={t('agenda.emptyTitle')} description={t('agenda.emptyDesc')} />
      ) : (
        ORDER.filter((b) => groups.has(b)).map((b) => (
          <View key={b} style={{ gap: 10 }}>
            <T variant="heading" color={b === 'overdue' ? colors.destructive : undefined}>{t(`agenda.sections.${b}`)} ({groups.get(b)!.length})</T>
            {groups.get(b)!.map((item) => {
              const personal = item.source === 'personal';
              const body = (
                <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  {personal ? (
                    <Pressable
                      onPress={() => toggle(item)} accessibilityRole="checkbox" accessibilityState={{ checked: item.done }}
                      accessibilityLabel={t(item.done ? 'agenda.markUndone' : 'agenda.markDone', { title: item.title })} hitSlop={8}
                      style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: item.done ? colors.primary : colors.border, backgroundColor: item.done ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {item.done && <Ionicons name="checkmark" size={18} color={colors.primaryFg} />}
                    </Pressable>
                  ) : (
                    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="school-outline" size={22} color={colors.primary} /></View>
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <T variant="label" style={{ textDecorationLine: item.done ? 'line-through' : 'none' }}>{item.kind === 'reminder' ? '🔔 ' : ''}{item.title}</T>
                    <T variant="small" color={item.overdue ? colors.destructive : undefined}>{when(item.dueAt)}{item.notebookTitle ? ` · ${[item.notebookTitle, item.lessonTitle].filter(Boolean).join(' · ')}` : ''}</T>
                    {item.notes ? <T variant="small">{item.notes}</T> : null}
                    {!personal && (
                      <Row>
                        <Badge variant="primary">{t('agenda.fromTeacher')}</Badge>
                        {item.status && <Badge variant={item.status === 'submitted' ? 'success' : item.overdue ? 'destructive' : 'neutral'}>{item.overdue ? t('tasks.overdue') : t(`tasks.status.${item.status}`)}</Badge>}
                      </Row>
                    )}
                  </View>
                  {personal && (
                    <Pressable onPress={() => remove(item)} accessibilityRole="button" accessibilityLabel={t('agenda.delete', { title: item.title })} hitSlop={8}>
                      <Ionicons name="trash-outline" size={22} color={colors.mutedFg} />
                    </Pressable>
                  )}
                </Row>
              );
              return personal
                ? <Card key={item.id} style={{ padding: 14 }}>{body}</Card>
                : <Card key={item.id} onPress={() => router.push(`/task/${item.taskId}`)} accessibilityLabel={item.title} style={{ padding: 14 }}>{body}</Card>;
            })}
          </View>
        ))
      )}
    </Screen>
  );
}
