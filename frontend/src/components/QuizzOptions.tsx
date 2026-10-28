// src/components/QuizzOptions.tsx
import React from 'react';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface QuizzOptionsProps {
  options: string[];
  correctAnswerIndex: number;
  selectedAnswerIndex: number | null;
  onSelectAnswer: (index: number) => void;
}

const QuizzOptions: React.FC<QuizzOptionsProps> = ({ options, correctAnswerIndex, selectedAnswerIndex, onSelectAnswer }) => {
  const { t } = useTranslation();
  const answered = selectedAnswerIndex !== null && selectedAnswerIndex !== undefined;

  return (
    <div role="radiogroup" className="ml-12 mt-2 max-w-lg space-y-2">
      {options.map((option, index) => {
        const letter = String.fromCharCode(65 + index);
        const isCorrect = answered && index === correctAnswerIndex;
        const isWrongPick = answered && index === selectedAnswerIndex && index !== correctAnswerIndex;
        // O estado nunca depende só da cor: há ícone e texto para leitores de tela
        const status = isCorrect ? t('quizzPage.correct') : isWrongPick ? t('quizzPage.incorrect') : '';

        return (
          <button
            key={index}
            role="radio"
            aria-checked={index === selectedAnswerIndex}
            aria-label={`${t('quizzPage.optionLabel', { letter, text: option })}${status ? ` (${status})` : ''}`}
            onClick={() => onSelectAnswer(index)}
            disabled={answered}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left font-medium transition-colors ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
              !answered && 'border-border bg-card hover:border-primary hover:bg-accent',
              isCorrect && 'border-success bg-success/[0.12] text-foreground',
              isWrongPick && 'border-destructive bg-destructive/[0.12] text-foreground',
              answered && !isCorrect && !isWrongPick && 'border-border bg-card opacity-60'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                isCorrect ? 'border-success bg-success text-card' : isWrongPick ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-border'
              )}
            >
              {isCorrect ? <Check className="h-4 w-4" /> : isWrongPick ? <X className="h-4 w-4" /> : letter}
            </span>
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
};

export default QuizzOptions;
