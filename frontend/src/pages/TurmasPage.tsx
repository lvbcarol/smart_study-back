// src/pages/TurmasPage.tsx — lista de turmas do professor
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { TurmaSummary } from '../types/classes';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';
import { Modal } from '../components/ds/Modal';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { PageHeader } from '../components/ds/PageParts';

const TurmasPage: React.FC = () => {
  const { t } = useTranslation();
  const [turmas, setTurmas] = useState<TurmaSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<TurmaSummary[]>('/turmas')
      .then((r) => setTurmas(r.data))
      .catch(() => { toast.error(t('classes.loadError')); setTurmas([]); });
  }, [t]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post<TurmaSummary>('/turmas', { name });
      setTurmas((list) => [...(list ?? []), data]);
      setName('');
      setOpen(false);
      toast.success(t('classes.createdOk'));
    } catch {
      toast.error(t('classes.createError'));
    } finally {
      setCreating(false);
    }
  };

  const newButton = <Button onClick={() => setOpen(true)}><Plus className="h-5 w-5" aria-hidden="true" /> {t('classes.new')}</Button>;

  return (
    <>
      <PageHeader title={t('classes.title')} subtitle={t('classes.subtitle')} actions={newButton} />

      {turmas === null ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label={t('common.loading')}>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : turmas.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title={t('classes.emptyTitle')} description={t('classes.emptyDesc')} action={newButton} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {turmas.map((turma, i) => (
            <li key={turma._id} className="animate-fade-in-up" style={{ animationDelay: `${i * 70}ms` }}>
              <Link
                to={`/classes/${turma._id}`}
                className="flex h-full items-start justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted"
              >
                <span className="space-y-3">
                  <span className="block font-display text-xl font-bold">{turma.name}</span>
                  <span className="flex flex-wrap gap-2">
                    <Badge variant="primary">{t('classes.students', { count: turma.studentsCount })}</Badge>
                    <Badge>{t('classes.notebooks', { count: turma.notebooksCount })}</Badge>
                    {turma.pendingCount > 0 && <Badge variant="warning">{t('classes.pending', { count: turma.pendingCount })}</Badge>}
                  </span>
                </span>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onOpenChange={setOpen} title={t('classes.new')} closeLabel={t('common.close')}>
        <form onSubmit={create} className="space-y-5">
          <Field label={t('classes.nameLabel')} placeholder={t('classes.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={creating}>{t('classes.create')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default TurmasPage;
