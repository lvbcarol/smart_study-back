// src/pages/SummaryPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useStudyTimer } from '../hooks/useStudyTimer';
import ChatMessage from '../components/ChatMessage';
import { Button } from '../components/ds/Button';
import { ChatInput } from '../components/ds/ChatInput';
import { BackLink } from '../components/ds/PageParts';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

const SummaryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { lessonId } = useParams();
  useStudyTimer('summary', lessonId);

  const [lessonTitle, setLessonTitle] = useState('');
  const [materialsCount, setMaterialsCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChatSaved, setIsChatSaved] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    api.get(`/lessons/${lessonId}`).then((response) => {
      const { lessonTitle, chatHistory, materialsCount } = response.data;
      setLessonTitle(lessonTitle);
      setMaterialsCount(materialsCount ?? 0);
      if (chatHistory && chatHistory.length > 0) {
        setMessages(chatHistory);
        setIsChatSaved(true);
      } else {
        setMessages([{ sender: 'bot', text: t('chat.summaryInitial', { title: lessonTitle }) }]);
      }
    }).finally(() => setIsLoading(false));
  }, [lessonId, t]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = userInput.trim();
    if (!trimmedInput || isLoading) return;

    const newMessages: Message[] = [...messages, { sender: 'user', text: trimmedInput }];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);
    setIsChatSaved(false);

    try {
      // 1ª mensagem: tópico a resumir. Depois: perguntas de acompanhamento sobre a aula.
      const isFirst = !messages.some((m) => m.sender === 'user');
      const reply = isFirst
        ? (await api.post('/ai/summarize', { topic: trimmedInput, language: i18n.language, lessonId })).data.summary
        : (await api.post('/ai/chat', { lessonId, message: trimmedInput, language: i18n.language, history: messages })).data.reply;
      setMessages([...newMessages, { sender: 'bot', text: reply }]);
    } catch {
      setMessages([...newMessages, { sender: 'bot', text: t('chat.aiError') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChat = async () => {
    try {
      await api.put(`/lessons/${lessonId}/chat`, { messages });
      setIsChatSaved(true);
      toast.success(t('chat.saved'));
    } catch {
      toast.error(t('chat.saveError'));
    }
  };

  const hasSummary = messages.length > 1;

  return (
    <div className="chat-container flex flex-col">
      <div className="mb-2 flex items-center justify-between gap-3">
        <BackLink to={`/subjects/${lessonId}`}>{t('chat.backToSubject')}</BackLink>
        {lessonTitle && <h1 className="truncate text-lg font-bold">{lessonTitle}</h1>}
      </div>

      {materialsCount > 0 && (
        <p className="mb-2 flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground">
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" /> {t('chat.materialsBanner', { count: materialsCount })}
        </p>
      )}

      <div role="log" aria-live="polite" aria-label={t('chat.assistant')} className="min-h-[50vh]">
        {messages.map((msg, index) => <ChatMessage key={index} message={msg} />)}
        {isLoading && <ChatMessage message={{ sender: 'bot', text: t('chat.thinking') }} />}
        <div ref={chatEndRef} />
      </div>

      <div className="sticky bottom-4 mt-4 space-y-3">
        <ChatInput value={userInput} onChange={setUserInput} onSubmit={handleSendMessage} placeholder={messages.some((m) => m.sender === 'user') ? t('chat.askFollowUp') : t('chat.typeSubject')} disabled={isLoading} />
        {hasSummary && !isChatSaved && !isLoading && (
          <div className="flex justify-center">
            <Button variant="secondary" onClick={handleSaveChat}><Save className="h-4 w-4" aria-hidden="true" /> {t('chat.saveConversation')}</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryPage;
