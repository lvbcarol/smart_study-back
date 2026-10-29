// src/pages/AgendaPage.tsx — agenda do aluno: tarefas do professor + tarefas e lembretes próprios
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, ListTodo, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { AgendaEntry } from '../types/study';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';
import { SelectField } from '../components/ds/SelectField';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { PageHeader } from '../components/ds/PageParts';
import { cn } from '@/lib/utils';

type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'nodate' | 'done';
const ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'nodate', 'done'];

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

const AgendaPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<AgendaEntry[] | null>(null);
  const [kind, setKind] = useState<'task' | 'reminder'>('task');
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<{ items: AgendaEntry[] }>('/agenda').then((r) => setItems(r.data.items)).catch(() => { setItems([]); toast.error(t('agenda.loadError')); });
  }, [t]);
  useEffect(load, [load]);

  const groups = useMemo(() => {
    const now = new Date();
    const map = new Map<Bucket, AgendaEntry[]>();
    for (const item of items ?? []) {
      const b = bucketOf(item, now);
      map.set(b, [...(map.get(b) ?? []), item]);
    }
    return map;
  }, [items]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === 'reminder' && !dueAt) return toast.error(t('agenda.reminderNeedsDate'));
    setSaving(true);
    try {
      await api.post('/agenda', { kind, title, ...(notes.trim() ? { notes } : {}), ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}) });
      setTitle(''); setDueAt(''); setNotes('');
      toast.success(t('agenda.created'));
      load();
    } catch {
      toast.error(t('agenda.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: AgendaEntry) => {
    try {
      await api.put(`/agenda/${item.id}`, { done: !item.done });
      load();
    } catch {
      toast.error(t('agenda.saveError'));
    }
  };

  const remove = async (item: AgendaEntry) => {
    try {
      await api.delete(`/agenda/${item.id}`);
      toast.success(t('agenda.deleted'));
      load();
    } catch {
      toast.error(t('agenda.saveError'));
    }
  };

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : t('agenda.noDate'));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t('agenda.title')} subtitle={t('agenda.subtitle')} />

      <form onSubmit={add} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-xl font-bold">{t('agenda.add')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('agenda.kindLabel')} value={kind} onChange={(e) => setKind(e.target.value as 'task' | 'reminder')}>
            <option value="task">{t('agenda.kindTask')}</option>
            <option value="reminder">{t('agenda.kindReminder')}</option>
          </SelectField>
          <Field label={t(kind === 'reminder' ? 'agenda.dueRequired' : 'agenda.dueLabel')} type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required={kind === 'reminder'} />
        </div>
        <Field label={t('agenda.titleLabel')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoComplete="off" placeholder={t(kind === 'reminder' ? 'agenda.reminderPlaceholder' : 'agenda.taskPlaceholder')} />
        <Field label={t('agenda.notesLabel')} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} autoComplete="off" />
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!title.trim()}><Plus className="h-4 w-4" aria-hidden="true" /> {t('agenda.addBtn')}</Button>
        </div>
      </form>

      {items === null ? (
        <div role="status" aria-label={t('common.loading')} className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState title={t('agenda.emptyTitle')} description={t('agenda.emptyDesc')} />
      ) : (
        ORDER.filter((b) => groups.has(b)).map((b) => (
          <section key={b} aria-labelledby={`agenda-${b}`} className="space-y-3">
            <h2 id={`agenda-${b}`} className={cn('font-display text-lg font-bold', b === 'overdue' && 'text-destructive')}>
              {t(`agenda.sections.${b}`)} <span className="text-sm font-medium text-muted-foreground">({groups.get(b)!.length})</span>
            </h2>
            <ul className="space-y-2">
              {groups.get(b)!.map((item) => {
                const personal = item.source === 'personal';
                return (
                  <li key={item.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
                    {personal ? (
                      <button
                        type="button" onClick={() => toggle(item)} aria-pressed={item.done}
                        aria-label={t(item.done ? 'agenda.markUndone' : 'agenda.markDone', { title: item.title })}
                        className={cn(
                          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
                        )}
                      >
                        {item.done && <Check className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    ) : (
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-primary" aria-hidden="true"><ListTodo className="h-5 w-5" /></span>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className={cn('flex flex-wrap items-center gap-2 font-semibold', item.done && 'text-muted-foreground line-through')}>
                        {item.kind === 'reminder' && <Bell className="h-4 w-4 text-warning" aria-label={t('agenda.kindReminder')} />}
                        {item.source === 'teacher' ? <Link to={`/tasks/${item.taskId}`} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.title}</Link> : item.title}
                        {item.source === 'teacher' && <Badge variant="primary">{t('agenda.fromTeacher')}</Badge>}
                        {item.source === 'teacher' && item.status && <Badge variant={item.status === 'submitted' ? 'success' : item.overdue ? 'destructive' : 'neutral'}>{item.overdue ? t('tasks.overdue') : t(`tasks.status.${item.status}`)}</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">{when(item.dueAt)}{item.notebookTitle ? ` · ${[item.notebookTitle, item.lessonTitle].filter(Boolean).join(' · ')}` : ''}</p>
                      {item.notes && <p className="text-sm">{item.notes}</p>}
                    </div>
                    {personal && (
                      <Button variant="ghost" size="sm" onClick={() => remove(item)} aria-label={t('agenda.delete', { title: item.title })}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
};

export default AgendaPage;
