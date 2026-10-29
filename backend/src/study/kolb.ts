// src/study/kolb.ts — perfil de aprendizagem dinâmico (ciclo de Kolb) inferido do comportamento do aluno
//
// Em vez de um questionário estático, o perfil sai do que o aluno faz: que tipos de pergunta responde e que
// atividades de estudo usa. O mapeamento é fixo e aparece na tela ("por quê?"), então o aluno e o professor
// entendem de onde vem cada número (transparência) e o aluno pode ocultar o perfil.
//
//   EC Experiência Concreta   -> perguntas de caso real
//   OR Observação Reflexiva   -> leitura de resumos e conversa com o assistente
//   CA Conceituação Abstrata  -> múltipla escolha, completar, dissertativa, flashcards (conceitos)
//   EA Experimentação Ativa   -> perguntas práticas
//
// Estilos (Kolb): Divergente = EC+OR, Assimilador = OR+CA, Convergente = CA+EA, Acomodador = EA+EC.
import type { QuestionType } from '../quiz/questions';

export type KolbQuadrant = 'EC' | 'OR' | 'CA' | 'EA';
export type KolbStyle = 'diverging' | 'assimilating' | 'converging' | 'accommodating';
export const KOLB_QUADRANTS: KolbQuadrant[] = ['EC', 'OR', 'CA', 'EA'];

export const TYPE_QUADRANT: Record<QuestionType, KolbQuadrant> = {
  multiple_choice: 'CA', fill_blank: 'CA', open_text: 'CA', practical: 'EA', real_case: 'EC',
};
/** Atividades de estudo que contam como prática de um quadrante (quiz e tarefa já entram pelas perguntas respondidas). */
export const KIND_QUADRANT: Record<string, KolbQuadrant | undefined> = { summary: 'OR', flashcards: 'CA' };

/** 2 minutos de leitura/estudo pesam como 1 pergunta respondida */
export const MINUTES_PER_ANSWER = 2;
/** abaixo disso não há dados suficientes para rotular o estilo */
export const MIN_WEIGHT = 10;
/** quadrante com menos que isso do total é considerado "pouco praticado" */
export const GAP_SHARE = 0.15;

export interface KolbInput {
  /** perguntas respondidas por tipo (já com decaimento por recência) e quantas foram erradas */
  byType: Partial<Record<QuestionType, { seen: number; wrong: number }>>;
  /** minutos de estudo por tipo de atividade nos últimos 30 dias */
  minutesByKind: Record<string, number>;
}

export interface KolbQuadrantStat {
  id: KolbQuadrant;
  /** fatia da prática total (0..1) */
  share: number;
  /** acerto (0..1) nas perguntas do quadrante; null quando não há perguntas (ex.: Observação Reflexiva) */
  accuracy: number | null;
  /** evidências mostradas no "por quê?" */
  answers: number;
  minutes: number;
}

export interface KolbProfile {
  quadrants: KolbQuadrantStat[];
  /** null enquanto não há dados suficientes */
  style: KolbStyle | null;
  enough: boolean;
  /** quadrante menos praticado (só quando há dados suficientes) */
  weakest: KolbQuadrant | null;
  hasGap: boolean;
  totalWeight: number;
}

export function computeKolb(input: KolbInput): KolbProfile {
  const answers: Record<KolbQuadrant, number> = { EC: 0, OR: 0, CA: 0, EA: 0 };
  const wrong: Record<KolbQuadrant, number> = { EC: 0, OR: 0, CA: 0, EA: 0 };
  const minutes: Record<KolbQuadrant, number> = { EC: 0, OR: 0, CA: 0, EA: 0 };

  for (const [type, stat] of Object.entries(input.byType) as [QuestionType, { seen: number; wrong: number }][]) {
    const q = TYPE_QUADRANT[type];
    if (!q) continue;
    answers[q] += stat.seen;
    wrong[q] += stat.wrong;
  }
  for (const [kind, min] of Object.entries(input.minutesByKind)) {
    const q = KIND_QUADRANT[kind];
    if (q) minutes[q] += min;
  }

  const weight = (q: KolbQuadrant) => answers[q] + minutes[q] / MINUTES_PER_ANSWER;
  const total = KOLB_QUADRANTS.reduce((s, q) => s + weight(q), 0);
  const enough = total >= MIN_WEIGHT;
  const share = (q: KolbQuadrant) => (total > 0 ? weight(q) / total : 0);

  const quadrants: KolbQuadrantStat[] = KOLB_QUADRANTS.map((id) => ({
    id,
    share: Math.round(share(id) * 1000) / 1000,
    accuracy: answers[id] > 0 ? Math.round((1 - wrong[id] / answers[id]) * 1000) / 1000 : null,
    answers: Math.round(answers[id] * 10) / 10,
    minutes: Math.round(minutes[id]),
  }));

  let style: KolbStyle | null = null;
  let weakest: KolbQuadrant | null = null;
  if (enough) {
    const perception = share('CA') - share('EC'); // concreto (-) x abstrato (+)
    const processing = share('EA') - share('OR'); // observar (-) x agir (+)
    style = perception >= 0 ? (processing >= 0 ? 'converging' : 'assimilating') : (processing >= 0 ? 'accommodating' : 'diverging');
    weakest = [...KOLB_QUADRANTS].sort((a, b) => share(a) - share(b))[0];
  }
  return { quadrants, style, enough, weakest, hasGap: !!weakest && share(weakest) < GAP_SHARE, totalWeight: Math.round(total * 10) / 10 };
}
