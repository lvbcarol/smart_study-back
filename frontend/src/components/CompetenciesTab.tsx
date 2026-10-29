// src/components/CompetenciesTab.tsx — o professor define as competências de uma matéria (usadas nas perguntas das tarefas)
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import axios from 'axios';
import api from '../services/api';
import { Button } from './ds/Button';
import { Field } from './ds/Field';
import { EmptyState } from './ds/Misc';

interface Competency { _id: string; name: string }

const CompetenciesTab: React.FC<{ notebookId: string; canEdit: boolean }> = ({ notebookId, canEdit }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<Competency[] | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<Competency[]>(`/notebooks/${notebookId}/competencies`).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [notebookId]);
  useEffect(load, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/notebooks/${notebookId}/competencies`, { name });
      setName('');
      toast.success(t('competencies.added'));
      load();
    } catch (err) {
      toast.error(axios.isAxiosError(err) && err.response?.status === 409 ? t('competencies.exists') : t('competencies.error'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Competency) => {
    try {
      await api.delete(`/notebooks/${notebookId}/competencies/${c._id}`);
      toast.success(t('competencies.removed'));
      load();
    } catch {
      toast.error(t('competencies.error'));
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('competencies.desc')}</p>
      {canEdit && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Field label={t('competencies.nameLabel')} placeholder={t('competencies.placeholder')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" />
          </div>
          <Button type="submit" loading={saving} disabled={!name.trim()}><Plus className="h-4 w-4" aria-hidden="true" /> {t('competencies.add')}</Button>
        </form>
      )}
      {items && items.length === 0 ? <EmptyState title={t('competencies.empty')} /> : (
        <ul className="flex flex-wrap gap-2" aria-label={t('competencies.tab')}>
          {items?.map((c) => (
            <li key={c._id} className="flex items-center gap-1 rounded-full bg-accent py-1 pl-4 pr-1 text-sm font-semibold text-accent-foreground">
              {c.name}
              {canEdit && (
                <button type="button" onClick={() => remove(c)} aria-label={t('competencies.remove', { name: c.name })} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CompetenciesTab;
