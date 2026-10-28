// src/components/ds/Misc.tsx — Switch, Badge, Skeleton, EmptyState e Tabs
import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ---------- Switch ---------- */
interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, label, description, disabled }) => {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p id={`${id}-label`} className="font-medium text-foreground">{label}</p>
        {description && <p id={`${id}-desc`} className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent transition-colors ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
            'focus-visible:ring-offset-background disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-border'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-card shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
};

/* ---------- Badge ---------- */
const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      neutral: 'bg-secondary text-secondary-foreground',
      primary: 'bg-accent text-accent-foreground',
      success: 'bg-success/[0.12] text-success',
      warning: 'bg-warning/[0.12] text-warning',
      destructive: 'bg-destructive/[0.12] text-destructive',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>> = ({
  className, variant, ...props
}) => <span className={cn(badgeVariants({ variant }), className)} {...props} />;

/* ---------- Skeleton ---------- */
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div aria-hidden="true" className={cn('animate-pulse rounded-xl bg-secondary', className)} {...props} />
);

/* ---------- EmptyState ---------- */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center', className)}>
    {icon && <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground" aria-hidden="true">{icon}</div>}
    <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
    {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action}
  </div>
);

/* ---------- Tabs ---------- */
export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('inline-flex flex-wrap items-center gap-1 rounded-xl bg-secondary p-1', className)}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex min-h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold text-muted-foreground transition-colors ' +
        'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
        'data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-soft',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl', className)}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
