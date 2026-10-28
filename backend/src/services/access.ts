// src/services/access.ts
// Regras de acesso a cadernos, centralizadas:
//  - dono do caderno: leitura e escrita
//  - aluno matriculado na turma do caderno: somente leitura
import mongoose, { Types } from 'mongoose';
import Notebook, { INotebook } from '../models/Notebook';
import Turma from '../models/Turma';
import Usuario from '../models/Usuario';

export interface NotebookAccess {
  notebook: INotebook;
  canWrite: boolean;
}

export interface LessonAccess extends NotebookAccess {
  lesson: INotebook['lessons'][number];
}

async function resolveAccess(notebook: INotebook | null, userId: string): Promise<NotebookAccess | null> {
  if (!notebook) return null;
  if (notebook.owner.toString() === userId) return { notebook, canWrite: true };
  if (notebook.turma && (await Turma.exists({ _id: notebook.turma, students: userId }))) {
    return { notebook, canWrite: false };
  }
  return null;
}

/** Filtro Mongo com todos os cadernos que o usuário pode ler. */
export async function accessibleNotebooksFilter(userId: string) {
  const turmaIds = (await Turma.find({ students: userId }).distinct('_id')) as Types.ObjectId[];
  return { $or: [{ owner: userId }, { turma: { $in: turmaIds } }] };
}

export async function findNotebookAccess(notebookId: string, userId: string): Promise<NotebookAccess | null> {
  if (!mongoose.isValidObjectId(notebookId)) return null;
  return resolveAccess(await Notebook.findById(notebookId), userId);
}

export async function findLessonAccess(lessonId: string, userId: string): Promise<LessonAccess | null> {
  if (!mongoose.isValidObjectId(lessonId)) return null;
  const access = await resolveAccess(await Notebook.findOne({ 'lessons._id': lessonId }), userId);
  if (!access) return null;
  const lesson = access.notebook.lessons.find((l) => l._id.toString() === lessonId);
  return lesson ? { ...access, lesson } : null;
}

export interface TurmaSummary {
  _id: Types.ObjectId;
  name: string;
  teacherName: string;
}

/** Turmas em que o aluno está matriculado. Lista vazia = aluno avulso (sem vínculo com escola). */
export async function listStudentTurmas(userId: string): Promise<TurmaSummary[]> {
  const turmas = await Turma.find({ students: userId }).sort({ createdAt: 1 }).select('name teacher').lean();
  const teachers = await Usuario.find({ _id: { $in: turmas.map((t) => t.teacher) } }).select('name').lean();
  const names = new Map(teachers.map((u) => [String(u._id), u.name as string]));
  return turmas.map((t) => ({ _id: t._id as Types.ObjectId, name: t.name, teacherName: names.get(String(t.teacher)) ?? '' }));
}
