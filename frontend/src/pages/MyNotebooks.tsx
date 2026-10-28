// src/pages/MyNotebooks.tsx
import React, { useEffect, useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Notebook } from '../types';
import NotebookCard from '../components/NotebookCard';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';
import { Modal } from '../components/ds/Modal';
import { EmptyState, Skeleton } from '../components/ds/Misc';
import { PageHeader } from '../components/ds/PageParts';

const MyNotebooks: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<Notebook[]>('/notebooks')
      .then((r) => setNotebooks(r.data))
      .catch(() => {
        toast.error(t('myNotebooks.loadError'));
        setNotebooks([]);
      });
  }, [t]);

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookTitle.trim() || !notebooks) return;
    setCreating(true);
    try {
      const response = await api.post<Notebook>('/notebooks', { title: newNotebookTitle });
      setNotebooks([...notebooks, { ...response.data, lessons: response.data.lessons ?? [] }]);
      setNewNotebookTitle('');
      setIsModalOpen(false);
      toast.success(t('myNotebooks.createSuccess'));
    } catch {
      toast.error(t('myNotebooks.createError'));
    } finally {
      setCreating(false);
    }
  };

  const updateNotebook = (updated: Notebook) =>
    setNotebooks((list) => list?.map((nb) => (nb._id === updated._id ? updated : nb)) ?? null);
  const removeNotebook = (id: string) => setNotebooks((list) => list?.filter((nb) => nb._id !== id) ?? null);

  const newButton = (
    <Button onClick={() => setIsModalOpen(true)} title={t('myNotebooks.tooltipNewNotebook')}>
      <Plus className="h-5 w-5" aria-hidden="true" /> {t('myNotebooks.newNotebook')}
    </Button>
  );

  return (
    <>
      <PageHeader
        title={isTeacher ? t('myNotebooks.titleTeacher') : t('myNotebooks.title')}
        subtitle={isTeacher ? t('myNotebooks.subtitleTeacher') : t('myNotebooks.subtitleShort')}
        actions={newButton}
      />

      {notebooks === null ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label={t('common.loading')}>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : notebooks.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title={t('myNotebooks.emptyTitle')}
          description={t('myNotebooks.emptyDesc')}
          action={newButton}
        />
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          {notebooks.map((notebook, index) => (
            <NotebookCard key={notebook._id} notebook={notebook} onDelete={removeNotebook} onUpdate={updateNotebook} index={index} />
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen} onOpenChange={setIsModalOpen}
        title={t('myNotebooks.modalTitle')} closeLabel={t('common.close')}
      >
        <form onSubmit={handleCreateNotebook} className="space-y-5">
          <Field
            label={t('myNotebooks.notebookTitleLabel')} placeholder={t('myNotebooks.modalPlaceholder')}
            value={newNotebookTitle} onChange={(e) => setNewNotebookTitle(e.target.value)} autoFocus required
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>{t('myNotebooks.cancel')}</Button>
            <Button type="submit" loading={creating}>{t('myNotebooks.create')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default MyNotebooks;
