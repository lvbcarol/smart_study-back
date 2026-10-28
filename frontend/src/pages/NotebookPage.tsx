// src/pages/NotebookPage.tsx — um caderno (matéria): aulas e materiais de apoio
import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Notebook } from '../types';
import { TurmaSummary } from '../types/classes';
import MaterialsTab from '../components/MaterialsTab';
import { SelectField } from '../components/ds/SelectField';
import { Badge, EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ds/Misc';
import { BackLink } from '../components/ds/PageParts';

const NotebookPage: React.FC = () => {
  const { t } = useTranslation();
  const { notebookId } = useParams<{ notebookId: string }>();
  const [params, setParams] = useSearchParams();
  const [notebook, setNotebook] = useState<Notebook | null | undefined>(undefined);
  const [turmas, setTurmas] = useState<TurmaSummary[]>([]);

  useEffect(() => {
    api.get<Notebook[]>('/notebooks')
      .then((r) => setNotebook(r.data.find((n) => n._id === notebookId) ?? null))
      .catch(() => setNotebook(null));
  }, [notebookId]);

  const canEdit = notebook ? !notebook.readOnly : false;

  useEffect(() => {
    if (canEdit) api.get<TurmaSummary[]>('/turmas').then((r) => setTurmas(r.data)).catch(() => setTurmas([]));
  }, [canEdit]);

  const changeTurma = async (value: string) => {
    if (!notebook) return;
    try {
      await api.put(`/notebooks/${notebook._id}`, { turma: value || null });
      const name = turmas.find((x) => x._id === value)?.name;
      setNotebook({ ...notebook, turma: value || undefined, turmaName: name });
      toast.success(t('notebookPage.linked'));
    } catch {
      toast.error(t('notebookPage.linkError'));
    }
  };

  if (notebook === undefined) return <div role="status" aria-label={t('common.loading')} className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  if (notebook === null) {
    return (
      <div className="space-y-6">
        <BackLink to="/my-notebooks">{t('notebookPage.back')}</BackLink>
        <EmptyState title={t('notebookPage.notFound')} />
      </div>
    );
  }

  const tab = params.get('tab') === 'materials' ? 'materials' : 'lessons';

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <BackLink to="/my-notebooks">{t('notebookPage.back')}</BackLink>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{notebook.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {notebook.turmaName && <Badge variant="primary">{notebook.turmaName}</Badge>}
          {notebook.readOnly && notebook.ownerName && (
            <Badge><GraduationCap className="h-3 w-3" aria-hidden="true" /> {t('notebookPage.teacher', { name: notebook.ownerName })}</Badge>
          )}
        </div>
      </div>

      {canEdit && turmas.length > 0 && (
        <div className="max-w-sm">
          <SelectField label={t('notebookPage.turma')} hint={t('notebookPage.turmaDesc')} value={notebook.turma ?? ''} onChange={(e) => changeTurma(e.target.value)}>
            <option value="">{t('notebookPage.noTurma')}</option>
            {turmas.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
          </SelectField>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setParams(v === 'materials' ? { tab: 'materials' } : {})}>
        <TabsList aria-label={t('notebookPage.tabsLabel')}>
          <TabsTrigger value="lessons">{t('notebookPage.tabLessons')} ({notebook.lessons.length})</TabsTrigger>
          <TabsTrigger value="materials">{t('notebookPage.tabMaterials')}</TabsTrigger>
        </TabsList>

        <TabsContent value="lessons">
          {notebook.lessons.length === 0 ? (
            <EmptyState title={t('notebookPage.noLessons')} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {notebook.lessons.map((l) => (
                <li key={l._id}>
                  <Link to={`/subjects/${l._id}`} aria-label={t('myNotebooks.openLesson', { title: l.title })} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted">
                    <span className="font-semibold">{l.title}</span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="materials">
          <MaterialsTab notebookId={notebook._id} lessons={notebook.lessons} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotebookPage;
