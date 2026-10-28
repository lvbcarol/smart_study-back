// src/pages/TaskEditorPage.tsx — o professor gera perguntas com IA, edita tudo e publica
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Notebook } from '../types';
import { QUESTION_TYPES, QuestionType } from '../types/quiz';
import { EditableQuestion, TeacherTaskDetail } from '../types/tasks';
import { blankQuestion, cleanQuestion, QuestionEditor } from '../components/quiz/QuestionEditor';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';
import { SelectField } from '../components/ds/SelectField';
import { EmptyState, Skeleton, Switch } from '../components/ds/Misc';
import { BackLink, PageHeader } from '../components/ds/PageParts';
import { cn } from '@/lib/utils';

/** ISO -> valor de <input type="datetime-local"> (hora local) */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TaskEditorPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editing = !!taskId;

  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  // vindo da página da aula (?notebook=&lesson=), já abre com a matéria e a aula escolhidas
  const [notebookId, setNotebookId] = useState(() => (taskId ? '' : searchParams.get('notebook') ?? ''));
  const [lessonId, setLessonId] = useState(() => (taskId ? '' : searchParams.get('lesson') ?? ''));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [published, setPublished] = useState(false);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(editing);

  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(8);
  const [types, setTypes] = useState<QuestionType[]>([...QUESTION_TYPES]);
  const [generating, setGenerating] = useState(false);
  const [materialsUsed, setMaterialsUsed] = useState<number | null>(null);
  const [newType, setNewType] = useState<QuestionType>('multiple_choice');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Notebook[]>('/notebooks')
      .then((r) => setNotebooks(r.data.filter((n) => !n.readOnly && n.turma)))
      .catch(() => setNotebooks([]));
  }, []);

  useEffect(() => {
    if (!taskId) return;
    api.get<TeacherTaskDetail>(`/tasks/${taskId}`).then((r) => {
      const d = r.data;
      setNotebookId(d.notebookId); setLessonId(d.lessonId); setTitle(d.title); setDescription(d.description ?? '');
      setDueDate(toLocalInput(d.dueDate)); setPublished(d.published); setQuestions(d.questions); setLocked(d.submitted > 0);
    }).catch(() => navigate('/tasks', { replace: true })).finally(() => setLoading(false));
  }, [taskId, navigate]);

  const lessons = useMemo(() => notebooks?.find((n) => n._id === notebookId)?.lessons ?? [], [notebooks, notebookId]);

  const toggleType = (type: QuestionType) =>
    setTypes((cur) => (cur.includes(type) ? (cur.length > 1 ? cur.filter((x) => x !== type) : cur) : [...cur, type]));

  const generate = async () => {
    if (!notebookId || !lessonId) return toast.error(t('tasks.editor.pickSubjectFirst'));
    setGenerating(true);
    try {
      const { data } = await api.post<{ questions: EditableQuestion[]; materialsUsed: number }>('/tasks/generate', {
        notebookId, lessonId, topic, language: i18n.language, count, types,
      });
      setQuestions(data.questions);
      setMaterialsUsed(data.materialsUsed);
      if (!title.trim()) setTitle(topic);
      toast.success(t('tasks.editor.generated'));
    } catch {
      toast.error(t('tasks.editor.generateError'));
    } finally {
      setGenerating(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      title, description: description || undefined, dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      published, ...(locked ? {} : { questions: questions.map(cleanQuestion) }),
    };
    try {
      if (editing) await api.put(`/tasks/${taskId}`, body);
      else await api.post('/tasks', { ...body, notebookId, lessonId });
      toast.success(t('tasks.editor.saved'));
      navigate('/tasks');
    } catch {
      toast.error(t('tasks.editor.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || notebooks === null) return <div role="status" aria-label={t('common.loading')} className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-80" /></div>;
  if (!editing && notebooks.length === 0) {
    return (
      <div className="space-y-6">
        <BackLink to="/tasks">{t('tasks.back')}</BackLink>
        <EmptyState title={t('tasks.editor.noSubjects')} />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-8 pb-24">
      <div>
        <BackLink to="/tasks">{t('tasks.back')}</BackLink>
        <PageHeader className="mt-3" title={editing ? t('tasks.editor.editTitle') : t('tasks.editor.newTitle')} />
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('tasks.editor.subject')} value={notebookId} disabled={editing} required onChange={(e) => { setNotebookId(e.target.value); setLessonId(''); }}>
            <option value="" disabled>{t('tasks.editor.subjectPlaceholder')}</option>
            {notebooks.map((n) => <option key={n._id} value={n._id}>{n.title}{n.turmaName ? ` · ${n.turmaName}` : ''}</option>)}
          </SelectField>
          <SelectField label={t('tasks.editor.lesson')} value={lessonId} disabled={editing || !notebookId} required onChange={(e) => setLessonId(e.target.value)}>
            <option value="" disabled>{t('tasks.editor.lessonPlaceholder')}</option>
            {lessons.map((l) => <option key={l._id} value={l._id}>{l.title}</option>)}
          </SelectField>
        </div>
        <Field label={t('tasks.editor.titleLabel')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
        <div className="space-y-1.5">
          <label htmlFor="task-desc" className="block text-sm font-medium">{t('tasks.editor.descLabel')}</label>
          <textarea id="task-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000}
            className="w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <Field label={t('tasks.editor.dueLabel')} type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Switch label={t('tasks.editor.publishLabel')} description={t('tasks.editor.publishHint')} checked={published} onCheckedChange={setPublished} />
      </section>

      {locked ? (
        <p role="status" className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">{t('tasks.editor.locked')}</p>
      ) : (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft" aria-labelledby="gen-title">
          <h2 id="gen-title" className="flex items-center gap-2 font-display text-xl font-bold"><Sparkles className="h-5 w-5 text-primary" aria-hidden="true" /> {t('tasks.editor.generateTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label={t('tasks.editor.topicLabel')} placeholder={t('tasks.editor.topicPlaceholder')} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} />
            <Field label={t('tasks.editor.countLabel')} type="number" min={3} max={15} value={count} onChange={(e) => setCount(Math.min(15, Math.max(3, Number(e.target.value) || 8)))} />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('tasks.editor.typesLabel')}</legend>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPES.map((type) => (
                <label key={type} className={cn('flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-ring', types.includes(type) ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground')}>
                  <input type="checkbox" className="sr-only" checked={types.includes(type)} onChange={() => toggleType(type)} />
                  {t(`quizzPage.types.${type}`)}
                </label>
              ))}
            </div>
          </fieldset>
          {questions.length > 0 && <p className="text-sm text-muted-foreground">{t('tasks.editor.replaceWarning')}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={generate} loading={generating} disabled={!topic.trim() || !lessonId}>
              <Sparkles className="h-4 w-4" aria-hidden="true" /> {generating ? t('tasks.editor.generating') : t('tasks.editor.generate')}
            </Button>
            {materialsUsed !== null && materialsUsed > 0 && <p className="text-sm text-muted-foreground" role="status">{t('tasks.editor.usingMaterials', { count: materialsUsed })}</p>}
          </div>
        </section>
      )}

      <section aria-labelledby="questions-title" className="space-y-4">
        <h2 id="questions-title" className="text-2xl font-extrabold tracking-tight">{t('tasks.editor.questionsTitle')} ({questions.length})</h2>
        {questions.length === 0 ? (
          <EmptyState title={t('tasks.editor.noQuestions')} />
        ) : (
          <ol className="space-y-4">
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.id ?? i} question={q} index={i} locked={locked}
                onChange={(next) => setQuestions((cur) => cur.map((x, j) => (j === i ? next : x)))}
                onRemove={() => setQuestions((cur) => cur.filter((_, j) => j !== i))}
              />
            ))}
          </ol>
        )}
        {!locked && (
          <div className="flex flex-wrap items-end gap-3">
            <SelectField label={t('tasks.editor.addType')} value={newType} onChange={(e) => setNewType(e.target.value as QuestionType)}>
              {QUESTION_TYPES.map((type) => <option key={type} value={type}>{t(`quizzPage.types.${type}`)}</option>)}
            </SelectField>
            <Button type="button" variant="outline" onClick={() => setQuestions((cur) => [...cur, { ...blankQuestion(newType), id: `n${Date.now()}` }])}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('tasks.editor.addQuestion')}
            </Button>
          </div>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate('/tasks')}>{t('common.cancel')}</Button>
          <Button type="submit" loading={saving} disabled={!title.trim() || (!locked && questions.length === 0) || !lessonId}>{t('tasks.editor.save')}</Button>
        </div>
      </div>
    </form>
  );
};

export default TaskEditorPage;
