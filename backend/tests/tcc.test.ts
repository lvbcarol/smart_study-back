import { describe, it, expect } from 'vitest';
import { computeKolb, GAP_SHARE, MIN_WEIGHT } from '../src/study/kolb';
import { assessRisk } from '../src/study/risk';
import { buildNudges } from '../src/study/nudges';
import { buildStudyPlan } from '../src/study/planner';
import { DEFAULT_BLOOM, normalizeQuestion, questionSchema } from '../src/quiz/questions';

describe('perfil de Kolb', () => {
  const ans = (seen: number, wrong = 0) => ({ seen, wrong });

  it('sem dados suficientes não rotula o estilo', () => {
    const k = computeKolb({ byType: { multiple_choice: ans(3) }, minutesByKind: { summary: 4 } });
    expect(k.enough).toBe(false);
    expect(k.style).toBeNull();
    expect(k.weakest).toBeNull();
    expect(k.hasGap).toBe(false);
    expect(k.totalWeight).toBe(5); // 3 respostas + 4 min / 2
  });

  it('mapeia cada atividade ao seu quadrante e mostra as evidências', () => {
    const k = computeKolb({
      byType: { multiple_choice: ans(6, 3), fill_blank: ans(2), open_text: ans(2), practical: ans(4, 4), real_case: ans(2, 1) },
      minutesByKind: { summary: 20, flashcards: 10, quiz: 99, manual: 99 }, // quiz e manual não contam por tempo
    });
    const q = Object.fromEntries(k.quadrants.map((x) => [x.id, x]));
    expect(q.CA.answers).toBe(10); // 6 + 2 + 2
    expect(q.CA.minutes).toBe(10); // flashcards
    expect(q.OR.minutes).toBe(20); // resumo
    expect(q.OR.accuracy).toBeNull(); // não há perguntas de reflexão
    expect(q.EA.accuracy).toBe(0);
    expect(q.EC.accuracy).toBe(0.5);
    expect(q.CA.accuracy).toBe(0.7); // 3 erros em 10
    expect(k.quadrants.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 2);
  });

  it('classifica os quatro estilos', () => {
    const style = (byType: Parameters<typeof computeKolb>[0]['byType'], minutes = 0) => computeKolb({ byType, minutesByKind: { summary: minutes } }).style;
    expect(style({ multiple_choice: ans(20) }, 0)).toBe('converging'); // só abstrato, sem leitura: CA domina, OR zerada, EA zerada -> processing 0 => converging
    expect(style({ multiple_choice: ans(12) }, 30)).toBe('assimilating'); // abstrato + reflexivo
    expect(style({ real_case: ans(12) }, 30)).toBe('diverging'); // concreto + reflexivo
    expect(style({ real_case: ans(6), practical: ans(10) }, 0)).toBe('accommodating'); // concreto + ação
    expect(style({ multiple_choice: ans(6), practical: ans(10) }, 0)).toBe('converging'); // abstrato + ação
  });

  it('aponta o quadrante menos praticado quando há lacuna', () => {
    const k = computeKolb({ byType: { multiple_choice: ans(30), practical: ans(10), real_case: ans(3) }, minutesByKind: { summary: 4 } });
    expect(k.enough).toBe(true);
    expect(k.weakest).toBe('OR');
    expect(k.hasGap).toBe(true);
    const balanced = computeKolb({ byType: { multiple_choice: ans(5), practical: ans(5), real_case: ans(5) }, minutesByKind: { summary: 10 } });
    expect(balanced.hasGap).toBe(false);
    expect(GAP_SHARE).toBeLessThan(0.25);
    expect(MIN_WEIGHT).toBeGreaterThan(0);
  });
});

