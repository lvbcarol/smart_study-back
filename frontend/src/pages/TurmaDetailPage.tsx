// src/pages/TurmaDetailPage.tsx — alunos (matrícula por e-mail) e matérias de uma turma
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2, UserMinus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { EnrollResult, TurmaDetail } from '../types/classes';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';
import { Modal } from '../components/ds/Modal';
import { Badge, EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ds/Misc';
import { BackLink } from '../components/ds/PageParts';

const statusVariant = (status: EnrollResult['status']) =>
  status === 'enrolled' ? 'success' : status === 'pending' || status === 'already' || status === 'already_pending' ? 'primary' : 'destructive';

const TurmaDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { turmaId } = useParams<{ turmaId: string }>();
  const navigate = useNavigate();
  const [turma, setTurma] = useState<TurmaDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [emails, setEmails] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [results, setResults] = useState<EnrollResult[]>([]);

  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subjectTitle, setSubjectTitle] = useState('');

  const load = useCallback(() => {
    api.get<TurmaDetail>(`/turmas/${turmaId}`)
      .then((r) => setTurma(r.data))
      .catch(() => setNotFound(true));
  }, [turmaId]);

  useEffect(load, [load]);

  const enroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrolling(true);
    try {
      const { data } = await api.post<{ results: EnrollResult[] }>(`/turmas/${turmaId}/students`, { emails });
      setResults(data.results);
      setEmails('');
      load();
    } catch {
      toast.error(t('classes.enrollError'));
    } finally {
      setEnrolling(false);
    }
  };

  const removeStudent = async (id: string) => {
    try {
      await api.delete(`/turmas/${turmaId}/students/${id}`);
      toast.success(t('classes.removed'));
      load();
    } catch {
      toast.error(t('classes.removeError'));
    }
  };

  const cancelInvite = async (email: string) => {
    try {
      await api.delete(`/turmas/${turmaId}/pending/${encodeURIComponent(email)}`);
      toast.success(t('classes.inviteCancelled'));
      load();
    } catch {
      toast.error(t('classes.removeError'));
    }
  };

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/turmas/${turmaId}`, { name: newName });
      toast.success(t('classes.renamed'));
      setRenameOpen(false);
      load();
    } catch {
      toast.error(t('classes.createError'));
    }
  };

  const deleteTurma = async () => {
    try {
      await api.delete(`/turmas/${turmaId}`);
      toast.success(t('classes.deleted'));
      navigate('/classes');
    } catch {
      toast.error(t('classes.removeError'));
    }
  };

  const createSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/notebooks', { title: subjectTitle, turma: turmaId });
      toast.success(t('classes.subjectCreated'));
      setSubjectTitle('');
      setSubjectOpen(false);
      load();
    } catch {
      toast.error(t('myNotebooks.createError'));
    }
  };

  if (notFound) {
    return (
      <div className="space-y-6">
        <BackLink to="/classes">{t('classes.back')}</BackLink>
        <EmptyState title={t('notFound.title')} description={t('notFound.text')} />
      </div>
    );
  }
  if (!turma) return <div role="status" aria-label={t('common.loading')} className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <BackLink to="/classes">{t('classes.back')}</BackLink>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{turma.name}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setNewName(turma.name); setRenameOpen(true); }}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> {t('classes.rename')}
            </Button>
            <Button variant="ghost" onClick={() => setDeleteOpen(true)} aria-label={t('classes.delete')} title={t('classes.delete')}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">{t('classes.delete')}</span>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="students">
        <TabsList aria-label={t('classes.tabsLabel')}>
          <TabsTrigger value="students">{t('classes.tabStudents')} ({turma.students.length})</TabsTrigger>
          <TabsTrigger value="subjects">{t('classes.tabSubjects')} ({turma.notebooks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-8">
          <form onSubmit={enroll} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div>
              <h2 className="font-display text-xl font-bold">{t('classes.enrollTitle')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('classes.enrollHint')}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="emails" className="block text-sm font-medium">{t('classes.emailsLabel')}</label>
              <textarea
                id="emails" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={t('classes.emailsPlaceholder')}
                className="w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={enrolling} disabled={!emails.trim()}>{enrolling ? t('classes.enrolling') : t('classes.enrollBtn')}</Button>
            </div>
            {results.length > 0 && (
              <ul className="space-y-2 border-t border-border pt-4" aria-live="polite">
                {results.map((r) => (
                  <li key={r.email} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{r.email}</span>
                    <Badge variant={statusVariant(r.status)}>{t(`classes.result.${r.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </form>

          <section aria-labelledby="enrolled-heading" className="space-y-3">
            <h2 id="enrolled-heading" className="font-display text-xl font-bold">{t('classes.studentsList')}</h2>
            {turma.students.length === 0 ? (
              <p className="text-muted-foreground">{t('classes.noStudents')}</p>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
                {turma.students.map((s) => (
                  <li key={s._id} className="flex items-center gap-3 px-4 py-3">
                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground">{s.name.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">{s.email}</span>
                    </span>
                    <Button variant="ghost" size="icon" aria-label={t('classes.remove', { name: s.name })} title={t('classes.remove', { name: s.name })} onClick={() => removeStudent(s._id)}>
                      <UserMinus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {turma.pendingEmails.length > 0 && (
            <section aria-labelledby="pending-heading" className="space-y-3">
              <div>
                <h2 id="pending-heading" className="font-display text-xl font-bold">{t('classes.pendingList')}</h2>
                <p className="text-sm text-muted-foreground">{t('classes.pendingDesc')}</p>
              </div>
              <ul className="divide-y divide-border rounded-2xl border border-dashed border-border bg-card/60">
                {turma.pendingEmails.map((email) => (
                  <li key={email} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-2 font-medium"><MoreHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{email}</span>
                    <Button variant="ghost" size="icon" aria-label={t('classes.cancelInvite', { email })} title={t('classes.cancelInvite', { email })} onClick={() => cancelInvite(email)}>
                      <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">{t('classes.subjectsDesc')}</p>
            <Button onClick={() => setSubjectOpen(true)}><Plus className="h-5 w-5" aria-hidden="true" /> {t('classes.newSubject')}</Button>
          </div>
          {turma.notebooks.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-6 w-6" />} title={t('classes.noSubjects')} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {turma.notebooks.map((n) => (
                <li key={n._id}>
                  <Link to={`/notebook/${n._id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted">
                    <span>
                      <span className="block font-display text-lg font-bold">{n.title}</span>
                      <span className="text-sm text-muted-foreground">{t('myNotebooks.lessons', { count: n.lessonsCount })}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Modal open={renameOpen} onOpenChange={setRenameOpen} title={t('classes.rename')} closeLabel={t('common.close')}>
        <form onSubmit={rename} className="space-y-5">
          <Field label={t('classes.nameLabel')} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} required autoFocus />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setRenameOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={subjectOpen} onOpenChange={setSubjectOpen} title={t('classes.newSubject')} closeLabel={t('common.close')}>
        <form onSubmit={createSubject} className="space-y-5">
          <Field label={t('classes.subjectTitleLabel')} placeholder={t('classes.subjectPlaceholder')} value={subjectTitle} onChange={(e) => setSubjectTitle(e.target.value)} maxLength={120} required autoFocus />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setSubjectOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('myNotebooks.create')}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteOpen} onOpenChange={setDeleteOpen} title={t('classes.deleteTitle')} description={t('classes.deleteBody')} closeLabel={t('common.close')}
        footer={<><Button variant="ghost" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button><Button variant="destructive" onClick={deleteTurma}>{t('myNotebooks.deleteModal.confirm')}</Button></>}
      />
    </div>
  );
};

export default TurmaDetailPage;
