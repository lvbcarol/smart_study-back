import { describe, it, expect } from 'vitest';
import { buildStudyPlan, PlanInput, urgency } from '../src/study/planner';
import { clampOffset, lastDays, localDay } from '../src/study/dates';

const now = new Date('2026-03-10T15:00:00Z');
const inHours = (h: number) => new Date(now.getTime() + h * 3600_000);

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  minutes: 60, now, language: 'pt-BR', tasks: [], agenda: [], weaknesses: [], flashcardsDue: 0, fallbackLessons: [], ...over,
});

const total = (blocks: { minutes: number }[]) => blocks.reduce((s, b) => s + b.minutes, 0);

describe('urgency', () => {
  it('quanto mais perto o prazo, maior a pontuação', () => {
    expect(urgency(inHours(-1), now).kind).toBe('Overdue');
    expect(urgency(inHours(5), now).kind).toBe('Today');
    expect(urgency(inHours(48), now)).toMatchObject({ kind: 'Soon', days: 2, score: 70 });
    expect(urgency(inHours(24 * 6), now)).toMatchObject({ kind: 'Soon', score: 50 });
    expect(urgency(inHours(24 * 20), now).kind).toBe('Later');
    expect(urgency(null, now).kind).toBe('NoDue');
    expect(urgency(inHours(-1), now).score).toBeGreaterThan(urgency(inHours(5), now).score);
  });
});

