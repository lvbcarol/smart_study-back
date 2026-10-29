// Registra sozinho o tempo de estudo enquanto a tela está aberta e o app está em primeiro plano.
// Envia ao sair da tela, ao ir para segundo plano e a cada 5 minutos; períodos muito curtos (< 15 s) são descartados.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import api from '@/services/api';

export type StudyKind = 'summary' | 'quiz' | 'task' | 'flashcards' | 'manual';

const MIN_SECONDS = 15;
const FLUSH_EVERY_MS = 5 * 60 * 1000;

export async function sendStudySession(kind: StudyKind, seconds: number, startedAt: Date, lessonId?: string) {
  if (seconds < MIN_SECONDS && kind !== 'manual') return;
  try {
    await api.post('/study/sessions', {
      kind, seconds: Math.min(Math.round(seconds), 4 * 60 * 60), startedAt: startedAt.toISOString(),
      tzOffset: new Date().getTimezoneOffset(), ...(lessonId ? { lessonId } : {}),
    });
  } catch {
    // tempo de estudo é um extra: se a rede falhar, o aluno não precisa saber
  }
}

export function useStudyTimer(kind: StudyKind, lessonId?: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    let acc = 0; // segundos acumulados desde o último envio
    let startedAt: Date | null = null;

    const flush = () => {
      const seconds = acc;
      const started = startedAt;
      acc = 0;
      startedAt = null;
      if (started && seconds > 0) void sendStudySession(kind, seconds, started, lessonId);
    };
    const tick = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      if (!startedAt) startedAt = new Date(Date.now() - 1000);
      acc += 1;
    }, 1000);
    const periodic = setInterval(flush, FLUSH_EVERY_MS);
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') flush(); });
    return () => {
      clearInterval(tick);
      clearInterval(periodic);
      sub.remove();
      flush();
    };
  }, [kind, lessonId, enabled]);
}
