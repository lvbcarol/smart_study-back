// src/hooks/useStudyTimer.ts — registra sozinho o tempo de estudo enquanto a tela está aberta e visível
//
// Só conta quando a aba está visível (aba em segundo plano pausa). O tempo é enviado ao sair da tela,
// ao trocar de aula e a cada 5 minutos. Períodos muito curtos (< 15 s) são descartados.
import { useEffect, useRef } from 'react';
import api, { API_URL, TOKEN_KEY } from '../services/api';

export type StudyKind = 'summary' | 'quiz' | 'task' | 'flashcards' | 'manual';

const MIN_SECONDS = 15;
const FLUSH_EVERY_MS = 5 * 60 * 1000;

/** `keepalive` deixa o envio terminar mesmo se a aba estiver sendo fechada. */
export async function sendStudySession(kind: StudyKind, seconds: number, startedAt: Date, lessonId?: string, keepalive = false) {
  if (seconds < MIN_SECONDS && kind !== 'manual') return;
  const body = {
    kind, seconds: Math.min(Math.round(seconds), 4 * 60 * 60), startedAt: startedAt.toISOString(),
    tzOffset: new Date().getTimezoneOffset(), ...(lessonId ? { lessonId } : {}),
  };
  try {
    if (keepalive) {
      await fetch(`${API_URL}/study/sessions`, {
        method: 'POST', keepalive: true, body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}` },
      });
    } else {
      await api.post('/study/sessions', body);
    }
  } catch {
    // tempo de estudo é um extra: se a rede falhar, o aluno não precisa saber
  }
}

export function useStudyTimer(kind: StudyKind, lessonId?: string, enabled = true) {
  const acc = useRef(0); // segundos acumulados desde o último envio
  const startedAt = useRef<Date | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const flush = (keepalive = false) => {
      const seconds = acc.current;
      const started = startedAt.current;
      acc.current = 0;
      startedAt.current = null;
      if (started && seconds > 0) void sendStudySession(kind, seconds, started, lessonId, keepalive);
    };
    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!startedAt.current) startedAt.current = new Date(Date.now() - 1000);
      acc.current += 1;
    }, 1000);
    const periodic = window.setInterval(() => flush(), FLUSH_EVERY_MS);
    const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(periodic);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [kind, lessonId, enabled]);
}
