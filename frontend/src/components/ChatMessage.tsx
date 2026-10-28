// src/components/ChatMessage.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from './ds/BrandMark';

interface ChatMessageProps {
  message: {
    sender: 'user' | 'bot';
    text: string;
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { t } = useTranslation();
  const isBot = message.sender === 'bot';

  if (isBot) {
    return (
      <div className="my-4 flex w-full items-start gap-3 animate-fade-in-up">
        <BrandMark className="h-9 w-9" />
        <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-card p-4 shadow-soft">
          <span className="sr-only">{t('chat.assistant')}: </span>
          <div className="prose prose-themed max-w-none prose-p:my-2 prose-headings:mb-2 prose-headings:mt-4">
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 flex w-full items-start justify-end gap-3 animate-fade-in-up">
      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary p-4 text-primary-foreground shadow-soft">
        <span className="sr-only">{t('chat.you')}: </span>
        <p className="whitespace-pre-wrap">{message.text}</p>
      </div>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <User className="h-5 w-5" />
      </span>
    </div>
  );
};

export default ChatMessage;
