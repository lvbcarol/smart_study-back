// Revisão pergunta a pergunta de uma tentativa já enviada
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AnswerValue, PublicQuestion, QuestionResult } from '@/types';
import { Badge, Card, Row, T } from '@/ui';

interface Props { questions: PublicQuestion[]; answers: AnswerValue[]; results: QuestionResult[] }

export function AttemptReview({ questions, answers, results }: Props) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 12 }}>
      {questions.map((q, i) => {
        const a = answers[i];
        const r = results[i];
        const answerText = a === null || a === undefined ? t('quiz.noAnswer')
          : q.type === 'multiple_choice' ? (q.options?.[a as number] ?? '')
          : Array.isArray(a) ? a.map((x) => x || '—').join(' · ') : String(a);
        const pct = r ? Math.round(r.score * 100) : 0;
        const variant = r?.correct ? 'success' : r && r.score > 0 ? 'warning' : 'destructive';
        const verdict = r?.correct ? t('quiz.verdictCorrect') : r && r.score > 0 ? t('quiz.verdictPartial', { pct }) : t('quiz.verdictWrong');
        return (
          <Card key={q.id ?? i} style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <T variant="label">{i + 1}.</T>
                <Badge variant="primary">{t(`quiz.types.${q.type}`)}</Badge>
                {q.reinforcement && <Badge variant="warning">{t('quiz.reinforcement')}</Badge>}
              </Row>
              <Badge variant={variant}>{verdict}</Badge>
            </Row>
            {q.scenario ? <T variant="muted">{q.scenario}</T> : null}
            <T variant="label">{q.question}</T>
            <View><T variant="small">{t('quiz.yourAnswer')}</T><T variant="body">{answerText}</T></View>
            {r && !r.correct && <View><T variant="small">{t('quiz.expected')}</T><T variant="body">{r.correctAnswer}</T></View>}
            {r?.feedback ? <View><T variant="small">{t('quiz.feedback')}</T><T variant="body">{r.feedback}</T></View> : null}
            {r?.explanation ? <View><T variant="small">{t('quiz.explanation')}</T><T variant="body">{r.explanation}</T></View> : null}
          </Card>
        );
      })}
    </View>
  );
}
