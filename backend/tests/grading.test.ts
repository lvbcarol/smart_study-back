import { describe, it, expect } from 'vitest';
import { gradeAnswer, gradeFillBlank, gradeMultipleChoice, gradeNumeric, keywordFallback, normalizeText, parseNumber } from '../src/quiz/grading';
import { normalizeQuestion, questionSchema, toPublic, answerSchemaFor, Question } from '../src/quiz/questions';

const mc = questionSchema.parse({ type: 'multiple_choice', topic: 'T', question: 'Pergunta?', options: ['a', 'b', 'c', 'd'], correctAnswerIndex: 2, explanation: 'porque sim' });
const fill = questionSchema.parse({ type: 'fill_blank', topic: 'T', question: 'A capital do Brasil é ____ e fica no ____.', acceptedAnswers: [['Brasília', 'Brasilia'], ['Centro-Oeste', 'centro oeste']] });
const practical = questionSchema.parse({ type: 'practical', topic: 'T', question: 'Quanto é 1/4?', expectedAnswer: '0,25', numeric: { value: 0.25, tolerance: 0.01 } });
const open = questionSchema.parse({ type: 'open_text', topic: 'T', question: 'Explique fotossíntese', expectedAnswer: 'Plantas convertem luz em energia', rubric: ['luz solar', 'clorofila nas plantas', 'produz glicose'] });

describe('normalização', () => {
  it('ignora acento, caixa e pontuação', () => {
    expect(normalizeText('  Brasília!! ')).toBe('brasilia');
    expect(normalizeText('Centro-Oeste')).toBe('centro oeste');
  });
  it('lê números com vírgula decimal e unidades', () => {
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('R$ 12.5 reais')).toBe(12.5);
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('sem número')).toBeNull();
  });
});

describe('correção determinística', () => {
  it('múltipla escolha', () => {
    expect(gradeMultipleChoice(mc as any, 2).score).toBe(1);
    expect(gradeMultipleChoice(mc as any, 0).score).toBe(0);
    expect(gradeMultipleChoice(mc as any, 2).correctAnswer).toBe('c');
  });

  it('completar: aceita sinônimos/acentos e dá crédito parcial por lacuna', () => {
    expect(gradeFillBlank(fill as any, ['brasilia', 'centro oeste']).score).toBe(1);
    const partial = gradeFillBlank(fill as any, ['Brasília', 'Sul']);
    expect(partial.score).toBe(0.5);
    expect(partial.correct).toBe(false);
    expect(gradeFillBlank(fill as any, ['', '']).score).toBe(0);
  });

  it('prático numérico respeita a tolerância', () => {
    expect(gradeNumeric(practical as any, '0,25')!.score).toBe(1);
    expect(gradeNumeric(practical as any, 'aprox. 0.255')!.score).toBe(1);
    expect(gradeNumeric(practical as any, '0,5')!.score).toBe(0);
    expect(gradeNumeric(practical as any, 'não sei')!.score).toBe(0);
  });
});

describe('correção por rubrica', () => {
  it('plano B por palavras-chave mede a cobertura da rubrica', () => {
    const rubric = (open as any).rubric;
    expect(keywordFallback(rubric, '', 'A luz solar é absorvida pela clorofila nas plantas e produz glicose')).toBe(1);
    expect(keywordFallback(rubric, '', 'As plantas usam luz solar')).toBeCloseTo(2 / 3, 5);
    expect(keywordFallback(rubric, '', 'a luz solar')).toBeCloseTo(1 / 3, 5);
    expect(keywordFallback(rubric, '', 'não faço ideia')).toBe(0);
  });

  it('usa a nota da IA quando disponível e o plano B quando ela falha', async () => {
    const okAi = { gradeAnswer: async () => ({ score: 0.8, feedback: 'Bom!' }) };
    const ok = await gradeAnswer(open, 'qualquer coisa', okAi);
    expect(ok.method).toBe('ai');
    expect(ok.score).toBe(0.8);
    expect(ok.correct).toBe(true);
    expect(ok.feedback).toBe('Bom!');

    const brokenAi = { gradeAnswer: async () => { throw new Error('IA fora do ar'); } };
    const fallback = await gradeAnswer(open, 'luz solar, clorofila nas plantas, produz glicose', brokenAi);
    expect(fallback.method).toBe('fallback');
    expect(fallback.score).toBe(1);
  });

  it('resposta vazia vale zero sem chamar a IA', async () => {
    let called = false;
    const ai = { gradeAnswer: async () => { called = true; return { score: 1, feedback: '' }; } };
    const r = await gradeAnswer(open, '   ', ai);
    expect(r.score).toBe(0);
    expect(called).toBe(false);
  });

  it('limita a nota da IA ao intervalo 0..1', async () => {
    const ai = { gradeAnswer: async () => ({ score: 7, feedback: '' }) };
    expect((await gradeAnswer(open, 'algo', ai)).score).toBe(1);
  });
});

describe('perguntas', () => {
  it('a versão pública nunca vaza gabarito, rubrica ou explicação', () => {
    for (const q of [mc, fill, practical, open] as Question[]) {
      const json = JSON.stringify(toPublic(q));
      for (const secret of ['correctAnswerIndex', 'acceptedAnswers', 'expectedAnswer', 'rubric', 'explanation', 'numeric":{', 'porque sim']) {
        expect(json).not.toContain(secret);
      }
    }
    expect(toPublic(mc).options).toHaveLength(4);
    expect(toPublic(fill).blanks).toBe(2);
    expect(toPublic(practical).numeric).toBe(true);
  });

  it('valida o formato da resposta por tipo', () => {
    expect(answerSchemaFor(mc).safeParse(1).success).toBe(true);
    expect(answerSchemaFor(mc).safeParse('1').success).toBe(false);
    expect(answerSchemaFor(fill).safeParse(['a', 'b']).success).toBe(true);
    expect(answerSchemaFor(fill).safeParse(['a']).success).toBe(false);
    expect(answerSchemaFor(open).safeParse('texto').success).toBe(true);
    expect(answerSchemaFor(open).safeParse(5).success).toBe(false);
  });

  it('ajusta o número de lacunas quando a IA erra a contagem', () => {
    const noMarker = normalizeQuestion(questionSchema.parse({ type: 'fill_blank', topic: 'T', question: 'Sem lacuna', acceptedAnswers: [['x']] }), 0);
    expect((noMarker as any).question).toContain('____');
    const tooManyAnswers = normalizeQuestion(questionSchema.parse({ type: 'fill_blank', topic: 'T', question: 'Uma ____ só', acceptedAnswers: [['x'], ['y']] }), 0);
    expect((tooManyAnswers as any).acceptedAnswers).toHaveLength(1);
  });

  it('rejeita perguntas malformadas', () => {
    expect(questionSchema.safeParse({ type: 'multiple_choice', topic: 'T', question: 'Q?', options: ['a', 'b'], correctAnswerIndex: 0 }).success).toBe(false);
    expect(questionSchema.safeParse({ type: 'real_case', topic: 'T', question: 'Q?', expectedAnswer: 'x', rubric: ['y'] }).success).toBe(false);
    expect(questionSchema.safeParse({ type: 'inventado', topic: 'T', question: 'Q?' }).success).toBe(false);
  });
});
