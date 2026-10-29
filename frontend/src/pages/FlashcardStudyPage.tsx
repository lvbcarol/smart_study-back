// src/pages/FlashcardStudyPage.tsx — sessão de estudo: toque para ver a resposta, deslize para dizer se lembrou
//
// Deslizar para a direita = lembrei; para a esquerda = não lembrei (o cartão volta ao fim da sessão até o aluno acertar).
// Também funciona por botões e pelo teclado (Espaço, setas), então o gesto nunca é a única forma de usar.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, RotateCcw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useStudyTimer } from '../hooks/useStudyTimer';
import { SessionCard, StudySession } from '../types/flashcards';
import { Button } from '../components/ds/Button';
import { Badge, EmptyState, Skeleton } from '../components/ds/Misc';
import { BackLink } from '../components/ds/PageParts';
import { cn } from '@/lib/utils';

const SWIPE_THRESHOLD = 110;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const FlashcardStudyPage: React.FC = () => {
  const { t } = useTranslation();
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<StudySession | null | undefined>(undefined);
  const [queue, setQueue] = useState<SessionCard[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);
  const drag = useRef<{ startX: number; id: number } | null>(null);
  const moved = useRef(false);

  const loadSession = useCallback(() => {
    setSession(undefined);
    api.get<StudySession>(`/flashcards/decks/${deckId}/session`)
      .then((r) => {
        setSession(r.data);
        setQueue(r.data.cards);
        setTotal(r.data.cards.length);
        setDone(0);
        setMissed(new Set());
        setRevealed(false);
      })
      .catch(() => setSession(null));
  }, [deckId]);
  useEffect(loadSession, [loadSession]);

  const current = queue[0];
  useStudyTimer('flashcards', session?.lessonId, !!session);

  const decide = useCallback(async (remembered: boolean) => {
    if (!current || busy || !revealed) return;
    setBusy(true);
    try {
      await api.post(`/flashcards/decks/${deckId}/review`, { cardId: current._id, remembered });
      if (remembered) {
        setQueue((q) => q.slice(1));
        setDone((d) => d + 1);
      } else {
        setMissed((m) => new Set(m).add(current._id));
        setQueue((q) => [...q.slice(1), q[0]]); // volta ao fim da fila
      }
      setRevealed(false);
    } catch {
      toast.error(t('flashcards.session.saveError'));
    } finally {
      setBusy(false);
      setDx(0);
      setLeaving(null);
    }
  }, [current, busy, revealed, deckId, t]);

  // gesto: o cartão acompanha o dedo; passando do limite, "voa" para o lado e registra a resposta
  const finishSwipe = (distance: number) => {
    drag.current = null;
    if (Math.abs(distance) >= SWIPE_THRESHOLD) {
      const dir = distance > 0 ? 'right' : 'left';
      setLeaving(dir);
      setDx(dir === 'right' ? 600 : -600);
      window.setTimeout(() => decide(dir === 'right'), reducedMotion() ? 0 : 180);
    } else {
      setDx(0);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!revealed || busy) return;
    drag.current = { startX: e.clientX, id: e.pointerId };
    moved.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const d = e.clientX - drag.current.startX;
    if (Math.abs(d) > 6) moved.current = true;
    setDx(d);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    finishSwipe(e.clientX - drag.current.startX);
  };

  const reveal = () => { if (!moved.current && !revealed && current) setRevealed(true); };

  // teclado: Espaço/Enter mostra a resposta; setas decidem
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === ' ' || e.key === 'Enter') && !revealed && current) { e.preventDefault(); setRevealed(true); }
      else if (e.key === 'ArrowRight' && revealed) { e.preventDefault(); decide(true); }
      else if (e.key === 'ArrowLeft' && revealed) { e.preventDefault(); decide(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, current, decide]);

  if (session === undefined) return <div role="status" aria-label={t('common.loading')} className="mx-auto max-w-xl space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-72" /></div>;
  if (session === null) {
    return (
      <div className="space-y-6">
        <BackLink to="/flashcards">{t('flashcards.session.back')}</BackLink>
        <EmptyState title={t('flashcards.session.loadError')} />
      </div>
    );
  }

  // ---------- fim da sessão ----------
  if (!current) {
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <BackLink to="/flashcards">{t('flashcards.session.back')}</BackLink>
        <div className="space-y-4 rounded-3xl bg-accent p-10 text-accent-foreground">
          {total === 0 ? (
            <p className="font-display text-2xl font-bold">{t('flashcards.session.nothingLeft')}</p>
          ) : (
            <>
              <h1 className="font-display text-3xl font-extrabold">{t('flashcards.session.doneTitle')}</h1>
              <p className="text-lg">{t('flashcards.session.doneRemembered', { count: total })}</p>
              <p>{missed.size > 0 ? t('flashcards.session.doneMissed', { count: missed.size }) : t('flashcards.session.doneClean')}</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {total > 0 && <Button size="lg" onClick={loadSession}>{t('flashcards.session.studyMore')}</Button>}
          <Button size="lg" variant="outline" onClick={() => navigate('/flashcards')}>{t('flashcards.session.back')}</Button>
        </div>
      </div>
    );
  }

  const hint = dx > 40 ? 'right' : dx < -40 ? 'left' : null;
  const opacity = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
  const wasMissed = missed.has(current._id);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-3">
        <BackLink to="/flashcards">{t('flashcards.session.back')}</BackLink>
        <div className="flex items-center justify-between text-sm font-medium">
          <span>{session.title}</span>
          <span>{t('flashcards.session.done', { done, total })}</span>
        </div>
        <div role="progressbar" aria-label={t('flashcards.session.progress')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      {/* anuncia o cartão para leitores de tela */}
      <p className="sr-only" role="status" aria-live="polite">
        {revealed ? t('flashcards.session.announceBack', { text: current.back }) : t('flashcards.session.announceFront', { text: current.front })}
      </p>

      <div className="relative select-none">
        <div
          role="group"
          aria-label={t('flashcards.session.question')}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => finishSwipe(0)}
          onClick={reveal}
          style={{
            transform: `translateX(${dx}px) rotate(${dx / 25}deg)`,
            transition: drag.current ? 'none' : reducedMotion() ? 'none' : 'transform 180ms ease-out, opacity 180ms ease-out',
            opacity: leaving ? 0 : 1,
            touchAction: 'pan-y',
          }}
          className={cn(
            'relative flex min-h-80 cursor-pointer flex-col justify-between rounded-3xl border-2 bg-card p-8 text-center shadow-lifted',
            hint === 'right' ? 'border-success' : hint === 'left' ? 'border-destructive' : 'border-border',
            revealed && 'cursor-grab active:cursor-grabbing'
          )}
        >
          <div className="flex items-center justify-between text-xs">
            <Badge variant="primary">{current.topic || t('flashcards.session.question')}</Badge>
            <span className="flex items-center gap-2 text-muted-foreground">
              {wasMissed && <span className="flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t('flashcards.session.retry')}</span>}
              {!wasMissed && <span>{current.box === 0 ? t('flashcards.session.newCard') : t('flashcards.session.box', { box: current.box })}</span>}
            </span>
          </div>

          <div className="space-y-5 py-6">
            <p className="font-display text-2xl font-bold leading-snug">{current.front}</p>
            {revealed && (
              <div className="space-y-2 border-t border-border pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('flashcards.session.answer')}</p>
                <p className="text-xl leading-relaxed">{current.back}</p>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{revealed ? t('flashcards.session.swipeHint') : t('flashcards.session.flipHint')}</p>

          {/* indicadores do gesto */}
          <span aria-hidden="true" style={{ opacity: hint === 'right' ? opacity : 0 }} className="pointer-events-none absolute left-5 top-14 flex items-center gap-1 rounded-xl bg-success px-3 py-1.5 text-sm font-bold text-card -rotate-6">
            <Check className="h-4 w-4" />{t('flashcards.session.remembered')}
          </span>
          <span aria-hidden="true" style={{ opacity: hint === 'left' ? opacity : 0 }} className="pointer-events-none absolute right-5 top-14 flex items-center gap-1 rounded-xl bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground rotate-6">
            <X className="h-4 w-4" />{t('flashcards.session.forgot')}
          </span>
        </div>
      </div>

      {revealed ? (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" onClick={() => decide(false)} disabled={busy}><X className="h-5 w-5" aria-hidden="true" /> {t('flashcards.session.forgot')}</Button>
          <Button size="lg" onClick={() => decide(true)} disabled={busy}><Check className="h-5 w-5" aria-hidden="true" /> {t('flashcards.session.remembered')}</Button>
        </div>
      ) : (
        <Button size="lg" fullWidth onClick={() => setRevealed(true)}>{t('flashcards.session.flip')}</Button>
      )}

      <p className="text-center text-xs text-muted-foreground">{t('flashcards.session.keysHint')}</p>
    </div>
  );
};

export default FlashcardStudyPage;
