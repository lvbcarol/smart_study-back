// src/components/quiz/WeaknessPanel.tsx — pontos fracos do aluno (por tipo de pergunta e por tópico)
import React, { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { WeaknessData } from '../../types/quiz';
import { Badge, EmptyState, Skeleton } from '../ds/Misc';
import { cn } from '@/lib/utils';

const tone = (rate: number) => (rate >= 60 ? 'bg-destructive' : rate >= 40 ? 'bg-warning' : 'bg-success');

const WeaknessPanel: React.FC<{ lessonId?: string }> = ({ lessonId }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<WeaknessData | null>(null);

  useEffect(() => {
    api.get<WeaknessData>('/quizz/weakness', { params: lessonId ? { lessonId } : {} })
      .then((r) => setData(r.data))
      .catch(() => setData({ types: [], topics: [] }));
  }, [lessonId]);

  if (data === null) return <Skeleton className="h-40" />;
  if (data.types.length === 0) {
    return <EmptyState icon={<Target className="h-6 w-6" />} title={t('weakness.emptyTitle')} description={t('weakness.emptyDesc')} />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section aria-labelledby="weak-types">
        <h3 id="weak-types" className="mb-1 font-display text-lg font-bold">{t('weakness.byType')}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t('weakness.byTypeDesc')}</p>
        <ul className="space-y-3">
          {data.types.map((row) => (
            <li key={row.type}>
              <div className="mb-1 flex justify-between text-sm font-medium">
                <span>{t(`quizzPage.types.${row.type}`)}</span>
                <span>{t('weakness.errorRate', { rate: row.errorRate })}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary" role="presentation">
                <div className={cn('h-full rounded-full', tone(row.errorRate))} style={{ width: `${row.errorRate}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="weak-topics">
        <h3 id="weak-topics" className="mb-1 font-display text-lg font-bold">{t('weakness.byTopic')}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t('weakness.byTopicDesc')}</p>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.topics.map((row, i) => (
            <li key={`${row.topic}-${row.type}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.topic}</span>
                <span className="text-xs text-muted-foreground">{t(`quizzPage.types.${row.type}`)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {row.needsReview && <Badge variant="warning">{t('weakness.review')}</Badge>}
                <Badge variant={row.errorRate >= 60 ? 'destructive' : row.errorRate >= 40 ? 'warning' : 'success'}>{row.errorRate}%</Badge>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default WeaknessPanel;
