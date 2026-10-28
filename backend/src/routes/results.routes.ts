// src/routes/results.routes.ts — painel de desempenho do professor: turma -> matéria -> aula -> aluno
//
// Só considera matérias do próprio professor e alunos atualmente matriculados na turma.
// As agregações não carregam perguntas/respostas (só notas), então o painel continua leve com turmas grandes.
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import Notebook from '../models/Notebook';
import QuizAttempt from '../models/QuizAttempt';
import Task from '../models/Task';
import Turma from '../models/Turma';
import Usuario from '../models/Usuario';
import { AuthRequest } from '../types';
import { QUESTION_TYPES } from '../quiz/questions';
import { decayed, errorRateByType, smoothedErrorRate } from '../quiz/weakness';
import { loadStats } from '../quiz/weakness.service';

const router = Router();
router.use(authMiddleware, requireRole('teacher'));

const round = (n: number) => Math.round(n);

async function ownTurma(id: string, teacherId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Turma.findOne({ _id: id, teacher: teacherId }).lean();
}

// GET /turmas/:turmaId — visão geral da turma
router.get('/turmas/:turmaId', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.turmaId, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });

    const [students, notebooks, tasks] = await Promise.all([
      Usuario.find({ _id: { $in: turma.students } }).select('name email').sort({ name: 1 }).lean(),
      Notebook.find({ turma: turma._id, owner: req.userId }).select('title lessons').sort({ createdAt: 1 }).lean(),
      Task.find({ turma: turma._id }).select('title lesson dueDate published questions').sort({ createdAt: -1 }).lean(),
    ]);
    const lessonIds = notebooks.flatMap((n) => n.lessons.map((l) => l._id));

    // média, nº de tentativas e última atividade por (aluno, aula)
    const [cells, perStudent, perTask] = await Promise.all([
      QuizAttempt.aggregate([
        { $match: { lesson: { $in: lessonIds }, user: { $in: turma.students } } },
        { $group: { _id: { user: '$user', lesson: '$lesson' }, average: { $avg: '$score' }, count: { $sum: 1 } } },
      ]),
      QuizAttempt.aggregate([
        { $match: { lesson: { $in: lessonIds }, user: { $in: turma.students } } },
        { $group: { _id: '$user', average: { $avg: '$score' }, attempts: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
      ]),
      QuizAttempt.aggregate([
        { $match: { task: { $in: tasks.map((t) => t._id) }, user: { $in: turma.students } } },
        { $group: { _id: '$task', submitted: { $sum: 1 }, average: { $avg: '$score' }, late: { $sum: { $cond: ['$late', 1, 0] } } } },
      ]),
    ]);

    const studentStats = new Map(perStudent.map((s) => [String(s._id), s]));
    const taskStats = new Map(perTask.map((s) => [String(s._id), s]));

    const lessonAgg = new Map<string, { sum: number; count: number; students: number }>();
    for (const c of cells) {
      const key = String(c._id.lesson);
      const a = lessonAgg.get(key) ?? { sum: 0, count: 0, students: 0 };
      a.sum += c.average * c.count;
      a.count += c.count;
      a.students += 1;
      lessonAgg.set(key, a);
    }

    res.json({
      turma: { _id: turma._id, name: turma.name },
      students: students.map((s) => {
        const st = studentStats.get(String(s._id));
        return {
          _id: s._id, name: s.name, email: s.email,
          average: st ? round(st.average) : null, attempts: st?.attempts ?? 0, lastAt: st?.lastAt ?? null,
        };
      }),
      notebooks: notebooks.map((n) => ({
        _id: n._id, title: n.title,
        lessons: n.lessons.map((l) => {
          const a = lessonAgg.get(String(l._id));
          return {
            _id: l._id, title: l.title,
            average: a ? round(a.sum / a.count) : null, attempts: a?.count ?? 0,
            participation: a?.students ?? 0, // alunos com ao menos uma tentativa
          };
        }),
      })),
      cells: cells.map((c) => ({ student: c._id.user, lesson: c._id.lesson, average: round(c.average), count: c.count })),
      tasks: tasks.map((t) => {
        const s = taskStats.get(String(t._id));
        return {
          _id: t._id, title: t.title, published: t.published, dueDate: t.dueDate ?? null, questionsCount: t.questions.length,
          submitted: s?.submitted ?? 0, late: s?.late ?? 0, total: turma.students.length, average: s ? round(s.average) : null,
        };
      }),
    });
  } catch (error) {
    console.error('RESULTS OVERVIEW FAILED:', error);
    res.status(500).json({ error: 'Error fetching results.' });
  }
});

