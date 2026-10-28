// src/pages/TasksPage.tsx — lista de tarefas: professor (gerencia) e aluno (resolve)
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StudentTaskRow, TeacherTaskRow } from '../types/tasks';
import { formatDateTime, scoreVariant } from '../lib/format';
import { Button } from '../components/ds/Button';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { PageHeader } from '../components/ds/PageParts';

const TeacherTasks: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TeacherTaskRow[] | null>(null);

  useEffect(() => {
    api.get<TeacherTaskRow[]>('/tasks').then((r) => setTasks(r.data)).catch(() => { toast.error(t('tasks.loadError')); setTasks([]); });
  }, [t]);

  const newButton = <Button onClick={() => navigate('/tasks/new')}><Plus className="h-5 w-5" aria-hidden="true" /> {t('tasks.new')}</Button>;

  return (
    <>
      <PageHeader title={t('tasks.title')} subtitle={t('tasks.subtitleTeacher')} actions={newButton} />
      {tasks === null ? (
        <div className="space-y-3" role="status" aria-label={t('common.loading')}>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title={t('tasks.emptyTeacherTitle')} description={t('tasks.emptyTeacherDesc')} action={newButton} />
      ) : (
        <ul className="space-y-3">
          {tasks.map((task, i) => (
            <li key={task._id} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
              <Link to={`/tasks/${task._id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted">
                <span className="min-w-0 space-y-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold">{task.title}</span>
                    <Badge variant={task.published ? 'success' : 'neutral'}>{task.published ? t('tasks.published') : t('tasks.draft')}</Badge>
                  </span>
                  <span className="block text-sm text-muted-foreground">{[task.turmaName, task.notebookTitle, task.lessonTitle].filter(Boolean).join(' · ')}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge>{t('tasks.questions', { count: task.questionsCount })}</Badge>
                    <span className="text-muted-foreground">{task.dueDate ? t('tasks.due', { date: formatDateTime(task.dueDate, i18n.language) }) : t('tasks.noDue')}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4 text-right">
                  <span>
                    <span className="block text-sm font-semibold">{t('tasks.delivered', { submitted: task.submitted, total: task.total })}</span>
                    {task.average !== null && <Badge variant={scoreVariant(task.average)}>{t('tasks.average', { avg: task.average })}</Badge>}
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

const StudentTasks: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [tasks, setTasks] = useState<StudentTaskRow[] | null>(null);

  useEffect(() => {
    api.get<StudentTaskRow[]>('/tasks/mine').then((r) => setTasks(r.data)).catch(() => { toast.error(t('tasks.loadError')); setTasks([]); });
  }, [t]);

  return (
    <>
      <PageHeader title={t('tasks.title')} subtitle={t('tasks.subtitleStudent')} />
      {tasks === null ? (
        <div className="space-y-3" role="status" aria-label={t('common.loading')}>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title={t('tasks.emptyStudentTitle')} description={t('tasks.emptyStudentDesc')} />
      ) : (
        <ul className="space-y-3">
          {tasks.map((task, i) => (
            <li key={task._id} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
              <Link to={`/tasks/${task._id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted">
                <span className="min-w-0 space-y-2">
                  <span className="block font-display text-lg font-bold">{task.title}</span>
                  <span className="block text-sm text-muted-foreground">{[task.notebookTitle, task.lessonTitle].filter(Boolean).join(' · ')}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={task.status === 'submitted' ? 'success' : task.status === 'in_progress' ? 'primary' : 'neutral'}>{t(`tasks.status.${task.status}`)}</Badge>
                    {task.overdue && <Badge variant="destructive">{t('tasks.overdue')}</Badge>}
                    {task.late && <Badge variant="warning">{t('tasks.late')}</Badge>}
                    <span className="text-muted-foreground">{task.dueDate ? t('tasks.due', { date: formatDateTime(task.dueDate, i18n.language) }) : t('tasks.noDue')}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {task.score !== null && <Badge variant={scoreVariant(task.score)} className="px-3 py-1 text-base">{t('quizzPage.pointsLabel', { score: task.score })}</Badge>}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

const TasksPage: React.FC = () => {
  const { user } = useAuth();
  return user?.role === 'teacher' ? <TeacherTasks /> : <StudentTasks />;
};

export default TasksPage;
