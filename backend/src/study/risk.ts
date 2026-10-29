// src/study/risk.ts — alerta de risco de evasão: quem precisa de atenção do professor, e por quê
//
// Três sinais simples e explicáveis (nada de caixa-preta): sem atividade há dias, notas em queda e tarefas atrasadas.
// A atividade conta tentativas de quiz/tarefa; o tempo de estudo só entra se o aluno autorizou o professor a ver.
const DAY_MS = 24 * 60 * 60 * 1000;

export const INACTIVE_DAYS = 7;
export const SEVERE_INACTIVE_DAYS = 14;
export const FALLING_POINTS = 10;
const WINDOW_DAYS = 14;

export type RiskFlag = 'inactive' | 'falling' | 'overdue';

export interface RiskStudentInput {
  id: string;
  name: string;
  /** quando a conta entrou (alunos novos não são "inativos" no primeiro dia) */
  joinedAt: Date;
  attempts: { score: number; at: Date }[];
  /** só preenchido quando o aluno compartilha o tempo de estudo com o professor */
  lastSessionAt?: Date | null;
  overdueTasks: number;
}

export interface RiskRow {
  studentId: string;
  name: string;
  level: 'high' | 'medium';
  flags: RiskFlag[];
  /** dias sem atividade (null = nunca teve atividade desde que entrou, contando a partir da entrada) */
  daysInactive: number;
  trend: { recent: number; previous: number } | null;
  overdueTasks: number;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function assessRisk(students: RiskStudentInput[], now: Date): RiskRow[] {
  const rows: RiskRow[] = [];
  for (const s of students) {
    const last = Math.max(s.joinedAt.getTime(), ...s.attempts.map((a) => a.at.getTime()), s.lastSessionAt ? s.lastSessionAt.getTime() : 0);
    const daysInactive = Math.max(0, Math.floor((now.getTime() - last) / DAY_MS));

    const recent = s.attempts.filter((a) => now.getTime() - a.at.getTime() <= WINDOW_DAYS * DAY_MS).map((a) => a.score);
    const previous = s.attempts.filter((a) => {
      const age = now.getTime() - a.at.getTime();
      return age > WINDOW_DAYS * DAY_MS && age <= 2 * WINDOW_DAYS * DAY_MS;
    }).map((a) => a.score);
    const trend = recent.length && previous.length ? { recent: Math.round(avg(recent)), previous: Math.round(avg(previous)) } : null;

    const flags: RiskFlag[] = [];
    if (daysInactive >= INACTIVE_DAYS) flags.push('inactive');
    if (trend && trend.previous - trend.recent >= FALLING_POINTS) flags.push('falling');
    if (s.overdueTasks > 0) flags.push('overdue');
    if (flags.length === 0) continue;

    rows.push({
      studentId: s.id, name: s.name, flags, daysInactive, trend, overdueTasks: s.overdueTasks,
      level: flags.length >= 2 || daysInactive >= SEVERE_INACTIVE_DAYS ? 'high' : 'medium',
    });
  }
  return rows.sort((a, b) => (a.level === b.level ? b.daysInactive - a.daysInactive : a.level === 'high' ? -1 : 1) || a.name.localeCompare(b.name));
}
