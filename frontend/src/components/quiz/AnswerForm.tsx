// src/components/quiz/AnswerForm.tsx — campo de resposta de acordo com o tipo da pergunta
import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PublicQuestion } from '../../types/quiz';
import { Button } from '../ds/Button';
import { Field } from '../ds/Field';

interface AnswerFormProps {
  question: PublicQuestion;
  onSubmit: (answer: string | string[]) => void;
  disabled?: boolean;
}

const AnswerForm: React.FC<AnswerFormProps> = ({ question, onSubmit, disabled }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [blanks, setBlanks] = useState<string[]>(() => Array(question.blanks ?? 0).fill(''));

  const isFill = question.type === 'fill_blank';
  const isNumeric = question.type === 'practical' && question.numeric;
  const canSend = isFill ? blanks.some((b) => b.trim()) : text.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || disabled) return;
    onSubmit(isFill ? blanks.map((b) => b.trim()) : text.trim());
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
      {isFill ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {blanks.map((value, i) => (
            <Field
              key={i} label={t('quizzPage.blankN', { n: i + 1 })} value={value} disabled={disabled} autoComplete="off"
              autoFocus={i === 0}
              onChange={(e) => setBlanks((prev) => prev.map((b, j) => (j === i ? e.target.value : b)))}
            />
          ))}
        </div>
      ) : isNumeric ? (
        <Field
          label={t('quizzPage.yourAnswer')} hint={t('quizzPage.numericHint')} inputMode="decimal" autoComplete="off" autoFocus
          value={text} onChange={(e) => setText(e.target.value)} disabled={disabled}
        />
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="answer-text" className="block text-sm font-medium">{t('quizzPage.yourAnswer')}</label>
          <textarea
            id="answer-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} autoFocus
            placeholder={t('quizzPage.writeHere')}
            className="w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={!canSend || disabled} loading={disabled}>
          <Send className="h-4 w-4" aria-hidden="true" /> {t('quizzPage.answerBtn')}
        </Button>
      </div>
    </form>
  );
};

export default AnswerForm;
