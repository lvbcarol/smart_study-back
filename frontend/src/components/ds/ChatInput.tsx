// src/components/ds/ChatInput.tsx
import React from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ value, onChange, onSubmit, placeholder, disabled }) => {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft focus-within:ring-2 focus-within:ring-ring">
      <label htmlFor="chat-input" className="sr-only">{t('chat.inputLabel')}</label>
      <input
        id="chat-input" type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled} autoComplete="off"
        className="min-h-11 flex-1 bg-transparent px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
      />
      <Button type="submit" size="icon" disabled={disabled || !value.trim()} aria-label={t('chat.send')} title={t('chat.send')}>
        <Send className="h-5 w-5" aria-hidden="true" />
      </Button>
    </form>
  );
};
