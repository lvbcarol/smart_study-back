// src/components/ds/Modal.tsx
// Diálogo acessível (Radix): foco preso, Esc fecha, devolve o foco ao gatilho.
import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel?: string;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open, onOpenChange, title, description, children, footer, closeLabel = 'Fechar', className,
}) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl ' +
            'border border-border bg-card p-6 text-card-foreground shadow-lifted focus-visible:outline-none ' +
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
      >
        <Dialog.Title className="font-display text-xl font-bold">{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">{description}</Dialog.Description>
        ) : (
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
        )}
        {children && <div className="mt-4">{children}</div>}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
        <Dialog.Close
          aria-label={closeLabel}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
