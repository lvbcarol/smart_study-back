// src/components/NudgesCard.tsx — lembretes motivacionais contextuais na Home do aluno (dispensáveis)
import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface Nudge { id: string; kind: string; params: Record<string, string | number> }

const NudgesCard: React.FC = () => {
  const { t } = useTranslation();
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<{ nudges: Nudge[] }>('/study/nudges', { params: { tzOffset: new Date().getTimezoneOffset() } })
      .then((r) => setNudges(r.data.nudges)).catch(() => setNudges([]));
  }, []);

  const visible = nudges.filter((n) => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  return (
    <section aria-label={t('nudge.title')} className="space-y-2">
      {visible.map((n) => (
        <p key={n.id} role="status" className="flex items-start gap-3 rounded-2xl border border-border bg-accent px-4 py-3 text-accent-foreground">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="flex-1 font-medium">{t(`nudge.${n.kind}`, n.params)}</span>
          <button type="button" onClick={() => setDismissed((d) => new Set(d).add(n.id))} aria-label={t('nudge.dismiss')} className="rounded-md p-1 hover:bg-background/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </p>
      ))}
    </section>
  );
};

export default NudgesCard;
