// src/components/ds/PageParts.tsx — peças de página compartilhadas
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Badge } from './Misc';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, className }) => (
  <div className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', className)}>
    <div className="max-w-2xl space-y-1.5">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
  </div>
);

export const BackLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link to={to} className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground">
    <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {children}
  </Link>
);

interface FeatureTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  to?: string;
  soonLabel?: string;
}

/** Cartão de funcionalidade: link quando disponível, desabilitado com selo "Em breve" quando não. */
export const FeatureTile: React.FC<FeatureTileProps> = ({ icon, title, description, to, soonLabel }) => {
  const body = (
    <>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground" aria-hidden="true">{icon}</span>
      <span className="mt-4 flex items-center gap-2 font-display text-lg font-bold">
        {title}
        {!to && soonLabel && <Badge>{soonLabel}</Badge>}
      </span>
      <span className="mt-1 text-sm text-muted-foreground">{description}</span>
    </>
  );
  const base = 'flex flex-col rounded-2xl border border-border bg-card p-5 text-left';
  return to ? (
    <Link to={to} className={cn(base, 'shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted')}>{body}</Link>
  ) : (
    <div className={cn(base, 'opacity-80')}>{body}</div>
  );
};

export const StatCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
  </div>
);