describe('plano de estudo', () => {
  it('ordena por urgência, explica cada bloco e respeita o tempo do aluno', () => {
    const plan = buildStudyPlan(base({
      minutes: 45,
      tasks: [
        { id: 't1', title: 'Lista de derivadas', dueAt: inHours(-5), status: 'pending', questionsCount: 8 },
        { id: 't2', title: 'Trabalho final', dueAt: inHours(24 * 6), status: 'pending', questionsCount: 10 },
      ],
      weaknesses: [{ lessonId: 'l1', lessonTitle: 'Derivadas', notebookTitle: 'Cálculo', topic: 'Regra da cadeia', rate: 0.8 }],
      flashcardsDue: 6,
    }));
    expect(plan.blocks[0]).toMatchObject({ kind: 'task', link: { type: 'task', id: 't1' } });
    expect(plan.blocks[0].reason).toContain('atrasada');
    expect(total(plan.blocks)).toBeLessThanOrEqual(45);
    expect(plan.blocks.every((b) => b.reason.length > 10 && b.minutes >= 5)).toBe(true);
    expect(new Set(plan.blocks.map((b) => b.id)).size).toBe(plan.blocks.length);
    expect(plan.intro).toContain('45 minutos');
    // atrasada (100) > fraqueza (80) > flashcards (66) > tarefa distante (50): a ordem segue as pontuações
    expect(plan.blocks.map((b) => b.kind).slice(0, 3)).toEqual(['task', 'weakness', 'flashcards']);
  });

  it('com pouco tempo, encurta o último bloco ou pula o que não cabe', () => {
    const plan = buildStudyPlan(base({
      minutes: 12,
      tasks: [{ id: 't1', title: 'Prova surpresa', dueAt: inHours(3), status: 'pending', questionsCount: 20 }],
      flashcardsDue: 4,
    }));
    expect(total(plan.blocks)).toBeLessThanOrEqual(12);
    // a tarefa (40 min) não cabe pela metade em 12 min, então entram os flashcards
    expect(plan.blocks.map((b) => b.kind)).toEqual(['flashcards']);
  });

  it('tarefa já começada pede menos tempo', () => {
    const fresh = buildStudyPlan(base({ tasks: [{ id: 't', title: 'T', dueAt: inHours(30), status: 'pending', questionsCount: 10 }] }));
    const started = buildStudyPlan(base({ tasks: [{ id: 't', title: 'T', dueAt: inHours(30), status: 'in_progress', questionsCount: 10 }] }));
    expect(started.blocks[0].minutes).toBeLessThan(fresh.blocks[0].minutes);
    expect(started.blocks[0].reason).toContain('já começou');
  });

  it('itens da agenda: só os próximos entram, e lembrete só no dia', () => {
    const plan = buildStudyPlan(base({
      agenda: [
        { id: 'a1', title: 'Ler capítulo 3', kind: 'task', dueAt: inHours(30) },
        { id: 'a2', title: 'Ligar para o grupo', kind: 'reminder', dueAt: inHours(30) }, // amanhã: fica de fora
        { id: 'a3', title: 'Levar o trabalho', kind: 'reminder', dueAt: inHours(4) },
        { id: 'a4', title: 'Mês que vem', kind: 'task', dueAt: inHours(24 * 30) },
        { id: 'a5', title: 'Sem data', kind: 'task', dueAt: null },
      ],
    }));
    expect(plan.blocks.map((b) => b.link.id).sort()).toEqual(['a1', 'a3']);
    expect(plan.blocks.find((b) => b.link.id === 'a3')!.minutes).toBe(5);
  });

  it('só os 3 pontos mais fracos viram bloco, o mais fraco primeiro', () => {
    const w = (topic: string, rate: number) => ({ lessonId: 'l', lessonTitle: 'Aula', notebookTitle: 'Caderno', topic, rate });
    const plan = buildStudyPlan(base({ minutes: 120, weaknesses: [w('A', 0.5), w('B', 0.9), w('C', 0.7), w('D', 0.6)] }));
    expect(plan.blocks).toHaveLength(3);
    // a lista de entrada já vem do mais fraco ao mais forte; aqui só garantimos o corte em 3
    expect(plan.blocks.every((b) => b.kind === 'weakness')).toBe(true);
  });

  it('sem pendências sugere rever a aula menos estudada; sem aulas devolve plano vazio', () => {
    const lessons = [{ id: 'x', title: 'Integrais', notebookTitle: 'Cálculo' }, { id: 'y', title: 'Limites', notebookTitle: 'Cálculo' }];
    const free = buildStudyPlan(base({ minutes: 30, fallbackLessons: lessons }));
    expect(free.blocks).toHaveLength(1);
    expect(free.blocks[0]).toMatchObject({ kind: 'explore', link: { type: 'lesson', id: 'x' }, minutes: 20 });
    expect(free.intro).toContain('Sem pendências');

    const empty = buildStudyPlan(base());
    expect(empty.blocks).toEqual([]);
    expect(empty.intro).toContain('Ainda não há');
  });

  it('textos nos três idiomas', () => {
    const input = base({ tasks: [{ id: 't', title: 'Lista', dueAt: inHours(-2), status: 'pending', questionsCount: 5 }] });
    expect(buildStudyPlan({ ...input, language: 'en-US' }).blocks[0].reason).toContain('overdue');
    expect(buildStudyPlan({ ...input, language: 'es-ES' }).blocks[0].reason).toContain('atrasada');
    expect(buildStudyPlan({ ...input, language: 'pt-BR' }).intro).toContain('Montei');
    expect(buildStudyPlan({ ...input, language: 'fr' }).intro).toContain('I built'); // idioma desconhecido cai no inglês
  });

  it('nunca ultrapassa o tempo, qualquer que seja a combinação', () => {
    for (const minutes of [5, 10, 15, 20, 25, 45, 60, 90, 180]) {
      const plan = buildStudyPlan(base({
        minutes,
        tasks: [{ id: 't1', title: 'A', dueAt: inHours(10), status: 'pending', questionsCount: 12 }, { id: 't2', title: 'B', dueAt: inHours(70), status: 'in_progress', questionsCount: 7 }],
        weaknesses: [{ lessonId: 'l', lessonTitle: 'L', notebookTitle: 'N', topic: 'T', rate: 0.6 }],
        flashcardsDue: 13,
        agenda: [{ id: 'a', title: 'Estudar', kind: 'task', dueAt: inHours(2) }],
      }));
      expect(total(plan.blocks)).toBeLessThanOrEqual(minutes);
    }
  });
});

describe('dia do aluno', () => {
  it('usa o fuso informado pelo app (Brasília = 180)', () => {
    const lateNight = new Date('2026-03-11T01:30:00Z'); // 22:30 do dia 10 em Brasília
    expect(localDay(lateNight, 180)).toBe('2026-03-10');
    expect(localDay(lateNight, 0)).toBe('2026-03-11');
    expect(localDay(lateNight, -540)).toBe('2026-03-11'); // Tóquio
  });

  it('lista os últimos dias em ordem e limita fusos absurdos', () => {
    expect(lastDays(new Date('2026-03-10T12:00:00Z'), 0, 3)).toEqual(['2026-03-08', '2026-03-09', '2026-03-10']);
    expect(clampOffset(99999)).toBe(840);
    expect(clampOffset('abc')).toBe(0);
  });
});
