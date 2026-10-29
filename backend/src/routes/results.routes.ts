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
import WeaknessStat from '../models/WeaknessStat';
import StudySession from '../models/StudySession';
import { clampOffset, localDay } from '../study/dates';
import { computeKolb, KolbStyle } from '../study/kolb';
import { loadKolbInput } from '../study/kolbData';
import { assessRisk } from '../study/risk';
import { BLOOM_LEVELS } from '../quiz/questions';
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

// GET /overview — resumo de todas as turmas do professor (cartões da página "Resultados")
router.get('/overview', async (req: AuthRequest, res: Response) => {
  try {
    const turmas = await Turma.find({ teacher: req.userId }).sort({ createdAt: 1 }).lean();
    const [notebooks, tasks] = await Promise.all([
      Notebook.find({ owner: req.userId, turma: { $in: turmas.map((t) => t._id) } }).select('turma').lean(),
      Task.find({ turma: { $in: turmas.map((t) => t._id) }, published: true }).select('turma').lean(),
    ]);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // tempo de estudo da semana: só de quem permitiu que o professor veja (a média ignora os demais)
    const allSharing = await Usuario.find({ _id: { $in: turmas.flatMap((t) => t.students) }, shareStudyTimeWithTeacher: true }).select('_id').lean();
    const sharingIds = new Set(allSharing.map((u) => String(u._id)));
    const weekSessions = await StudySession.aggregate<{ _id: unknown; seconds: number }>([
      { $match: { user: { $in: allSharing.map((u) => u._id) }, startedAt: { $gte: weekAgo } } },
      { $group: { _id: '$user', seconds: { $sum: '$seconds' } } },
    ]);
    const secondsByUser = new Map(weekSessions.map((x) => [String(x._id), x.seconds]));
    const sharedMinutes = new Map(turmas.map((t) => {
      const mine = t.students.map(String).filter((id) => sharingIds.has(id));
      return [String(t._id), mine.length ? round(mine.reduce((s, id) => s + (secondsByUser.get(id) ?? 0), 0) / mine.length / 60) : null] as const;
    }));

    const rows = await Promise.all(turmas.map(async (t) => {
      const notebookIds = notebooks.filter((n) => String(n.turma) === String(t._id)).map((n) => n._id);
      const taskIds = tasks.filter((x) => String(x.turma) === String(t._id)).map((x) => x._id);
      const [[agg], [submitted], active] = await Promise.all([
        QuizAttempt.aggregate([
          { $match: { notebook: { $in: notebookIds }, user: { $in: t.students } } },
          { $group: { _id: null, average: { $avg: '$score' }, attempts: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
        ]),
        QuizAttempt.aggregate([
          { $match: { task: { $in: taskIds }, user: { $in: t.students } } },
          { $group: { _id: null, n: { $sum: 1 } } },
        ]),
        QuizAttempt.distinct('user', { notebook: { $in: notebookIds }, user: { $in: t.students }, createdAt: { $gte: weekAgo } }),
      ]);
      const expected = taskIds.length * t.students.length;
      return {
        turmaId: t._id, name: t.name, students: t.students.length,
        average: agg ? round(agg.average) : null, attempts: agg?.attempts ?? 0, lastActivityAt: agg?.lastAt ?? null,
        activeStudents: active.length,
        sharedStudyMinutes: sharedMinutes.get(String(t._id)) ?? null,
        tasksPublished: taskIds.length,
        deliveryRate: expected ? round(((submitted?.n ?? 0) / expected) * 100) : null,
      };
    }));
    res.json({ turmas: rows });
  } catch {
    res.status(500).json({ error: 'Error fetching overview.' });
  }
});

// GET /turmas/:turmaId/timeline?range=7|30|90&tzOffset= — média e nº de tentativas da turma por dia
router.get('/turmas/:turmaId/timeline', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.turmaId, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    const range = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30;
    const tz = clampOffset(typeof req.query.tzOffset === 'string' ? req.query.tzOffset : undefined);
    const notebooks = await Notebook.find({ turma: turma._id, owner: req.userId }).select('_id').lean();
    const attempts = await QuizAttempt.find({
      notebook: { $in: notebooks.map((n) => n._id) }, user: { $in: turma.students },
      createdAt: { $gte: new Date(Date.now() - range * 24 * 60 * 60 * 1000) },
    }).select('score createdAt user').lean();

    const perDay = new Map<string, { scores: number[]; users: Set<string> }>();
    for (const a of attempts) {
      const d = localDay(a.createdAt, tz);
      const cur = perDay.get(d) ?? { scores: [], users: new Set<string>() };
      cur.scores.push(a.score);
      cur.users.add(String(a.user));
      perDay.set(d, cur);
    }
    res.json({
      range,
      days: [...perDay.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, v]) => ({
        date, average: round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length), attempts: v.scores.length, students: v.users.size,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Error fetching timeline.' });
  }
});

// GET /turmas/:turmaId/weakness — onde a turma mais erra, por tópico e por tipo de pergunta
router.get('/turmas/:turmaId/weakness', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.turmaId, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    const notebooks = await Notebook.find({ turma: turma._id, owner: req.userId }).select('title lessons').lean();
    const lessonTitle = new Map(notebooks.flatMap((n) => n.lessons.map((l) => [String(l._id), `${n.title} · ${l.title}`] as const)));
    const lessonNotebook = new Map(notebooks.flatMap((n) => n.lessons.map((l) => [String(l._id), String(n._id)] as const)));

    const docs = await WeaknessStat.find({ user: { $in: turma.students }, lesson: { $in: [...lessonTitle.keys()] } }).lean();
    const now = new Date();

    const topics = new Map<string, { topic: string; lesson: string; lessonId: string; notebookId: string; seen: number; wrong: number; struggling: Set<string> }>();
    const types = new Map<string, { seen: number; wrong: number }>();
    for (const d of docs) {
      const dec = decayed(d, now);
      const key = `${d.lesson}:${d.topicKey}`;
      const t = topics.get(key) ?? { topic: d.topic, lesson: lessonTitle.get(String(d.lesson)) ?? '', lessonId: String(d.lesson), notebookId: lessonNotebook.get(String(d.lesson)) ?? '', seen: 0, wrong: 0, struggling: new Set<string>() };
      t.seen += dec.seen; t.wrong += dec.wrong;
      if (dec.wrong >= 0.5) t.struggling.add(String(d.user));
      topics.set(key, t);
      const ty = types.get(d.type) ?? { seen: 0, wrong: 0 };
      ty.seen += dec.seen; ty.wrong += dec.wrong;
      types.set(d.type, ty);
    }

    res.json({
      studentsTotal: turma.students.length,
      topics: [...topics.values()]
        .filter((t) => t.seen >= 2)
        .map((t) => ({ topic: t.topic, lesson: t.lesson, lessonId: t.lessonId, notebookId: t.notebookId, errorRate: round(smoothedErrorRate(t.seen, t.wrong) * 100), answers: Math.round(t.seen), students: t.struggling.size }))
        .sort((a, b) => b.errorRate * Math.sqrt(b.answers) - a.errorRate * Math.sqrt(a.answers))
        .slice(0, 10),
      byType: QUESTION_TYPES.map((type) => {
        const ty = types.get(type);
        return { type, answers: ty ? Math.round(ty.seen) : 0, accuracy: ty && ty.seen >= 1 ? round((1 - ty.wrong / ty.seen) * 100) : null };
      }),
    });
  } catch {
    res.status(500).json({ error: 'Error fetching class weakness.' });
  }
});

