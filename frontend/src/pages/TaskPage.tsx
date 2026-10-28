// src/pages/TaskPage.tsx — professor: entregas e gabarito; aluno: resolver e ver o resultado
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AnswerValue, QuestionResult, PublicQuestion } from '../types/quiz';
import { StudentTaskSummary, Submission, TaskStart, TeacherTaskDetail } from '../types/tasks';
import { formatDateTime, scoreVariant } from '../lib/format';
import ActiveQuiz from '../components/ActiveQuiz';
import { AttemptReview } from '../components/quiz/AttemptReview';
import { Button, buttonVariants } from '../components/ds/Button';
import { Modal } from '../components/ds/Modal';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { BackLink } from '../components/ds/PageParts';

const correctText = (q: TeacherTaskDetail['questions'][number]): string => {
  if (q.type === 'multiple_choice') return q.options?.[q.correctAnswerIndex ?? 0] ?? '';
  if (q.type === 'fill_blank') return (q.acceptedAnswers ?? []).map((a) => a[0]).join(' · ');
  return q.expectedAnswer ?? '';
};

const TeacherTask: React.FC<{ taskId: string }> = ({ taskId }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [task, setTask] = useState<TeacherTaskDetail | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    api.get<TeacherTaskDetail>(`/tasks/${taskId}`).then((r) => setTask(r.data)).catch(() => navigate('/tasks', { replace: true }));
    api.get<Submission[]>(`/tasks/${taskId}/submissions`).then((r) => setSubs(r.data)).catch(() => setSubs([]));
  }, [taskId, navigate]);
  useEffect(load, [load]);

  const togglePublish = async () => {
    if (!task) return;
    try {
      await api.put(`/tasks/${taskId}`, { published: !task.published });
      toast.success(task.published ? t('tasks.detail.unpublishedOk') : t('tasks.detail.publishedOk'));
      load();
    } catch { toast.error(t('tasks.editor.saveError')); }
  };

  const remove = async () => {
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success(t('tasks.detail.deleted'));
      navigate('/tasks');
    } catch { toast.error(t('tasks.editor.saveError')); }
  };

  if (!task) return <div role="status" aria-label={t('common.loading')} className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <BackLink to="/tasks">{t('tasks.back')}</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={task.published ? 'success' : 'neutral'}>{task.published ? t('tasks.published') : t('tasks.draft')}</Badge>
              <Badge variant="primary">{[task.turmaName, task.notebookTitle, task.lessonTitle].filter(Boolean).join(' · ')}</Badge>
              <span className="text-sm text-muted-foreground">{task.dueDate ? t('tasks.due', { date: formatDateTime(task.dueDate, i18n.language) }) : t('tasks.noDue')}</span>
            </div>
            {task.description && <p className="max-w-2xl text-muted-foreground">{task.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={togglePublish}>
              {task.published ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              {task.published ? t('tasks.detail.unpublish') : t('tasks.detail.publish')}
            </Button>
            <Link to={`/tasks/${taskId}/edit`} className={buttonVariants({ variant: 'outline' })}><Pencil className="h-4 w-4" aria-hidden="true" /> {t('tasks.detail.edit')}</Link>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label={t('tasks.detail.delete')} title={t('tasks.detail.delete')}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
          </div>
        </div>
      </div>

      <section aria-labelledby="subs-title" className="space-y-3">
        <h2 id="subs-title" className="text-2xl font-extrabold tracking-tight">{t('tasks.detail.submissions')} ({task.submitted}/{subs.length})</h2>
        {subs.length === 0 ? (
          <EmptyState title={t('tasks.detail.noStudents')} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft" tabIndex={0} role="region" aria-label={t('tasks.detail.submissions')}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('tasks.detail.student')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('tasks.detail.status')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('tasks.detail.grade')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('tasks.detail.sentAt')}</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">{t('tasks.detail.viewAnswers')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subs.map((s) => (
                  <tr key={s.student._id}>
                    <th scope="row" className="px-4 py-3 font-semibold">{s.student.name}<span className="block text-xs font-normal text-muted-foreground">{s.student.email}</span></th>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === 'submitted' ? 'success' : s.status === 'in_progress' ? 'primary' : 'neutral'}>{t(`tasks.status.${s.status}`)}</Badge>
                      {s.late && <Badge variant="warning" className="ml-1">{t('tasks.late')}</Badge>}
                    </td>
                    <td className="px-4 py-3">{s.score !== null ? <Badge variant={scoreVariant(s.score)}>{s.score}%</Badge> : '–'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(s.submittedAt, i18n.language) || '–'}</td>
                    <td className="px-4 py-3 text-right">
                      {s.attemptId && <Link to={`/results/attempts/${s.attemptId}`} className="font-semibold text-primary hover:underline">{t('tasks.detail.viewAnswers')}</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <summary className="cursor-pointer font-display text-lg font-bold">{t('tasks.detail.answerKey')} ({task.questions.length})</summary>
        <ol className="mt-4 space-y-4">
          {task.questions.map((q, i) => (
            <li key={q.id ?? i} className="space-y-1 border-t border-border pt-4 first:border-t-0 first:pt-0">
              <p className="flex flex-wrap items-center gap-2"><span className="font-bold">{i + 1}.</span><Badge variant="primary">{t(`quizzPage.types.${q.type}`)}</Badge><Badge>{q.topic}</Badge></p>
              {q.scenario && <p className="text-sm text-muted-foreground">{q.scenario}</p>}
              <p className="font-medium">{q.question}</p>
              <p className="text-sm"><span className="text-muted-foreground">{t('quizzPage.expected')}: </span><span className="font-semibold">{correctText(q)}</span></p>
            </li>
          ))}
        </ol>
      </details>

      <Modal
        open={confirmDelete} onOpenChange={setConfirmDelete} title={t('tasks.detail.deleteTitle')} description={t('tasks.detail.deleteBody')} closeLabel={t('common.close')}
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button><Button variant="destructive" onClick={remove}>{t('myNotebooks.deleteModal.confirm')}</Button></>}
      />
    </div>
  );
};

interface MyAttempt { score: number; late: boolean; date: string; questions: PublicQuestion[]; answers: AnswerValue[]; results: QuestionResult[] }

const StudentTask: React.FC<{ taskId: string }> = ({ taskId }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [task, setTask] = useState<StudentTaskSummary | null>(null);
  const [started, setStarted] = useState<TaskStart | null>(null);
  const [starting, setStarting] = useState(false);
  const [attempt, setAttempt] = useState<MyAttempt | null>(null);

  const load = useCallback(() => {
    api.get<StudentTaskSummary>(`/tasks/${taskId}`)
      .then((r) => {
        setTask(r.data);
        if (r.data.status === 'submitted') api.get<MyAttempt>(`/tasks/${taskId}/my-attempt`).then((a) => setAttempt(a.data)).catch(() => undefined);
      })
      .catch(() => navigate('/tasks', { replace: true }));
  }, [taskId, navigate]);
  useEffect(load, [load]);

  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post<TaskStart>(`/tasks/${taskId}/start`, { language: i18n.language });
      setStarted(data);
    } catch {
      toast.error(t('tasks.startError'));
    } finally {
      setStarting(false);
    }
  };

  if (!task) return <div role="status" aria-label={t('common.loading')} className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /></div>;

  if (started) {
    return (
      <div className="space-y-2">
        <div className="chat-container"><h1 className="truncate text-lg font-bold">{started.title}</h1></div>
        <ActiveQuiz
          lessonId="" task={started}
          onFinish={() => { setStarted(null); setAttempt(null); load(); }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        <BackLink to="/tasks">{t('tasks.back')}</BackLink>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={task.status === 'submitted' ? 'success' : task.status === 'in_progress' ? 'primary' : 'neutral'}>{t(`tasks.status.${task.status}`)}</Badge>
          <Badge>{[task.notebookTitle, task.lessonTitle].filter(Boolean).join(' · ')}</Badge>
          <Badge>{t('tasks.questions', { count: task.questionsCount })}</Badge>
          <span className="text-sm text-muted-foreground">{task.dueDate ? t('tasks.due', { date: formatDateTime(task.dueDate, i18n.language) }) : t('tasks.noDue')}</span>
        </div>
        {task.description && <p className="text-muted-foreground">{task.description}</p>}
      </div>

      {task.status === 'submitted' ? (
        <section className="space-y-6" aria-labelledby="my-result">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent p-5 text-accent-foreground">
            <p id="my-result" className="font-display text-xl font-bold">{t('tasks.alreadySubmitted')}</p>
            {task.score !== null && <Badge variant={scoreVariant(task.score)} className="px-3 py-1 text-base">{t('tasks.score', { score: task.score })}</Badge>}
            {task.late && <Badge variant="warning">{t('tasks.late')}</Badge>}
          </div>
          {attempt ? (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight">{t('tasks.myAnswers')}</h2>
              <AttemptReview questions={attempt.questions} answers={attempt.answers} results={attempt.results} />
            </>
          ) : <Skeleton className="h-40" />}
        </section>
      ) : (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-muted-foreground">{t('tasks.instructions')}</p>
          <Button size="lg" onClick={start} loading={starting}>{task.status === 'in_progress' ? t('tasks.resume') : t('tasks.start')}</Button>
        </section>
      )}
    </div>
  );
};

const TaskPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  if (!taskId) return null;
  return user?.role === 'teacher' ? <TeacherTask taskId={taskId} /> : <StudentTask taskId={taskId} />;
};

export default TaskPage;
