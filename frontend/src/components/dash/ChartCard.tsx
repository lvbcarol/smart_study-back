// src/components/dash/ChartCard.tsx — cartão de gráfico com a mesma informação também em tabela (acessibilidade)
import React, { useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ds/Button';

export const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };
export const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  color: 'hsl(var(--foreground))',
};
export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** Cor fixa por posição (identidade estável): chart-1 ... chart-5 */
export const chartColor = (i: number) => `hsl(var(--chart-${(i % 5) + 1}))`;

interface ChartCardProps {
  title: string;
  description?: string;
  /** mesma informação do gráfico, em tabela */
  table: React.ReactNode;
  /** sem dados: mostra só esta mensagem */
  empty?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, description, table, empty, children, actions }) => {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useState(false);
  return (
    <section aria-label={title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {!empty && (
            <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
              {asTable ? <BarChart3 className="h-4 w-4" aria-hidden="true" /> : <Table2 className="h-4 w-4" aria-hidden="true" />}
              {asTable ? t('dash.viewChart') : t('dash.viewTable')}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4">{empty ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{empty}</p> : asTable ? <div className="overflow-x-auto">{table}</div> : children}</div>
    </section>
  );
};

export const DataTable: React.FC<{ caption: string; head: string[]; rows: (string | number)[][] }> = ({ caption, head, rows }) => (
  <table className="w-full text-left text-sm">
    <caption className="sr-only">{caption}</caption>
    <thead><tr>{head.map((h) => <th key={h} scope="col" className="border-b border-border px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-border px-3 py-2">{c}</td>)}</tr>)}</tbody>
  </table>
);