// GET /turmas/:turmaId/risk — alunos que precisam de atenção (sem atividade, notas em queda, tarefa atrasada)
router.get('/turmas/:turmaId/risk', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.turmaId, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    const now = new Date();
    const [students, notebooks, tasks] = await Promise.all([
      Usuario.find({ _id: { $in: turma.students } }).select('name createdAt shareStudyTimeWithTeacher').lean(),
      Notebook.find({ turma: turma._id, owner: req.userId }).select('_id').lean(),
      Task.find({ turma: turma._id, published: true }).select('dueDate').lean(),
    ]);
    const sharing = students.filter((s) => s.shareStudyTimeWithTeacher).map((s) => s._id);
    const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < now);

    const [attempts, delivered, lastSessions] = await Promise.all([
      QuizAttempt.find({ notebook: { $in: notebooks.map((n) => n._id) }, user: { $in: turma.students }, createdAt: { $gte: new Date(now.getTime() - 60 * 86400_000) } }).select('user score createdAt').lean(),
      QuizAttempt.find({ task: { $in: overdueTasks.map((t) => t._id) }, user: { $in: turma.students } }).select('user task').lean(),
      // o tempo de estudo só conta como atividade para quem permitiu que o professor o veja
      StudySession.aggregate<{ _id: unknown; last: Date }>([{ $match: { user: { $in: sharing } } }, { $group: { _id: '$user', last: { $max: '$startedAt' } } }]),
    ]);
    const lastByUser = new Map(lastSessions.map((x) => [String(x._id), x.last]));
    const deliveredKeys = new Set(delivered.map((d) => `${d.user}:${d.task}`));

    const rows = assessRisk(students.map((s) => ({
      id: String(s._id), name: s.name, joinedAt: (s as unknown as { createdAt: Date }).createdAt,
      attempts: attempts.filter((a) => String(a.user) === String(s._id)).map((a) => ({ score: a.score, at: a.createdAt })),
      lastSessionAt: lastByUser.get(String(s._id)) ?? null,
      overdueTasks: overdueTasks.filter((t) => !deliveredKeys.has(`${s._id}:${t._id}`)).length,
    })), now);
    res.json({ studentsTotal: students.length, students: rows });
  } catch {
    res.status(500).json({ error: 'Error fetching risk.' });
  }
});

