// src/components/quiz/QuestionEditor.tsx — o professor edita perguntas e respostas de qualquer tipo
import React, { useId } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EditableQuestion } from '../../types/tasks';
import { QuestionType } from '../../types/quiz';
import { Button } from '../ds/Button';
import { Field } from '../ds/Field';
import { Badge } from '../ds/Misc';

const TextArea: React.FC<{ label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string; disabled?: boolean }> = ({
  label, value, onChange, rows = 3, hint, disabled,
}) => {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <textarea
        id={id} rows={rows} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      />
      {hint && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
};

interface QuestionEditorProps {
  question: EditableQuestion;
  index: number;
  onChange: (q: EditableQuestion) => void;
  onRemove: () => void;
  locked?: boolean;
}

/** Pergunta vazia de cada tipo, para "Adicionar pergunta". */
export function blankQuestion(type: QuestionType): EditableQuestion {
  const base = { type, topic: '', question: '', explanation: '' };
  switch (type) {
    case 'multiple_choice': return { ...base, options: ['', '', '', ''], correctAnswerIndex: 0 };
    case 'fill_blank': return { ...base, question: '____', acceptedAnswers: [['']] };
    case 'open_text': return { ...base, expectedAnswer: '', rubric: [''] };
    case 'practical': return { ...base, expectedAnswer: '', rubric: [] };
    case 'real_case': return { ...base, scenario: '', expectedAnswer: '', rubric: [''] };
  }
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({ question: q, index, onChange, onRemove, locked }) => {
  const { t } = useTranslation();
  const set = (patch: Partial<EditableQuestion>) => onChange({ ...q, ...patch });
  const f = (key: string, opts?: Record<string, unknown>) => t(`tasks.editor.fields.${key}`, opts);
  const blanks = (q.question.match(/_{3,}/g) ?? []).length;

  return (
    <li className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg font-bold">{t('tasks.editor.questionN', { n: index + 1 })}</span>
        <Badge variant="primary">{t(`quizzPage.types.${q.type}`)}</Badge>
        {q.reinforcement && <Badge variant="warning">{t('quizzPage.reinforcement')}</Badge>}
        {!locked && (
          <Button variant="ghost" size="icon" className="ml-auto" aria-label={t('tasks.editor.remove', { n: index + 1 })} title={t('tasks.editor.remove', { n: index + 1 })} onClick={onRemove}>
            <Trash2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </Button>
        )}
      </div>

      <Field label={f('topic')} value={q.topic} disabled={locked} maxLength={80} onChange={(e) => set({ topic: e.target.value })} />

      {q.type === 'real_case' && <TextArea label={f('scenario')} value={q.scenario ?? ''} rows={3} disabled={locked} onChange={(v) => set({ scenario: v })} />}
      <TextArea label={f('question')} value={q.question} rows={q.type === 'multiple_choice' ? 2 : 3} disabled={locked} onChange={(v) => set({ question: v })} hint={q.type === 'fill_blank' ? f('blanksHint') : undefined} />

      {q.type === 'multiple_choice' && (
        <fieldset className="space-y-2" disabled={locked}>
          <legend className="mb-1 text-sm font-medium">{f('options')}</legend>
          {(q.options ?? ['', '', '', '']).map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            return (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="radio" name={`correct-${index}`} checked={q.correctAnswerIndex === i} onChange={() => set({ correctAnswerIndex: i })}
                  aria-label={f('correct', { letter })} className="h-5 w-5 accent-[hsl(var(--primary))]"
                />
                <div className="flex-1">
                  <Field label={f('option', { letter })} value={opt} onChange={(e) => set({ options: (q.options ?? []).map((o, j) => (j === i ? e.target.value : o)) })} />
                </div>
              </div>
            );
          })}
        </fieldset>
      )}

      {q.type === 'fill_blank' && (
        <div className="space-y-3">
          {Array.from({ length: Math.max(blanks, 1) }, (_, i) => (
            <Field
              key={i} label={f('accepted', { n: i + 1 })} disabled={locked}
              value={(q.acceptedAnswers?.[i] ?? ['']).join(', ')}
              onChange={(e) => {
                const next = Array.from({ length: Math.max(blanks, 1) }, (_, j) => q.acceptedAnswers?.[j] ?? ['']);
                next[i] = e.target.value.split(',').map((s) => s.trimStart());
                set({ acceptedAnswers: next });
              }}
            />
          ))}
        </div>
      )}

      {q.type !== 'multiple_choice' && q.type !== 'fill_blank' && (
        <>
          <TextArea label={f('expected')} value={q.expectedAnswer ?? ''} rows={2} disabled={locked} onChange={(v) => set({ expectedAnswer: v })} />
          <TextArea label={f('rubric')} value={(q.rubric ?? []).join('\n')} rows={3} disabled={locked} onChange={(v) => set({ rubric: v.split('\n') })} />
        </>
      )}

      {q.type === 'practical' && (
        <fieldset className="space-y-2" disabled={locked}>
          <legend className="mb-1 text-sm font-medium">{f('numeric')}</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={f('numericValue')} type="number" step="any" value={q.numeric?.value ?? ''}
              onChange={(e) => set({ numeric: e.target.value === '' ? undefined : { value: Number(e.target.value), tolerance: q.numeric?.tolerance ?? 0 } })}
            />
            <Field
              label={f('tolerance')} type="number" step="any" min={0} value={q.numeric?.tolerance ?? ''} disabled={!q.numeric}
              onChange={(e) => q.numeric && set({ numeric: { ...q.numeric, tolerance: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </div>
        </fieldset>
      )}

      <TextArea label={f('explanation')} value={q.explanation} rows={2} disabled={locked} onChange={(v) => set({ explanation: v })} />
    </li>
  );
};

/** Limpa o que o professor deixou em branco antes de enviar ao servidor. */
export function cleanQuestion(q: EditableQuestion): EditableQuestion {
  const out: EditableQuestion = { ...q, topic: q.topic.trim(), question: q.question.trim(), explanation: q.explanation.trim() };
  if (q.options) out.options = q.options.map((o) => o.trim());
  if (q.acceptedAnswers) out.acceptedAnswers = q.acceptedAnswers.map((a) => a.map((s) => s.trim()).filter(Boolean));
  if (q.rubric) out.rubric = q.rubric.map((r) => r.trim()).filter(Boolean);
  if (q.expectedAnswer !== undefined) out.expectedAnswer = q.expectedAnswer.trim();
  if (q.scenario !== undefined) out.scenario = q.scenario.trim();
  if (q.numeric && !Number.isFinite(q.numeric.value)) delete out.numeric;
  return out;
}