// GET /turmas/:turmaId/students/:studentId — desempenho de um aluno
router.get('/turmas/:turmaId/students/:studentId', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.turmaId, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    if (!mongoose.isValidObjectId(req.params.studentId) || !turma.students.some((s) => String(s) === req.params.studentId)) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const [student, notebooks, tasks] = await Promise.all([
      Usuario.findById(req.params.studentId).select('name email').lean(),
      Notebook.find({ turma: turma._id, owner: req.userId }).select('title lessons').lean(),
      Task.find({ turma: turma._id }).select('title').lean(),
    ]);
    const lessonIds = notebooks.flatMap((n) => n.lessons.map((l) => l._id));
    const lessonInfo = new Map(notebooks.flatMap((n) => n.lessons.map((l) => [String(l._id), { lesson: l.title, notebook: n.title }] as const)));
    const taskTitle = new Map(tasks.map((t) => [String(t._id), t.title]));

    const attempts = await QuizAttempt.find({ user: req.params.studentId, lesson: { $in: lessonIds } })
      .select('lesson task source score late createdAt attemptNumber').sort({ createdAt: 1 }).lean();

    const scores = attempts.map((a) => a.score);
    const byLesson = new Map<string, number[]>();
    for (const a of attempts) byLesson.set(String(a.lesson), [...(byLesson.get(String(a.lesson)) ?? []), a.score]);

    // pontos fracos: mesmo algoritmo que o aluno vê, restrito às aulas desta turma
    const now = new Date();
    const lessonStats = await loadLessonStats(req.params.studentId, lessonIds);
    const byType = errorRateByType(lessonStats, now);

    res.json({
      student: { _id: student?._id, name: student?.name, email: student?.email },
      average: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      attemptsCount: attempts.length,
      lessons: [...byLesson.entries()].map(([id, s]) => ({
        lessonId: id, ...lessonInfo.get(id), average: round(s.reduce((a, b) => a + b, 0) / s.length), attempts: s.length,
      })),
      attempts: attempts.map((a) => ({
        _id: a._id, ...lessonInfo.get(String(a.lesson)), source: a.source,
        taskTitle: a.task ? taskTitle.get(String(a.task)) : undefined,
        score: a.score, late: a.late ?? false, date: a.createdAt,
      })),
      weakness: {
        types: QUESTION_TYPES.filter((t) => byType[t].seen >= 0.5).map((t) => ({ type: t, errorRate: round(byType[t].rate * 100), seen: round(byType[t].seen) }))
          .sort((a, b) => b.errorRate - a.errorRate),
        topics: lessonStats
          .map((s) => { const d = decayed(s, now); return { topic: s.topic, type: s.type, seen: d.seen, rate: smoothedErrorRate(d.seen, d.wrong), needsReview: s.misses.length > 0 }; })
          .filter((t) => t.seen >= 0.5)
          .sort((a, b) => Number(b.needsReview) - Number(a.needsReview) || b.rate - a.rate)
          .slice(0, 8)
          .map((t) => ({ topic: t.topic, type: t.type, errorRate: round(t.rate * 100), seen: round(t.seen), needsReview: t.needsReview })),
      },
    });
  } catch (error) {
    console.error('STUDENT RESULTS FAILED:', error);
    res.status(500).json({ error: 'Error fetching student results.' });
  }
});

async function loadLessonStats(studentId: string, lessonIds: unknown[]) {
  const all = await Promise.all(lessonIds.map((id) => loadStats(studentId, String(id))));
  return all.flat();
}

// GET /attempts/:attemptId — respostas completas de uma tentativa (matéria do professor, aluno da turma)
router.get('/attempts/:attemptId', async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) return res.status(404).json({ error: 'Attempt not found.' });
    const attempt = await QuizAttempt.findById(req.params.attemptId).lean();
    if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });

    const notebook = await Notebook.findOne({ _id: attempt.notebook, owner: req.userId }).lean();
    if (!notebook?.turma) return res.status(404).json({ error: 'Attempt not found.' });
    const turma = await Turma.findOne({ _id: notebook.turma, teacher: req.userId, students: attempt.user }).lean();
    if (!turma) return res.status(404).json({ error: 'Attempt not found.' });

    const [student, task] = await Promise.all([
      Usuario.findById(attempt.user).select('name email').lean(),
      attempt.task ? Task.findById(attempt.task).select('title').lean() : null,
    ]);
    res.json({
      _id: attempt._id,
      student: { _id: student?._id, name: student?.name, email: student?.email },
      turmaId: turma._id,
      notebookTitle: notebook.title,
      lessonTitle: notebook.lessons.find((l) => String(l._id) === String(attempt.lesson))?.title,
      taskTitle: task?.title,
      source: attempt.source, late: attempt.late ?? false, attemptNumber: attempt.attemptNumber,
      score: attempt.score, date: attempt.createdAt,
      questions: attempt.questions, answers: attempt.answers, results: attempt.results,
    });
  } catch {
    res.status(500).json({ error: 'Error fetching attempt.' });
  }
});

export default router;
