// Resolve um quiz, uma pergunta por tela. No treino a correção aparece na hora; em tarefas só depois de enviar tudo.
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import type { PublicQuestion, QuestionResult } from '@/types';
import { Badge, Button, Card, Field, ProgressBar, Row, T } from '@/ui';

interface QuizPlayerProps {
  draftId: string;
  questions: PublicQuestion[];
  /** pergunta em que o aluno parou (retomada de tarefa) */
  startIndex?: number;
  taskMode?: boolean;
  onComplete: (summary: { attemptId: string; score: number; correctCount: number; total: number }) => void;
}

type Answer = number | string | string[];

export function QuizPlayer({ draftId, questions, startIndex = 0, taskMode = false, onComplete }: QuizPlayerProps) {
  const { t } = useTranslation();
  const { colors, fs } = useTheme();
  const [index, setIndex] = useState(startIndex);
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [blanks, setBlanks] = useState<string[]>([]);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const q = questions[index];
  const isLast = index + 1 >= questions.length;
  const isFill = q.type === 'fill_blank';
  const blankCount = q.blanks ?? 0;
  const filledBlanks = Array.from({ length: blankCount }, (_, i) => blanks[i] ?? '');

  const answer = (): Answer | null => {
    if (q.type === 'multiple_choice') return choice;
    if (isFill) return filledBlanks.some((b) => b.trim()) ? filledBlanks.map((b) => b.trim()) : null;
    return text.trim() ? text.trim() : null;
  };

  const reset = () => { setChoice(null); setText(''); setBlanks([]); setResult(null); setError(''); };

  const finish = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/quizz/drafts/${draftId}/finish`);
      onComplete(data);
    } catch {
      setError(t('quiz.saveError'));
      setBusy(false);
    }
  };

  const advance = () => {
    if (isLast) return finish();
    setIndex((i) => i + 1);
    reset();
  };

  const submit = async () => {
    const value = answer();
    if (value === null) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post<{ result?: QuestionResult; saved?: boolean }>(`/quizz/drafts/${draftId}/answer`, { index, answer: value });
      if (data.result) { setResult(data.result); setBusy(false); return; }
      // tarefa: sem correção na hora, vai direto para a próxima
      setBusy(false);
      advance();
    } catch {
      setError(t('quiz.answerError'));
      setBusy(false);
    }
  };

  const verdict = result
    ? result.correct ? { text: t('quiz.verdictCorrect'), variant: 'success' as const }
    : result.score > 0 ? { text: t('quiz.verdictPartial', { pct: Math.round(result.score * 100) }), variant: 'warning' as const }
    : { text: t('quiz.verdictWrong'), variant: 'destructive' as const }
    : null;

  const inputStyle = { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground, paddingHorizontal: 14, paddingVertical: 12, fontSize: fs(16) };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="label">{t('quiz.questionOf', { current: index + 1, total: questions.length })}</T>
          <Row>
            {q.reinforcement && <Badge variant="warning">{t('quiz.reinforcement')}</Badge>}
            <Badge variant="primary">{t(`quiz.types.${q.type}`)}</Badge>
          </Row>
        </Row>
        <ProgressBar value={index + (result ? 1 : 0)} max={questions.length} label={t('quiz.questionOf', { current: index + 1, total: questions.length })} />
      </View>

      {q.scenario ? <Card style={{ backgroundColor: colors.secondary }}><T variant="muted">{q.scenario}</T></Card> : null}
      <T variant="heading" selectable>{q.question}</T>

      {q.type === 'multiple_choice' && (
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          {(q.options ?? []).map((option, i) => {
            const revealed = !!result;
            const isCorrect = revealed && i === result?.correctIndex;
            const isWrongPick = revealed && i === choice && i !== result?.correctIndex;
            const selected = choice === i;
            const border = isCorrect ? colors.success : isWrongPick ? colors.destructive : selected ? colors.primary : colors.border;
            const letter = String.fromCharCode(65 + i);
            return (
              <Pressable
                key={i} disabled={revealed || busy} onPress={() => setChoice(i)} accessibilityRole="radio"
                accessibilityLabel={`${letter}: ${option}${isCorrect ? ` (${t('quiz.verdictCorrect')})` : isWrongPick ? ` (${t('quiz.verdictWrong')})` : ''}`}
                accessibilityState={{ selected, disabled: revealed }}
                style={{ minHeight: 52, borderRadius: 14, borderWidth: 2, borderColor: border, backgroundColor: selected && !revealed ? colors.accent : colors.card, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: revealed && !isCorrect && !isWrongPick ? 0.6 : 1 }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: border, alignItems: 'center', justifyContent: 'center', backgroundColor: isCorrect ? colors.success : isWrongPick ? colors.destructive : 'transparent' }}>
                  {isCorrect ? <Ionicons name="checkmark" size={18} color={colors.card} /> : isWrongPick ? <Ionicons name="close" size={18} color={colors.destructiveFg} /> : <T variant="small">{letter}</T>}
                </View>
                <T variant="body" style={{ flex: 1 }}>{option}</T>
              </Pressable>
            );
          })}
        </View>
      )}

      {isFill && (
        <View style={{ gap: 12 }}>
          {filledBlanks.map((value, i) => (
            <Field
              key={i} label={t('quiz.blankN', { n: i + 1 })} value={value} editable={!result && !busy} autoCapitalize="none"
              onChangeText={(v) => setBlanks((prev) => Array.from({ length: blankCount }, (_, j) => (j === i ? v : prev[j] ?? '')))}
            />
          ))}
        </View>
      )}

      {(q.type === 'open_text' || q.type === 'real_case' || (q.type === 'practical' && !q.numeric)) && (
        <TextInput
          value={text} onChangeText={setText} multiline editable={!result && !busy} placeholder={t('quiz.writeHere')} placeholderTextColor={colors.mutedFg}
          accessibilityLabel={t('quiz.yourAnswer')} style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
        />
      )}

      {q.type === 'practical' && q.numeric && (
        <Field label={t('quiz.yourAnswer')} hint={t('quiz.numericHint')} value={text} onChangeText={setText} keyboardType="numbers-and-punctuation" editable={!result && !busy} />
      )}

      {result && verdict && (
        <Card style={{ gap: 8, borderColor: result.correct ? colors.success : result.score > 0 ? colors.warning : colors.destructive, borderWidth: 2 }} >
          <Badge variant={verdict.variant}>{verdict.text}</Badge>
          {result.feedback ? <T variant="body">{result.feedback}</T> : null}
          {!result.correct && (
            <View>
              <T variant="small">{t('quiz.expected')}</T>
              <T variant="label" selectable>{result.correctAnswer}</T>
            </View>
          )}
          {result.explanation ? (
            <View>
              <T variant="small">{t('quiz.explanation')}</T>
              <T variant="body" selectable>{result.explanation}</T>
            </View>
          ) : null}
        </Card>
      )}

      {error ? <T variant="small" color={colors.destructive} accessibilityLiveRegion="polite">{error}</T> : null}

      {result ? (
        <Button title={isLast ? t('quiz.seeResult') : t('quiz.next')} onPress={advance} loading={busy} />
      ) : (
        <Button
          title={taskMode && isLast ? t('quiz.finish') : t('quiz.answer')} onPress={submit} loading={busy} disabled={answer() === null}
        />
      )}
    </View>
  );
}
