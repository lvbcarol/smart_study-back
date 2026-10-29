// src/services/privacy.ts — direitos do titular (LGPD): exportar os próprios dados e excluir a conta
import { Types } from 'mongoose';
import AgendaItem from '../models/AgendaItem';
import ChatSession from '../models/ChatSession';
import Competency from '../models/Competency';
import FlashcardDeck from '../models/FlashcardDeck';
import Material from '../models/Material';
import Notebook from '../models/Notebook';
import QuizAttempt from '../models/QuizAttempt';
import QuizDraft from '../models/QuizDraft';
import StudyPlan from '../models/StudyPlan';
import StudySession from '../models/StudySession';
import Task from '../models/Task';
import Turma from '../models/Turma';
import Usuario from '../models/Usuario';
import WeaknessStat from '../models/WeaknessStat';

/** Todos os dados que o app guarda sobre a pessoa, em um JSON (sem a senha). */
export async function exportUserData(userId: string) {
  const user = await Usuario.findById(userId).lean();
  if (!user) return null;
  const { password: _password, ...profile } = user as typeof user & { password?: string };

  const [notebooks, attempts, sessions, agenda, plans, decks, chats, weakness, turmas] = await Promise.all([
    Notebook.find({ owner: userId }).lean(),
    QuizAttempt.find({ user: userId }).lean(),
    StudySession.find({ user: userId }).lean(),
    AgendaItem.find({ user: userId }).lean(),
    StudyPlan.find({ user: userId }).lean(),
    FlashcardDeck.find({ user: userId }).lean(),
    ChatSession.find({ user: userId }).lean(),
    WeaknessStat.find({ user: userId }).lean(),
    user.role === 'teacher' ? Turma.find({ teacher: userId }).select('name students pendingEmails').lean() : Turma.find({ students: userId }).select('name').lean(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile, notebooks, attempts, studySessions: sessions, agenda, studyPlans: plans, flashcardDecks: decks, chats, weaknessStats: weakness, classes: turmas,
  };
}

/**
 * Exclui a conta e os dados ligados a ela.
 * - Aluno: apaga o que produziu e sai das turmas.
 * - Professor: apaga também as turmas, matérias, materiais e tarefas dele (e o que os alunos produziram nelas).
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await Usuario.findById(userId).select('email role').lean();
  if (!user) return;
  const uid = new Types.ObjectId(userId);

  // matérias do usuário (e, para professor, tudo que depende delas em qualquer conta)
  const notebooks = await Notebook.find({ owner: uid }).select('lessons').lean();
  const notebookIds = notebooks.map((n) => n._id);
  const lessonIds = notebooks.flatMap((n) => n.lessons.map((l) => l._id));

  if (user.role === 'teacher') {
    const turmas = await Turma.find({ teacher: uid }).select('_id').lean();
    const turmaIds = turmas.map((t) => t._id);
    const tasks = await Task.find({ $or: [{ turma: { $in: turmaIds } }, { createdBy: uid }] }).select('_id').lean();
    const taskIds = tasks.map((t) => t._id);
    await Promise.all([
      QuizAttempt.deleteMany({ $or: [{ task: { $in: taskIds } }, { notebook: { $in: notebookIds } }] }),
      QuizDraft.deleteMany({ $or: [{ task: { $in: taskIds } }, { notebook: { $in: notebookIds } }] }),
      Task.deleteMany({ _id: { $in: taskIds } }),
      Turma.deleteMany({ _id: { $in: turmaIds } }),
    ]);
  }

  await Promise.all([
    Material.deleteMany({ notebook: { $in: notebookIds } }),
    Competency.deleteMany({ notebook: { $in: notebookIds } }),
    WeaknessStat.deleteMany({ $or: [{ user: uid }, { lesson: { $in: lessonIds } }] }),
    ChatSession.deleteMany({ $or: [{ user: uid }, { lesson: { $in: lessonIds } }] }),
    FlashcardDeck.deleteMany({ $or: [{ user: uid }, { notebook: { $in: notebookIds } }] }),
    QuizAttempt.deleteMany({ $or: [{ user: uid }, { notebook: { $in: notebookIds } }] }),
    QuizDraft.deleteMany({ $or: [{ user: uid }, { notebook: { $in: notebookIds } }] }),
    StudySession.deleteMany({ user: uid }),
    StudyPlan.deleteMany({ user: uid }),
    AgendaItem.deleteMany({ user: uid }),
    Notebook.deleteMany({ owner: uid }),
    Turma.updateMany({}, { $pull: { students: uid, pendingEmails: user.email } }),
  ]);
  await Usuario.deleteOne({ _id: uid });
}
