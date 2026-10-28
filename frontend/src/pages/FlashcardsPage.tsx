// src/pages/FlashcardsPage.tsx — baralhos do aluno e geração de cartões com IA
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Notebook } from '../types';
import { DeckSummary } from '../types/flashcards';
import { Button, buttonVariants } from '../components/ds/Button';
import { Field } from '../components/ds/Field';
import { Modal } from '../components/ds/Modal';
import { SelectField } from '../components/ds/SelectField';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { PageHeader } from '../components/ds/PageParts';

const FlashcardsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [open, setOpen] = useState(false);
  const [lessonId, setLessonId] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [toDelete, setToDelete] = useState<DeckSummary | null>(null);

  const load = () => {
    api.get<DeckSummary[]>('/flashcards/decks').then((r) => setDecks(r.data)).catch(() => { toast.error(t('flashcards.loadError')); setDecks([]); });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get<Notebook[]>('/notebooks').then((r) => setNotebooks(r.data)).catch(() => setNotebooks([]));
  }, []);

  const lessonOptions = useMemo(
    () => notebooks.flatMap((n) => n.lessons.map((l) => ({ id: l._id, label: `${n.title} · ${l.title}` }))),
    [notebooks]
  );

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const { data } = await api.post<{ added: number }>('/flashcards/decks/generate', { lessonId, topic, language: i18n.language, count });
      if (data.added > 0) toast.success(t('flashcards.generated', { count: data.added }));
      else toast(t('flashcards.noneNew'));
      setOpen(false);
      setTopic('');
      load();
    } catch {
      toast.error(t('flashcards.generateError'));
    } finally {
      setGenerating(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await api.delete(`/flashcards/decks/${toDelete._id}`);
      toast.success(t('flashcards.deleted'));
      setToDelete(null);
      load();
    } catch {
      toast.error(t('flashcards.loadError'));
    }
  };

  const newButton = <Button onClick={() => setOpen(true)}><Plus className="h-5 w-5" aria-hidden="true" /> {t('flashcards.generate')}</Button>;

  return (
    <>
      <PageHeader title={t('flashcards.title')} subtitle={t('flashcards.subtitle')} actions={newButton} />

      {decks === null ? (
        <div className="grid gap-4 md:grid-cols-2" role="status" aria-label={t('common.loading')}>{[0, 1].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : decks.length === 0 ? (
        <EmptyState icon={<Layers className="h-6 w-6" />} title={t('flashcards.emptyTitle')} description={t('flashcards.emptyDesc')} action={newButton} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {decks.map((deck, i) => (
            <li key={deck._id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-xl font-bold">{deck.lessonTitle ?? deck.title}</h2>
                  <p className="truncate text-sm text-muted-foreground">{deck.notebookTitle} · {t('flashcards.cards', { count: deck.total })}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label={t('flashcards.deleteDeck', { title: deck.lessonTitle ?? deck.title })} title={t('flashcards.deleteDeck', { title: deck.lessonTitle ?? deck.title })} onClick={() => setToDelete(deck)}>
                  <Trash2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </Button>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {([['due', deck.due, deck.due > 0 ? 'primary' : 'neutral'], ['new', deck.new, 'neutral'], ['learned', deck.learned, 'success']] as const).map(([key, value, variant]) => (
                  <div key={key} className="rounded-xl bg-secondary/60 px-2 py-3">
                    <dd className="font-display text-2xl font-extrabold">{value}</dd>
                    <dt><Badge variant={variant}>{t(`flashcards.${key}`)}</Badge></dt>
                  </div>
                ))}
              </dl>
              {deck.due > 0 ? (
                <Link to={`/flashcards/${deck._id}`} className={buttonVariants({ size: 'lg', fullWidth: true })}>{t('flashcards.study')} ({deck.due})</Link>
              ) : (
                <p className="rounded-xl bg-accent px-4 py-3 text-center text-sm font-medium text-accent-foreground">{t('flashcards.nothingDue')}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onOpenChange={setOpen} title={t('flashcards.generateTitle')} closeLabel={t('common.close')}>
        {lessonOptions.length === 0 ? (
          <p className="text-muted-foreground">{t('flashcards.noLessons')}</p>
        ) : (
          <form onSubmit={generate} className="space-y-5">
            <SelectField label={t('flashcards.lessonLabel')} value={lessonId} required onChange={(e) => setLessonId(e.target.value)}>
              <option value="" disabled>{t('flashcards.lessonPlaceholder')}</option>
              {lessonOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </SelectField>
            <Field label={t('flashcards.topicLabel')} placeholder={t('flashcards.topicPlaceholder')} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} required />
            <Field label={t('flashcards.countLabel')} type="number" min={3} max={20} value={count} onChange={(e) => setCount(Math.min(20, Math.max(3, Number(e.target.value) || 10)))} />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={generating} disabled={!lessonId || !topic.trim()}>
                <Sparkles className="h-4 w-4" aria-hidden="true" /> {generating ? t('flashcards.generating') : t('flashcards.generate')}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={t('flashcards.deleteTitle')} description={t('flashcards.deleteBody')} closeLabel={t('common.close')}
        footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>{t('common.cancel')}</Button><Button variant="destructive" onClick={remove}>{t('myNotebooks.deleteModal.confirm')}</Button></>}
      />
    </>
  );
};

export default FlashcardsPage;
