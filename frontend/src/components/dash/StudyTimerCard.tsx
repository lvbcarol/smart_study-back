// src/components/dash/StudyTimerCard.tsx — cronômetro manual "Estudar agora" (estudo fora do app: papel, aula, livro)
import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { sendStudySession } from '../../hooks/useStudyTimer';
import { Button } from '../ds/Button';

const fmt = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const StudyTimerCard: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const { t } = useTranslation();
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<{ startedAt: Date | null; seconds: number }>({ startedAt: null, seconds: 0 });
  ref.current = { startedAt, seconds };

  useEffect(() => {
    if (!startedAt) return undefined;
    const id = window.setInterval(() => setSeconds(Math.round((Date.now() - startedAt.getTime()) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  // saiu da página com o cronômetro ligado: guarda o que já estudou
  useEffect(() => () => {
    const { startedAt: s, seconds: sec } = ref.current;
    if (s && sec >= 15) void sendStudySession('manual', sec, s);
  }, []);

  const toggle = async () => {
    if (!startedAt) { setSeconds(0); setStartedAt(new Date()); return; }
    const done = seconds;
    const started = startedAt;
    setStartedAt(null);
    if (done < 15) { toast(t('dash.timerTooShort')); return; }
    await sendStudySession('manual', done, started);
    toast.success(t('dash.timerSaved', { minutes: Math.max(1, Math.round(done / 60)) }));
    onSaved();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-accent p-4 text-accent-foreground">
      <div>
        <p className="font-semibold">{t('dash.timerTitle')}</p>
        <p className="text-sm opacity-90">{t('dash.timerHint')}</p>
      </div>
      <div className="flex items-center gap-3">
        <span role="timer" aria-live="off" className="font-mono text-2xl font-bold tabular-nums">{fmt(seconds)}</span>
        <Button onClick={toggle}>
          {startedAt ? <><Pause className="h-4 w-4" aria-hidden="true" /> {t('dash.timerStop')}</> : <><Play className="h-4 w-4" aria-hidden="true" /> {t('dash.timerStart')}</>}
        </Button>
      </div>
    </div>
  );
};

export default StudyTimerCard;