describe('alerta de risco', () => {
  const now = new Date('2026-03-30T12:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400_000);
  const student = (over: Partial<Parameters<typeof assessRisk>[0][number]> & { id: string }) => ({
    name: over.id, joinedAt: daysAgo(60), attempts: [], overdueTasks: 0, ...over,
  });

  it('só devolve quem tem algum sinal, do mais grave ao menos grave', () => {
    const rows = assessRisk([
      student({ id: 'ok', attempts: [{ score: 80, at: daysAgo(2) }] }),
      student({ id: 'inativo', attempts: [{ score: 80, at: daysAgo(9) }] }),
      student({ id: 'sumido', attempts: [{ score: 80, at: daysAgo(20) }] }),
    ], now);
    expect(rows.map((r) => r.studentId)).toEqual(['sumido', 'inativo']);
    expect(rows[0]).toMatchObject({ level: 'high', flags: ['inactive'], daysInactive: 20 });
    expect(rows[1]).toMatchObject({ level: 'medium', flags: ['inactive'], daysInactive: 9 });
  });

  it('notas em queda e tarefa atrasada, juntas, viram risco alto', () => {
    const rows = assessRisk([student({
      id: 'caindo', overdueTasks: 2,
      attempts: [{ score: 90, at: daysAgo(20) }, { score: 80, at: daysAgo(18) }, { score: 50, at: daysAgo(3) }, { score: 60, at: daysAgo(1) }],
    })], now);
    expect(rows[0].flags).toEqual(['falling', 'overdue']);
    expect(rows[0].trend).toEqual({ recent: 55, previous: 85 });
    expect(rows[0].level).toBe('high');
  });

  it('queda pequena não alerta, e sem período anterior não há tendência', () => {
    const small = assessRisk([student({ id: 'a', attempts: [{ score: 80, at: daysAgo(20) }, { score: 75, at: daysAgo(2) }] })], now);
    expect(small).toEqual([]);
    const noPrev = assessRisk([student({ id: 'b', overdueTasks: 1, attempts: [{ score: 10, at: daysAgo(1) }] })], now);
    expect(noPrev[0].trend).toBeNull();
  });

  it('aluno recém-chegado não é "inativo", mas o tempo de estudo compartilhado conta como atividade', () => {
    const fresh = assessRisk([student({ id: 'novo', joinedAt: daysAgo(2) })], now);
    expect(fresh).toEqual([]);
    const old = assessRisk([student({ id: 'velho', joinedAt: daysAgo(40) })], now);
    expect(old[0]).toMatchObject({ flags: ['inactive'], daysInactive: 40, level: 'high' });
    const studying = assessRisk([student({ id: 'estuda', joinedAt: daysAgo(40), lastSessionAt: daysAgo(1) })], now);
    expect(studying).toEqual([]);
  });
});

describe('lembretes motivacionais', () => {
  const now = new Date('2026-03-30T12:00:00Z');
  const base = { now, streakDays: 0, goalMinutes: 0, weekMinutes: 0, pendingTasks: [], daysSinceActivity: 0 as number | null, flashcardsDue: 0 };
  const kinds = (over: Partial<typeof base>) => buildNudges({ ...base, ...over }).map((n) => n.kind);

  it('sem motivo, sem lembrete', () => {
    expect(kinds({})).toEqual([]);
  });

  it('tarefa atrasada e tarefa para as próximas 24 h', () => {
    const tasks = [
      { id: 'a', title: 'Lista 1', dueAt: new Date(now.getTime() - 3600_000) },
      { id: 'b', title: 'Lista 2', dueAt: new Date(now.getTime() + 5 * 3600_000) },
      { id: 'c', title: 'Lista 3', dueAt: new Date(now.getTime() + 5 * 86400_000) },
    ];
    const n = buildNudges({ ...base, pendingTasks: tasks });
    expect(n.map((x) => x.kind)).toEqual(['taskOverdue', 'taskDue']);
    expect(n[0].params).toEqual({ title: 'Lista 1' });
  });

  it('meta perto, meta batida, sequência e volta', () => {
    expect(buildNudges({ ...base, goalMinutes: 300, weekMinutes: 240 })[0]).toMatchObject({ kind: 'goalClose', params: { left: 60 } });
    expect(kinds({ goalMinutes: 300, weekMinutes: 100 })).toEqual([]);
    expect(kinds({ goalMinutes: 300, weekMinutes: 300 })).toEqual(['goalDone']);
    expect(kinds({ streakDays: 4 })).toEqual(['streak']);
    expect(kinds({ daysSinceActivity: 5, streakDays: 0 })).toEqual(['comeback']);
    expect(kinds({ daysSinceActivity: null })).toEqual([]);
  });

  it('flashcards só lembram a partir de 5 cartões e no máximo 3 lembretes aparecem', () => {
    expect(kinds({ flashcardsDue: 4 })).toEqual([]);
    expect(kinds({ flashcardsDue: 5 })).toEqual(['cards']);
    const many = buildNudges({
      ...base, streakDays: 3, goalMinutes: 100, weekMinutes: 80, flashcardsDue: 9,
      pendingTasks: [{ id: 'a', title: 'T', dueAt: new Date(now.getTime() - 1000) }],
    });
    expect(many).toHaveLength(3);
    expect(many[0].kind).toBe('taskOverdue');
  });
});

describe('Bloom nas perguntas', () => {
  it('cada tipo tem um nível padrão, aplicado quando a pergunta não informa', () => {
    const q = questionSchema.parse({ type: 'practical', topic: 'Derivadas', question: 'Calcule a derivada de x²', expectedAnswer: '2x' });
    expect(q.bloomLevel).toBeUndefined();
    expect(normalizeQuestion(q, 0).bloomLevel).toBe(DEFAULT_BLOOM.practical);
    expect(DEFAULT_BLOOM.real_case).toBe('analyze');
  });

  it('respeita o nível informado e rejeita níveis inválidos', () => {
    const ok = questionSchema.parse({ type: 'open_text', topic: 'Limites', question: 'Explique limites', expectedAnswer: 'x', rubric: ['x'], bloomLevel: 'evaluate' });
    expect(normalizeQuestion(ok, 0).bloomLevel).toBe('evaluate');
    expect(() => questionSchema.parse({ type: 'open_text', topic: 'T', question: 'Pergunta?', expectedAnswer: 'x', rubric: ['x'], bloomLevel: 'memorizar' })).toThrow();
  });

  it('a competência é opcional e limitada', () => {
    const q = questionSchema.parse({ type: 'open_text', topic: 'T', question: 'Pergunta?', expectedAnswer: 'x', rubric: ['x'], competency: 'Pensamento crítico' });
    expect(q.competency).toBe('Pensamento crítico');
    expect(() => questionSchema.parse({ type: 'open_text', topic: 'T', question: 'Pergunta?', expectedAnswer: 'x', rubric: ['x'], competency: 'x'.repeat(81) })).toThrow();
  });
});

describe('plano com lacuna do ciclo de Kolb', () => {
  const now = new Date('2026-03-30T12:00:00Z');
  const input = {
    minutes: 60, now, language: 'pt-BR', tasks: [], agenda: [], weaknesses: [], flashcardsDue: 0,
    fallbackLessons: [{ id: 'l1', title: 'Derivadas', notebookTitle: 'Cálculo' }],
  };

  it('sugere praticar o quadrante pouco usado e explica o porquê', () => {
    const plan = buildStudyPlan({ ...input, kolbGap: { quadrant: 'EC', sharePercent: 4 } });
    const block = plan.blocks.find((b) => b.kind === 'kolb')!;
    expect(block).toBeDefined();
    expect(block.reason).toContain('4%');
    expect(block.reason).toContain('Kolb');
    expect(block.link).toEqual({ type: 'quiz', id: 'l1' });
  });

  it('para Observação Reflexiva leva ao resumo da aula; sem aula, nem sugere', () => {
    const plan = buildStudyPlan({ ...input, kolbGap: { quadrant: 'OR', sharePercent: 2 } });
    expect(plan.blocks.find((b) => b.kind === 'kolb')!.link).toEqual({ type: 'summary', id: 'l1' });
    expect(buildStudyPlan({ ...input, fallbackLessons: [], kolbGap: { quadrant: 'EC', sharePercent: 3 } }).blocks).toEqual([]);
  });

  it('a lacuna é um extra: tarefas urgentes vêm antes e o tempo nunca estoura', () => {
    const plan = buildStudyPlan({
      ...input, minutes: 20, kolbGap: { quadrant: 'EA', sharePercent: 5 },
      tasks: [{ id: 't', title: 'Prova', dueAt: new Date(now.getTime() - 1000), status: 'pending', questionsCount: 10 }],
    });
    expect(plan.blocks[0].kind).toBe('task');
    expect(plan.blocks.reduce((s, b) => s + b.minutes, 0)).toBeLessThanOrEqual(20);
  });
});
