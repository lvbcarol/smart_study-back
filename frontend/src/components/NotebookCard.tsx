// src/components/NotebookCard.tsx
import React, { useState } from 'react';
import { Check, ChevronRight, FileText, GraduationCap, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Lesson, Notebook } from '../types';
import { Button } from './ds/Button';
import { Modal } from './ds/Modal';
import { Badge } from './ds/Misc';

interface NotebookCardProps {
  notebook: Notebook;
  onDelete: (id: string) => void;
  onUpdate: (updatedNotebook: Notebook) => void;
  index: number;
}

interface ConfirmState {
  open: boolean;
  type: 'notebook' | 'lesson';
  id: string;
}

const iconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const inlineInput =
  'min-h-10 w-full rounded-lg border border-input bg-card px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// O backend devolve só { _id, title, lessons } ao editar: preserva os campos extras (readOnly, tentativas)
const mergeNotebook = (prev: Notebook, next: Notebook): Notebook => ({
  ...prev,
  ...next,
  lessons: next.lessons.map((l) => ({ ...l, quizzAttempts: prev.lessons.find((p) => p._id === l._id)?.quizzAttempts ?? [] })),
});

const NotebookCard: React.FC<NotebookCardProps> = ({ notebook, onDelete, onUpdate, index }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const readOnly = !!notebook.readOnly;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(notebook.title);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, type: 'notebook', id: '' });

  const handleTitleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentTitle.trim() === '' || currentTitle === notebook.title) {
      setIsEditingTitle(false);
      setCurrentTitle(notebook.title);
      return;
    }
    try {
      const response = await api.put(`/notebooks/${notebook._id}`, { title: currentTitle });
      onUpdate(mergeNotebook(notebook, response.data));
      setIsEditingTitle(false);
      toast.success(t('myNotebooks.titleUpdatedSuccess'));
    } catch {
      toast.error(t('myNotebooks.titleUpdatedError'));
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;
    try {
      const response = await api.post(`/notebooks/${notebook._id}/lessons`, { title: newLessonTitle });
      onUpdate(mergeNotebook(notebook, response.data));
      setNewLessonTitle('');
      setIsAddingLesson(false);
      toast.success(t('myNotebooks.lessonAddedSuccess'));
    } catch {
      toast.error(t('myNotebooks.lessonAddedError'));
    }
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLessonId || editingLessonTitle.trim() === '') return;
    try {
      const response = await api.put(`/notebooks/${notebook._id}/lessons/${editingLessonId}`, { title: editingLessonTitle });
      onUpdate(mergeNotebook(notebook, response.data));
      setEditingLessonId(null);
      toast.success(t('myNotebooks.lessonUpdatedSuccess'));
    } catch {
      toast.error(t('myNotebooks.lessonUpdatedError'));
    }
  };

  const handleConfirmDelete = async () => {
    if (confirm.type === 'notebook') {
      try {
        await api.delete(`/notebooks/${confirm.id}`);
        toast.success(t('myNotebooks.deleteSuccess'));
        onDelete(confirm.id);
      } catch {
        toast.error(t('myNotebooks.deleteError'));
      }
    } else {
      try {
        const response = await api.delete(`/notebooks/${notebook._id}/lessons/${confirm.id}`);
        onUpdate(mergeNotebook(notebook, response.data));
        toast.success(t('myNotebooks.lessonDeletedSuccess'));
      } catch {
        toast.error(t('myNotebooks.lessonDeletedError'));
      }
    }
    setConfirm((c) => ({ ...c, open: false }));
  };

  const cancelOnEscape = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') fn();
  };

  return (
    <>
      <article
        className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft animate-fade-in-up"
        style={{ animationDelay: `${index * 80}ms` }}
        aria-labelledby={`nb-${notebook._id}`}
      >
        <header className="flex items-start justify-between gap-2">
          {isEditingTitle ? (
            <form onSubmit={handleTitleUpdate} className="flex flex-1 items-center gap-1">
              <input
                className={inlineInput} value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)}
                aria-label={t('myNotebooks.notebookTitleLabel')} autoFocus
                onKeyDown={cancelOnEscape(() => { setIsEditingTitle(false); setCurrentTitle(notebook.title); })}
              />
              <button type="submit" className={iconBtn} aria-label={t('myNotebooks.save')}><Check className="h-4 w-4" aria-hidden="true" /></button>
              <button type="button" className={iconBtn} aria-label={t('myNotebooks.cancel')} onClick={() => { setIsEditingTitle(false); setCurrentTitle(notebook.title); }}><X className="h-4 w-4" aria-hidden="true" /></button>
            </form>
          ) : (
            <>
              <div className="min-w-0 space-y-1.5">
                <h3 id={`nb-${notebook._id}`} className="break-words font-display text-xl font-bold leading-tight">
                  <Link to={`/notebook/${notebook._id}`} className="rounded hover:underline">{notebook.title}</Link>
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{t('myNotebooks.lessons', { count: notebook.lessons.length })}</Badge>
                  {readOnly && <Badge variant="primary"><GraduationCap className="h-3 w-3" aria-hidden="true" />{notebook.ownerName ?? t('myNotebooks.fromTeacher')}</Badge>}
                  {notebook.turmaName && <Badge>{notebook.turmaName}</Badge>}
                </div>
              </div>
              {!readOnly && (
                <div className="flex shrink-0">
                  <button className={iconBtn} aria-label={t('myNotebooks.editNotebook')} title={t('myNotebooks.editNotebook')} onClick={() => setIsEditingTitle(true)}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                  <button className={`${iconBtn} hover:text-destructive`} aria-label={t('myNotebooks.deleteNotebook')} title={t('myNotebooks.deleteNotebook')} onClick={() => setConfirm({ open: true, type: 'notebook', id: notebook._id })}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              )}
            </>
          )}
        </header>

        <ul className="mt-4 max-h-64 flex-1 space-y-1.5 overflow-y-auto">
          {notebook.lessons.length === 0 && <li className="py-2 text-sm text-muted-foreground">{t('myNotebooks.noLessons')}</li>}
          {notebook.lessons.map((lesson: Lesson) => (
            <li key={lesson._id} className="group flex items-center gap-1">
              {editingLessonId === lesson._id ? (
                <form onSubmit={handleUpdateLesson} className="flex flex-1 items-center gap-1">
                  <input
                    className={inlineInput} value={editingLessonTitle} onChange={(e) => setEditingLessonTitle(e.target.value)}
                    aria-label={t('myNotebooks.lessonTitleLabel')} autoFocus onKeyDown={cancelOnEscape(() => setEditingLessonId(null))}
                  />
                  <button type="submit" className={iconBtn} aria-label={t('myNotebooks.save')}><Check className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" className={iconBtn} aria-label={t('myNotebooks.cancel')} onClick={() => setEditingLessonId(null)}><X className="h-4 w-4" aria-hidden="true" /></button>
                </form>
              ) : (
                <>
                  <button
                    onClick={() => navigate(`/subjects/${lesson._id}`)}
                    aria-label={t('myNotebooks.openLesson', { title: lesson.title })}
                    className="flex min-h-10 flex-1 items-center justify-between gap-2 rounded-xl bg-secondary px-3 text-left font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="break-words">{lesson.title}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                  {!readOnly && (
                    <div className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button className={iconBtn} aria-label={t('myNotebooks.editLesson')} title={t('myNotebooks.editLesson')} onClick={() => { setEditingLessonId(lesson._id); setEditingLessonTitle(lesson.title); }}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                      <button className={`${iconBtn} hover:text-destructive`} aria-label={t('myNotebooks.deleteLesson')} title={t('myNotebooks.deleteLesson')} onClick={() => setConfirm({ open: true, type: 'lesson', id: lesson._id })}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>

        <Link
          to={`/notebook/${notebook._id}?tab=materials`}
          className="mt-4 inline-flex min-h-9 items-center gap-2 self-start rounded-lg px-1 text-sm font-semibold text-primary hover:underline"
        >
          <FileText className="h-4 w-4" aria-hidden="true" /> {t('notebookPage.openMaterials')}
        </Link>

        {!readOnly && (
          isAddingLesson ? (
            <form onSubmit={handleAddLesson} className="mt-4 flex gap-2">
              <input
                className={inlineInput} value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder={t('myNotebooks.newLessonPlaceholder')} aria-label={t('myNotebooks.lessonTitleLabel')} autoFocus
                onKeyDown={cancelOnEscape(() => setIsAddingLesson(false))}
              />
              <Button type="submit" size="sm">{t('myNotebooks.save')}</Button>
              <Button type="button" size="sm" variant="ghost" aria-label={t('myNotebooks.cancel')} onClick={() => setIsAddingLesson(false)}><X className="h-4 w-4" aria-hidden="true" /></Button>
            </form>
          ) : (
            <Button variant="ghost" size="sm" className="mt-1 self-start text-primary" onClick={() => setIsAddingLesson(true)} title={t('myNotebooks.tooltipNewLesson')}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('myNotebooks.newLesson')}
            </Button>
          )
        )}
      </article>

      <Modal
        open={confirm.open}
        onOpenChange={(open) => setConfirm((c) => ({ ...c, open }))}
        title={confirm.type === 'notebook' ? t('myNotebooks.deleteModal.titleNotebook') : t('myNotebooks.deleteModal.titleLesson')}
        description={confirm.type === 'notebook' ? t('myNotebooks.deleteModal.bodyNotebook') : t('myNotebooks.deleteModal.bodyLesson')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm((c) => ({ ...c, open: false }))}>{t('myNotebooks.deleteModal.cancel')}</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>{t('myNotebooks.deleteModal.confirm')}</Button>
          </>
        }
      />
    </>
  );
};

export default NotebookCard;
