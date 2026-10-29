// src/pages/Home.tsx — início diferente para aluno e professor
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, BarChart3, Layers, ListChecks, Users, FileText, ClipboardCheck, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Notebook } from '../types';
import { TurmaSummary } from '../types/classes';
import { StudentTaskRow } from '../types/tasks';
import StudyPlanCard from '../components/StudyPlanCard';
import { Mascot } from '../components/mascot/Mascot';
import { buttonVariants } from '../components/ds/Button';
import { Skeleton } from '../components/ds/Misc';
import { FeatureTile, StatCard } from '../components/ds/PageParts';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [turmas, setTurmas] = useState<TurmaSummary[] | null>(null);
  const [tasks, setTasks] = useState<StudentTaskRow[] | null>(null);
  const [flash, setFlash] = useState<{ due: number } | null>(null);

  useEffect(() => {
    api.get<Notebook[]>('/notebooks').then((r) => setNotebooks(r.data)).catch(() => setNotebooks([]));
  }, []);

  useEffect(() => {
    if (isTeacher) api.get<TurmaSummary[]>('/turmas').then((r) => setTurmas(r.data)).catch(() => setTurmas([]));
    else {
      api.get<StudentTaskRow[]>('/tasks/mine').then((r) => setTasks(r.data)).catch(() => setTasks([]));
      api.get<{ due: number }>('/flashcards/summary').then((r) => setFlash(r.data)).catch(() => setFlash({ due: 0 }));
    }
  }, [isTeacher]);

  const lessons = notebooks?.reduce((sum, n) => sum + n.lessons.length, 0) ?? 0;
  const scores = notebooks?.flatMap((n) => n.lessons.flatMap((l) => (l.quizzAttempts ?? []).map((a) => a.score))) ?? [];
  const average = scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : '–';

  const stats = isTeacher
    ? [
        { label: t('home.statClasses'), value: turmas?.length ?? 0, loading: turmas === null },
        { label: t('home.statStudents'), value: turmas?.reduce((sum, x) => sum + x.studentsCount, 0) ?? 0, loading: turmas === null },
        { label: t('home.statTeacherNotebooks'), value: notebooks?.length ?? 0, loading: notebooks === null },
        { label: t('home.statLessons'), value: lessons, loading: notebooks === null },
      ]
    : [
        { label: t('home.statNotebooks'), value: notebooks?.length ?? 0, loading: notebooks === null },
        { label: t('home.statLessons'), value: lessons, loading: notebooks === null },
        { label: t('home.statAverage'), value: average, loading: notebooks === null },
        { label: t('home.statPendingTasks'), value: tasks?.filter((x) => x.status !== 'submitted').length ?? 0, loading: tasks === null },
        { label: t('home.statFlashcards'), value: flash?.due ?? 0, loading: flash === null },
      ];

  const soon = t('home.soon');
  const icon = 'h-5 w-5';

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-accent p-8 text-accent-foreground md:p-12">
        <div className="relative z-10 max-w-2xl space-y-4">
          <p className="font-semibold opacity-90">{t('home.greeting', { name: user?.name.split(' ')[0] })}</p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            {isTeacher ? t('home.teacherTitle') : t('home.studentTitle')}
          </h1>
          <p className="text-lg opacity-90">{isTeacher ? t('home.teacherSubtitle') : t('home.studentSubtitle')}</p>
          <Link to="/my-notebooks" className={buttonVariants({ size: 'lg' })}>
            {isTeacher ? t('home.teacherCta') : t('home.studentCta')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        <Mascot pose={isTeacher ? 'book' : 'wave'} size={190} className="absolute bottom-0 right-10 z-10 hidden md:block" />
        <div aria-hidden="true" className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-primary/10" />
        <div aria-hidden="true" className="absolute -bottom-24 right-24 h-64 w-64 rounded-full bg-primary/10" />
      </section>

      {!isTeacher && <StudyPlanCard />}

      <section aria-label="Stats" className={isTeacher ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-5'}>
        {stats.map((s) => (s.loading ? <Skeleton key={s.label} className="h-24" /> : <StatCard key={s.label} label={s.label} value={s.value} />))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold tracking-tight">{t('home.featuresTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isTeacher ? (
            <>
              <FeatureTile to="/my-notebooks" icon={<BookOpen className={icon} />} title={t('navbar.teacherNotebooks')} description={t('myNotebooks.subtitleShort')} />
              <FeatureTile to="/classes" icon={<Users className={icon} />} title={t('home.fClasses')} description={t('home.fClassesDesc')} />
              <FeatureTile to="/results" icon={<BarChart3 className={icon} />} title={t('navbar.results')} description={t('dash.teacherSubtitle')} />
              <FeatureTile to="/my-notebooks" icon={<FileText className={icon} />} title={t('home.fMaterials')} description={t('home.fMaterialsDesc')} />
              <FeatureTile to="/tasks" icon={<ClipboardCheck className={icon} />} title={t('home.fTasks')} description={t('home.fTasksDesc')} />
            </>
          ) : (
            <>
              <FeatureTile to="/my-notebooks" icon={<BookOpen className={icon} />} title={t('home.fSummary')} description={t('home.fSummaryDesc')} />
              <FeatureTile to="/my-notebooks" icon={<ListChecks className={icon} />} title={t('home.fQuiz')} description={t('home.fQuizDesc')} />
              <FeatureTile to="/tasks" icon={<ClipboardCheck className={icon} />} title={t('home.fTasksStudent')} description={t('home.fTasksStudentDesc')} />
              <FeatureTile to="/progress" icon={<BarChart3 className={icon} />} title={t('home.fProgress')} description={t('home.fProgressDesc')} />
              <FeatureTile to="/flashcards" icon={<Layers className={icon} />} title={t('home.fFlashcards')} description={t('home.fFlashcardsDesc')} />
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