// GET /turmas/:turmaId/learning-styles — distribuição dos estilos de aprendizagem (Kolb) da turma
router.get('/turmas/:turmaId/learning-styles', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.turmaId, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    const now = new Date();
    const students = await Usuario.find({ _id: { $in: turma.students } }).select('shareStudyTimeWithTeacher showLearningProfile').lean();
    // quem ocultou o perfil não entra; o tempo de estudo só entra para quem o compartilha
    const visible = students.filter((s) => s.showLearningProfile !== false);
    const withTime = visible.filter((s) => s.shareStudyTimeWithTeacher).map((s) => s._id);
    const withoutTime = visible.filter((s) => !s.shareStudyTimeWithTeacher).map((s) => s._id);
    const inputs = new Map([
      ...(withTime.length ? [...(await loadKolbInput(withTime, now, true))] : []),
      ...(withoutTime.length ? [...(await loadKolbInput(withoutTime, now, false))] : []),
    ]);

    const styles: Record<KolbStyle | 'insufficient', number> = { diverging: 0, assimilating: 0, converging: 0, accommodating: 0, insufficient: 0 };
    const shares = { EC: 0, OR: 0, CA: 0, EA: 0 };
    let enough = 0;
    for (const input of inputs.values()) {
      const k = computeKolb(input);
      if (!k.style) { styles.insufficient += 1; continue; }
      styles[k.style] += 1;
      enough += 1;
      k.quadrants.forEach((q) => { shares[q.id] += q.share; });
    }
    res.json({
      studentsTotal: students.length, hidden: students.length - visible.length, styles,
      quadrants: (Object.keys(shares) as (keyof typeof shares)[]).map((id) => ({ id, share: enough ? Math.round((shares[id] / enough) * 1000) / 1000 : 0 })),
    });
  } catch {
    res.status(500).json({ error: 'Error fetching learning styles.' });
  }
});

// GET /turmas/:turmaId/outcomes?range= — acerto da turma por nível de Bloom e por competência
router.get('/turmas/:turmaId/outcomes', async (req: AuthRequest, res: Response) => {
  try {
    const turma = await ownTurma(req.params.turmaId, req.userId as string);
    if (!turma) return res.status(404).json({ error: 'Class not found.' });
    const range = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30;
    const notebooks = await Notebook.find({ turma: turma._id, owner: req.userId }).select('_id').lean();
    const attempts = await QuizAttempt.find({
      notebook: { $in: notebooks.map((n) => n._id) }, user: { $in: turma.students },
      createdAt: { $gte: new Date(Date.now() - range * 86400_000) },
    }).select('questions.bloomLevel questions.competency results.score').lean();

    const bloom = new Map<string, number[]>();
    const comp = new Map<string, number[]>();
    for (const a of attempts) {
      (a.results ?? []).forEach((r: { score: number }, i: number) => {
        const q = (a.questions ?? [])[i] as { bloomLevel?: string; competency?: string } | undefined;
        if (q?.bloomLevel) bloom.set(q.bloomLevel, [...(bloom.get(q.bloomLevel) ?? []), r.score]);
        if (q?.competency) comp.set(q.competency, [...(comp.get(q.competency) ?? []), r.score]);
      });
    }
    const mean = (xs: number[]) => round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100);
    res.json({
      range,
      byBloom: BLOOM_LEVELS.map((level) => ({ level, answers: bloom.get(level)?.length ?? 0, accuracy: bloom.get(level) ? mean(bloom.get(level)!) : null })),
      byCompetency: [...comp.entries()].map(([name, xs]) => ({ name, answers: xs.length, accuracy: mean(xs) })).sort((a, b) => a.accuracy - b.accuracy),
    });
  } catch {
    res.status(500).json({ error: 'Error fetching outcomes.' });
  }
});

export default router;
