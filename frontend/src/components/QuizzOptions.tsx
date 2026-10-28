// src/components/QuizzOptions.tsx — alternativas de múltipla escolha
import React from 'react';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface QuizzOptionsProps {
  options: string[];
  selectedIndex: number | null;
  /** null enquanto o servidor ainda não corrigiu (o gabarito só chega depois da resposta) */
  correctIndex: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

const QuizzOptions: React.FC<QuizzOptionsProps> = ({ options, selectedIndex, correctIndex, onSelect, disabled }) => {
  const { t } = useTranslation();
  const revealed = correctIndex !== null;
  const locked = disabled || selectedIndex !== null;

  return (
    <div role="radiogroup" className="ml-12 mt-2 max-w-lg space-y-2">
      {options.map((option, index) => {
        const letter = String.fromCharCode(65 + index);
        const isCorrect = revealed && index === correctIndex;
        const isWrongPick = revealed && index === selectedIndex && index !== correctIndex;
        const isPending = !revealed && index === selectedIndex;
        // O estado nunca depende só da cor: há ícone e texto para leitores de tela
        const status = isCorrect ? t('quizzPage.correct') : isWrongPick ? t('quizzPage.incorrect') : '';

        return (
          <button
            key={index}
            role="radio"
            aria-checked={index === selectedIndex}
            aria-label={`${t('quizzPage.optionLabel', { letter, text: option })}${status ? ` (${status})` : ''}`}
            onClick={() => onSelect(index)}
            disabled={locked}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left font-medium transition-colors ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
              !locked && 'border-border bg-card hover:border-primary hover:bg-accent',
              isPending && 'border-primary bg-accent',
              isCorrect && 'border-success bg-success/[0.12] text-foreground',
              isWrongPick && 'border-destructive bg-destructive/[0.12] text-foreground',
              locked && !isCorrect && !isWrongPick && !isPending && 'border-border bg-card opacity-60'
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
