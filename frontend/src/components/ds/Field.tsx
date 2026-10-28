// src/components/ds/Field.tsx
// Campo de formulário acessível: rótulo visível, dica e erro ligados por aria-describedby.
import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, error, className, id, required, type, ...props }, ref) => {
    const { t } = useTranslation();
    const [revealed, setRevealed] = useState(false);
    const isPassword = type === 'password';
    const autoId = useId();
    const inputId = id ?? autoId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
          {required && <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && revealed ? 'text' : type}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'min-h-11 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground shadow-sm ' +
                'placeholder:text-muted-foreground transition-colors focus-visible:outline-none ' +
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent disabled:opacity-60',
              isPassword && 'pr-12',
              error && 'border-destructive',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button" onClick={() => setRevealed((r) => !r)} aria-pressed={revealed}
              aria-label={revealed ? t('common.hidePassword') : t('common.showPassword')}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {revealed ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
            </button>
          )}
        </div>
        {hint && !error && <p id={hintId} className="text-sm text-muted-foreground">{hint}</p>}
        {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);
Field.displayName = 'Field';
