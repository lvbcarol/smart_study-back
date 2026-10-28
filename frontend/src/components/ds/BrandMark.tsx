// src/components/ds/BrandMark.tsx
// Marca do Smart Study: livro aberto (estudo) + faísca (inteligência).
// As cores da marca são fixas: não mudam com a paleta escolhida pelo usuário.
import React, { useId } from 'react';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  /** Texto alternativo; se omitido, o ícone é decorativo */
  title?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ className, title }) => {
  const gradId = useId();
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('h-10 w-10 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C6CF2" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${gradId})`} />
      <path d="M10 19.5c4.6-1.7 9.2-1.2 13.2 1.5v15.8c-4-2.5-8.6-2.9-13.2-1.2z" fill="#fff" />
      <path d="M38 19.5c-4.6-1.7-9.2-1.2-13.2 1.5v15.8c4-2.5 8.6-2.9 13.2-1.2z" fill="#fff" fillOpacity="0.85" />
      <path d="M33 6.5l1.7 4 4 1.7-4 1.7L33 18l-1.7-4.1-4-1.7 4-1.7z" fill="#F6B94C" />
    </svg>
  );
};

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  /** Esconde o nome e mostra só o ícone */
  iconOnly?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className, markClassName, iconOnly }) => (
  <span className={cn('inline-flex items-center gap-2.5', className)}>
    <BrandMark className={markClassName} title={iconOnly ? 'Smart Study' : undefined} />
    {!iconOnly && (
      <span className="font-display text-xl leading-none tracking-tight text-foreground">
        <span className="font-extrabold">Smart</span> <span className="font-medium">Study</span>
      </span>
    )}
  </span>
);
