// src/components/MaterialsTab.tsx — materiais de apoio de um caderno (o professor envia; o aluno só vê a lista)
import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Lesson } from '../types';
import { MaterialItem } from '../types/classes';
import { Button } from './ds/Button';
import { Field } from './ds/Field';
import { Modal } from './ds/Modal';
import { SelectField } from './ds/SelectField';
import { Badge, EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from './ds/Misc';

interface MaterialsTabProps {
  notebookId: string;
  lessons: Lesson[];
  canEdit: boolean;
}

const MaterialsTab: React.FC<MaterialsTabProps> = ({ notebookId, lessons, canEdit }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MaterialItem[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [lessonId, setLessonId] = useState('');
  const [sending, setSending] = useState(false);
  const [toDelete, setToDelete] = useState<MaterialItem | null>(null);

  const load = useCallback(() => {
    api.get<MaterialItem[]>(`/notebooks/${notebookId}/materials`)
      .then((r) => setItems(r.data))
      .catch(() => { toast.error(t('materials.loadError')); setItems([]); });
  }, [notebookId, t]);

  useEffect(load, [load]);

  const reset = () => { setTitle(''); setText(''); setFile(null); setLessonId(''); setMode('file'); setAdding(false); };

  const uploadError = (err: any): string => {
    const status = err.response?.status;
    if (status === 413) return t('materials.errTooLarge');
    if (status === 415) return t('materials.errUnsupported');
    if (status === 422) return err.response?.data?.code === 'EMPTY' ? t('materials.errEmpty') : t('materials.errUnreadable');
    return t('materials.uploadError');
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      if (mode === 'file') {
        if (!file) return;
        const form = new FormData();
        form.append('file', file);
        if (title.trim()) form.append('title', title.trim());
        if (lessonId) form.append('lessonId', lessonId);
        await api.post(`/notebooks/${notebookId}/materials/file`, form);
      } else {
        await api.post(`/notebooks/${notebookId}/materials/text`, { title: title.trim(), text, ...(lessonId ? { lessonId } : {}) });
      }
      toast.success(t('materials.added'));
      reset();
      load();
    } catch (err) {
      toast.error(uploadError(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await api.delete(`/notebooks/${notebookId}/materials/${toDelete._id}`);
      toast.success(t('materials.deleted'));
      setToDelete(null);
      load();
    } catch {
      toast.error(t('materials.uploadError'));
    }
  };

  const scopeSelect = (
    <SelectField label={t('materials.scopeLabel')} value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
      <option value="">{t('materials.scopeAll')}</option>
      {lessons.map((l) => <option key={l._id} value={l._id}>{l.title}</option>)}
    </SelectField>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-muted-foreground">{t('materials.desc')}</p>
        {canEdit && !adding && <Button onClick={() => setAdding(true)}><Plus className="h-5 w-5" aria-hidden="true" /> {t('materials.add')}</Button>}
      </div>

      {canEdit && adding && (
        <form onSubmit={send} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'file' | 'text')}>
            <TabsList aria-label={t('materials.tabsLabel')}>
              <TabsTrigger value="file"><FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />{t('materials.tabFile')}</TabsTrigger>
              <TabsTrigger value="text"><Type className="mr-1.5 h-4 w-4" aria-hidden="true" />{t('materials.tabText')}</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="material-file" className="block text-sm font-medium">{t('materials.fileLabel')}</label>
                <input
                  id="material-file" type="file" accept=".pdf,.docx,.txt,.md" required={mode === 'file'}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-xl border border-input bg-card p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:font-semibold file:text-accent-foreground"
                />
              </div>
              <Field label={t('materials.titleOptional')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
            </TabsContent>
            <TabsContent value="text" className="space-y-4">
              <Field label={t('materials.titleLabel')} value={title} onChange={(e) => setTitle(e.target.value)} required={mode === 'text'} maxLength={150} />
              <div className="space-y-1.5">
                <label htmlFor="material-text" className="block text-sm font-medium">{t('materials.textLabel')}</label>
                <textarea
                  id="material-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} required={mode === 'text'}
                  className="w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </TabsContent>
          </Tabs>
          {scopeSelect}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={reset}>{t('common.cancel')}</Button>
            <Button type="submit" loading={sending} disabled={mode === 'file' ? !file : !text.trim() || !title.trim()}>
              {sending ? t('materials.sending') : t('materials.send')}
            </Button>
          </div>
        </form>
      )}

      {items === null ? (
        <div className="space-y-3" role="status" aria-label={t('common.loading')}>{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t('materials.emptyTitle')}
          description={canEdit ? t('materials.emptyDescTeacher') : t('materials.emptyDescStudent')}
        />
      ) : (
        <ul className="space-y-3" aria-label={t('materials.title')}>
          {items.map((m) => (
            <li key={m._id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground" aria-hidden="true">
                {m.kind === 'file' ? <FileText className="h-5 w-5" /> : <Type className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge>{m.kind === 'file' ? t('materials.kindFile') : t('materials.kindText')}</Badge>
                  <Badge variant="primary">{m.lessonTitle ? t('materials.forLesson', { title: m.lessonTitle }) : t('materials.forAll')}</Badge>
                  <span>{t('materials.chars', { count: m.charCount })}</span>
                  {m.truncated && <Badge variant="warning">{t('materials.truncated')}</Badge>}
                </p>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" aria-label={t('materials.delete', { title: m.title })} title={t('materials.delete', { title: m.title })} onClick={() => setToDelete(m)}>
                  <Trash2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}
        title={t('materials.deleteTitle')} description={t('materials.deleteBody')} closeLabel={t('common.close')}
        footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>{t('common.cancel')}</Button><Button variant="destructive" onClick={remove}>{t('myNotebooks.deleteModal.confirm')}</Button></>}
      />
    </div>
  );
};

export default MaterialsTab;
