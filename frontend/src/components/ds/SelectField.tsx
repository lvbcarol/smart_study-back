// src/components/ds/SelectField.tsx — <select> nativo com rótulo (ótimo em celular e leitor de tela)
import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({ label, hint, className, id, children, ...props }) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <select
          id={selectId}
          aria-describedby={hint ? `${selectId}-hint` : undefined}
          className={cn(
            'min-h-11 w-full appearance-none rounded-xl border border-input bg-card px-4 pr-10 text-base text-foreground shadow-sm ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
      {hint && <p id={`${selectId}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
};
