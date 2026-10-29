// src/services/studentTasks.ts — tarefas publicadas para o aluno, com a situação de cada uma
// (usado pela lista de tarefas, pela agenda e pelo plano de estudo)
import Notebook from '../models/Notebook';
import QuizAttempt from '../models/QuizAttempt';
import QuizDraft from '../models/QuizDraft';
import Task from '../models/Task';
import Turma from '../models/Turma';

export type StudentTaskStatus = 'submitted' | 'in_progress' | 'pending';

export interface StudentTaskRow {
  _id: unknown;
  title: string;
  dueDate: Date | null;
  questionsCount: number;
  notebookTitle?: string;
  lessonTitle?: string;
  status: StudentTaskStatus;
  score: number | null;
  late: boolean;
  submittedAt: Date | null;
  overdue: boolean;
}

export async function listStudentTasks(userId: string, now = new Date()): Promise<StudentTaskRow[]> {
  const turmas = await Turma.find({ students: userId }).select('_id').lean();
  const tasks = await Task.find({ turma: { $in: turmas.map((t) => t._id) }, published: true }).lean();
  const ids = tasks.map((t) => t._id);

  const [attempts, drafts, notebooks] = await Promise.all([
    QuizAttempt.find({ user: userId, task: { $in: ids } }).select('task score late createdAt').lean(),
    QuizDraft.find({ user: userId, task: { $in: ids } }).select('task answers').lean(),
    Notebook.find({ _id: { $in: tasks.map((t) => t.notebook) } }).select('title lessons owner').lean(),
  ]);
  const attemptByTask = new Map(attempts.map((a) => [String(a.task), a]));
  const draftByTask = new Map(drafts.map((d) => [String(d.task), d]));
  const notebookById = new Map(notebooks.map((n) => [String(n._id), n]));

  const rows = tasks.map((t): StudentTaskRow => {
    const a = attemptByTask.get(String(t._id));
    const d = draftByTask.get(String(t._id));
    const nb = notebookById.get(String(t.notebook));
    const status: StudentTaskStatus = a ? 'submitted' : d && d.answers.some((x: unknown) => x !== null) ? 'in_progress' : 'pending';
    return {
      _id: t._id, title: t.title, dueDate: t.dueDate ?? null, questionsCount: t.questions.length,
      notebookTitle: nb?.title, lessonTitle: nb?.lessons.find((l) => String(l._id) === String(t.lesson))?.title,
      status, score: a?.score ?? null, late: a?.late ?? false, submittedAt: a?.createdAt ?? null,
      overdue: !a && !!t.dueDate && now > t.dueDate,
    };
  });
  // pendentes primeiro (prazo mais próximo no topo), depois as enviadas
  rows.sort((x, y) => {
    if ((x.status === 'submitted') !== (y.status === 'submitted')) return x.status === 'submitted' ? 1 : -1;
    return (x.dueDate ? new Date(x.dueDate).getTime() : Infinity) - (y.dueDate ? new Date(y.dueDate).getTime() : Infinity);
  });
  return rows;
}
