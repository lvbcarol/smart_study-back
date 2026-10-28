// Sessão de flashcards: toque no cartão para ver a resposta; deslize para a direita (lembrei) ou para a esquerda (não lembrei).
// Os botões fazem o mesmo, então o gesto nunca é a única forma de responder.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import type { SessionCard, StudySession } from '@/types';
import { Badge, Button, Card, Loading, ProgressBar, Row, Screen, T } from '@/ui';

const THRESHOLD = 110;

export default function FlashcardStudy() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();

  const [session, setSession] = useState<StudySession | null>(null);
  const [queue, setQueue] = useState<SessionCard[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);

  const x = useRef(new Animated.Value(0)).current;
  const revealedRef = useRef(false);
  const busyRef = useRef(false);
  const decideRef = useRef<(remembered: boolean) => void>(() => undefined);
  revealedRef.current = revealed;
  busyRef.current = busy;

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined); }, []);

  const loadSession = useCallback(() => {
    setSession(null);
    api.get<StudySession>(`/flashcards/decks/${deckId}/session`).then((r) => {
      setSession(r.data); setQueue(r.data.cards); setTotal(r.data.cards.length); setDone(0); setMissed(new Set()); setRevealed(false);
    }).catch(() => setError(t('flashcards.session.saveError')));
  }, [deckId, t]);
  useEffect(() => { loadSession(); }, [loadSession]);

  const current = queue[0];

  const decide = useCallback(async (remembered: boolean) => {
    if (!current || busyRef.current || !revealedRef.current) return;
    setBusy(true); setError('');
    try {
      await api.post(`/flashcards/decks/${deckId}/review`, { cardId: current._id, remembered });
      if (remembered) { setQueue((q) => q.slice(1)); setDone((d) => d + 1); }
      else { setMissed((m) => new Set(m).add(current._id)); setQueue((q) => [...q.slice(1), q[0]]); }
      setRevealed(false);
    } catch {
      setError(t('flashcards.session.saveError'));
    } finally {
      setBusy(false);
      x.setValue(0);
    }
  }, [current, deckId, t, x]);
  decideRef.current = decide;

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => revealedRef.current && !busyRef.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: Animated.event([null, { dx: x }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) >= THRESHOLD) {
        const dir = g.dx > 0 ? 1 : -1;
        Animated.timing(x, { toValue: dir * 500, duration: reduceMotionRef.current ? 0 : 180, useNativeDriver: false }).start(() => decideRef.current(dir > 0));
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
  })).current;
  const reduceMotionRef = useRef(false);
  reduceMotionRef.current = reduceMotion;

  const swipeButton = (remembered: boolean) => {
    if (!revealed || busy) return;
    Animated.timing(x, { toValue: remembered ? 500 : -500, duration: reduceMotion ? 0 : 180, useNativeDriver: false }).start(() => decide(remembered));
  };

  if (!session) return <Screen edges={['left', 'right', 'bottom']}>{error ? <T variant="muted" color={colors.destructive}>{error}</T> : <Loading />}</Screen>;

  // ---------- fim da sessão ----------
  if (!current) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: session.title }} />
        <Card style={{ backgroundColor: colors.accent, gap: 8, alignItems: 'center', padding: 28 }}>
          {total === 0 ? <T variant="heading" color={colors.accentFg} align="center">{t('flashcards.session.nothingLeft')}</T> : (
            <>
              <T variant="title" color={colors.accentFg} align="center">{t('flashcards.session.doneTitle')}</T>
              <T variant="body" color={colors.accentFg} align="center">{t('flashcards.session.doneRemembered', { count: total })}</T>
              <T variant="body" color={colors.accentFg} align="center">{missed.size > 0 ? t('flashcards.session.doneMissed', { count: missed.size }) : t('flashcards.session.doneClean')}</T>
            </>
          )}
        </Card>
        {total > 0 && <Button title={t('flashcards.session.studyMore')} onPress={loadSession} />}
        <Button title={t('flashcards.session.back')} variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const rotate = x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] });
  const rightOpacity = x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const leftOpacity = x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const wasMissed = missed.has(current._id);

  return (
    <Screen edges={['left', 'right', 'bottom']} scroll={false}>
      <Stack.Screen options={{ title: session.title }} />
      <View style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="label">{session.title}</T>
          <T variant="label">{t('flashcards.session.progress', { done, total })}</T>
        </Row>
        <ProgressBar value={done} max={total} label={t('flashcards.session.progress', { done, total })} />
      </View>

      <View accessibilityLiveRegion="polite" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
        <T>{revealed ? `${t('flashcards.session.answer')}: ${current.back}` : current.front}</T>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }, { rotate }] }}>
          <Pressable
            onPress={() => setRevealed(true)} accessibilityRole="button" accessibilityLabel={revealed ? `${current.front}. ${t('flashcards.session.answer')}: ${current.back}` : `${current.front}. ${t('flashcards.session.flip')}`}
            style={{ minHeight: 320, borderRadius: 28, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, padding: 24, justifyContent: 'space-between', shadowColor: '#3A2A1A', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4 }}
          >
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Badge variant="primary">{current.topic || t('flashcards.session.answer')}</Badge>
              <T variant="small">{wasMissed ? t('flashcards.session.retry') : current.box === 0 ? t('flashcards.session.newCard') : t('flashcards.session.box', { box: current.box })}</T>
            </Row>
            <View style={{ gap: 18, paddingVertical: 16 }}>
              <T variant="title" align="center">{current.front}</T>
              {revealed && (
                <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                  <T variant="small" align="center">{t('flashcards.session.answer').toUpperCase()}</T>
                  <T variant="heading" align="center" style={{ fontWeight: '400' }}>{current.back}</T>
                </View>
              )}
            </View>
            <T variant="small" align="center">{revealed ? t('flashcards.session.swipeHint') : t('flashcards.session.flipHint')}</T>

            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 56, left: 18, opacity: rightOpacity, backgroundColor: colors.success, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
              <T variant="label" color={colors.card}>✓ {t('flashcards.session.remembered')}</T>
            </Animated.View>
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 56, right: 18, opacity: leftOpacity, backgroundColor: colors.destructive, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
              <T variant="label" color={colors.destructiveFg}>✕ {t('flashcards.session.forgot')}</T>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </View>

      {error ? <T variant="small" color={colors.destructive}>{error}</T> : null}

      {revealed ? (
        <Row style={{ flexWrap: 'nowrap' }}>
          <Button title={t('flashcards.session.forgot')} variant="outline" onPress={() => swipeButton(false)} disabled={busy} style={{ flex: 1 }} icon={<Ionicons name="close" size={20} color={colors.foreground} />} />
          <Button title={t('flashcards.session.remembered')} onPress={() => swipeButton(true)} disabled={busy} style={{ flex: 1 }} icon={<Ionicons name="checkmark" size={20} color={colors.primaryFg} />} />
        </Row>
      ) : (
        <Button title={t('flashcards.session.flip')} onPress={() => setRevealed(true)} />
      )}
    </Screen>
  );
}
