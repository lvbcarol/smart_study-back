// src/components/mascot/shapes.ts — desenho do Bob, o robô-professor, descrito como dados.
// O site renderiza com <svg> e o app com react-native-svg, então o robô é idêntico nos dois.
// Mantenha este arquivo igual em frontend/ e mobile/ (npm run check:palettes confere).
// Sintaxe "apagável" (sem enums) para rodar direto no Node.

export type MascotPose = 'wave' | 'book' | 'think' | 'happy';

export interface MascotColors {
  primary: string; // casco do robô
  accent: string; // painel do peito e mãos
  detail1: string; // brilho do peito
  detail2: string; // gravatinha-borboleta
  detail3: string; // capa do livro
}

export interface Shape {
  t: 'rect' | 'circle' | 'path' | 'line' | 'polygon' | 'polyline' | 'ellipse';
  p: Record<string, string | number>;
  /** classe CSS opcional (ex.: piscar os olhos no site) */
  cls?: string;
}

export const MASCOT_VIEWBOX = '0 0 200 232';

const SCREEN = '#1F2430';
const GOLD = '#F5B14C';
const CAP = '#2B2F3A';
const WHITE = '#FFFFFF';

const arm = (x1: number, y1: number, x2: number, y2: number, c: MascotColors): Shape[] => [
  { t: 'line', p: { x1, y1, x2, y2, stroke: c.primary, strokeWidth: 14, strokeLinecap: 'round' } },
  { t: 'circle', p: { cx: x2, cy: y2, r: 9, fill: c.accent, stroke: c.primary, strokeWidth: 3 } },
];

const spark = (cx: number, cy: number, r: number, fill: string): Shape => ({
  t: 'path', p: { d: `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`, fill },
});

export function mascotShapes(c: MascotColors, pose: MascotPose): Shape[] {
  const s: Shape[] = [];
  // sombra
  s.push({ t: 'ellipse', p: { cx: 100, cy: 224, rx: 46, ry: 6, fill: '#000000', opacity: 0.12 } });
  // pernas e corpo
  s.push({ t: 'rect', p: { x: 74, y: 200, width: 18, height: 18, rx: 8, fill: c.primary } });
  s.push({ t: 'rect', p: { x: 108, y: 200, width: 18, height: 18, rx: 8, fill: c.primary } });
  s.push({ t: 'rect', p: { x: 58, y: 128, width: 84, height: 78, rx: 26, fill: c.primary } });
  s.push({ t: 'rect', p: { x: 76, y: 148, width: 48, height: 38, rx: 13, fill: c.accent } });
  s.push({ t: 'circle', p: { cx: 100, cy: 167, r: 6.5, fill: c.detail1 } });

  // braços e acessórios por pose
  if (pose === 'wave') {
    s.push(...arm(58, 148, 40, 180, c));
    s.push(...arm(142, 148, 168, 110, c));
    s.push({ t: 'path', p: { d: 'M178 92 Q188 100 180 110', stroke: c.detail2, strokeWidth: 3, strokeLinecap: 'round', fill: 'none' }, cls: 'mascot-wave' });
    s.push({ t: 'path', p: { d: 'M184 84 Q198 98 186 114', stroke: c.detail2, strokeWidth: 3, strokeLinecap: 'round', fill: 'none' }, cls: 'mascot-wave' });
  } else if (pose === 'happy') {
    s.push(...arm(58, 148, 32, 112, c));
    s.push(...arm(142, 148, 168, 112, c));
    s.push(spark(24, 78, 9, GOLD), spark(176, 80, 11, c.detail2), spark(190, 150, 6, GOLD), spark(10, 148, 6, c.detail2));
  } else if (pose === 'think') {
    s.push(...arm(58, 148, 40, 180, c));
    s.push({ t: 'polyline', p: { points: '142,148 156,170 128,146', stroke: c.primary, strokeWidth: 14, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } });
    s.push({ t: 'circle', p: { cx: 128, cy: 144, r: 9, fill: c.accent, stroke: c.primary, strokeWidth: 3 } });
    s.push({ t: 'circle', p: { cx: 176, cy: 70, r: 20, fill: WHITE, stroke: c.primary, strokeWidth: 3 } });
    s.push({ t: 'path', p: { d: 'M170 64 Q170 56 177 56 Q185 56 185 63 Q185 68 178 71 L178 75', stroke: SCREEN, strokeWidth: 3.5, strokeLinecap: 'round', fill: 'none' } });
    s.push({ t: 'circle', p: { cx: 178, cy: 82, r: 2.2, fill: SCREEN } });
    s.push({ t: 'circle', p: { cx: 160, cy: 92, r: 4, fill: WHITE, stroke: c.primary, strokeWidth: 2 } });
  } else {
    // book: segura um livro aberto junto ao peito
    s.push({ t: 'path', p: { d: 'M64 176 L100 186 L136 176 L136 204 L100 214 L64 204Z', fill: c.detail3 } });
    s.push({ t: 'path', p: { d: 'M68 170 L100 179 L100 206 L68 197Z', fill: WHITE, stroke: SCREEN, strokeWidth: 1.5, strokeLinejoin: 'round' } });
    s.push({ t: 'path', p: { d: 'M132 170 L100 179 L100 206 L132 197Z', fill: '#F3F4F6', stroke: SCREEN, strokeWidth: 1.5, strokeLinejoin: 'round' } });
    s.push({ t: 'line', p: { x1: 75, y1: 181, x2: 94, y2: 187, stroke: '#9CA3AF', strokeWidth: 2, strokeLinecap: 'round' } });
    s.push({ t: 'line', p: { x1: 75, y1: 188, x2: 94, y2: 194, stroke: '#9CA3AF', strokeWidth: 2, strokeLinecap: 'round' } });
    s.push({ t: 'line', p: { x1: 125, y1: 181, x2: 106, y2: 187, stroke: '#9CA3AF', strokeWidth: 2, strokeLinecap: 'round' } });
    s.push({ t: 'line', p: { x1: 125, y1: 188, x2: 106, y2: 194, stroke: '#9CA3AF', strokeWidth: 2, strokeLinecap: 'round' } });
    s.push(...arm(60, 150, 70, 184, c));
    s.push(...arm(140, 150, 130, 184, c));
  }

  // gravatinha-borboleta
  s.push({ t: 'path', p: { d: 'M100 138 L82 128 L82 148 Z', fill: c.detail2 } });
  s.push({ t: 'path', p: { d: 'M100 138 L118 128 L118 148 Z', fill: c.detail2 } });
  s.push({ t: 'circle', p: { cx: 100, cy: 138, r: 4.5, fill: c.detail2, stroke: WHITE, strokeWidth: 1.5 } });

  // cabeça, orelhas e tela do rosto
  s.push({ t: 'rect', p: { x: 34, y: 78, width: 14, height: 28, rx: 6, fill: c.primary } });
  s.push({ t: 'rect', p: { x: 152, y: 78, width: 14, height: 28, rx: 6, fill: c.primary } });
  s.push({ t: 'rect', p: { x: 44, y: 46, width: 112, height: 88, rx: 32, fill: c.primary } });
  s.push({ t: 'rect', p: { x: 56, y: 66, width: 88, height: 58, rx: 22, fill: SCREEN } });

  // óculos dourados, olhos e sorriso
  s.push({ t: 'circle', p: { cx: 82, cy: 93, r: 15, fill: 'none', stroke: GOLD, strokeWidth: 3 } });
  s.push({ t: 'circle', p: { cx: 118, cy: 93, r: 15, fill: 'none', stroke: GOLD, strokeWidth: 3 } });
  s.push({ t: 'line', p: { x1: 97, y1: 93, x2: 103, y2: 93, stroke: GOLD, strokeWidth: 3 } });
  s.push({ t: 'circle', p: { cx: 82, cy: 93, r: 7.5, fill: WHITE }, cls: 'mascot-eye' });
  s.push({ t: 'circle', p: { cx: 118, cy: 93, r: 7.5, fill: WHITE }, cls: 'mascot-eye' });
  s.push({ t: 'circle', p: { cx: pose === 'think' ? 85 : 83.5, cy: pose === 'think' ? 90 : 94, r: 3.2, fill: SCREEN } });
  s.push({ t: 'circle', p: { cx: pose === 'think' ? 121 : 119.5, cy: pose === 'think' ? 90 : 94, r: 3.2, fill: SCREEN } });
  if (pose === 'think') s.push({ t: 'line', p: { x1: 91, y1: 113, x2: 109, y2: 113, stroke: WHITE, strokeWidth: 4, strokeLinecap: 'round' } });
  else s.push({ t: 'path', p: { d: 'M88 110 Q100 121 112 110', stroke: WHITE, strokeWidth: 4, strokeLinecap: 'round', fill: 'none' } });
  s.push({ t: 'circle', p: { cx: 66, cy: 109, r: 5, fill: '#FF9DB8', opacity: 0.7 } });
  s.push({ t: 'circle', p: { cx: 134, cy: 109, r: 5, fill: '#FF9DB8', opacity: 0.7 } });

  // capelo de formatura (TCC) com borla dourada
  s.push({ t: 'path', p: { d: 'M68 46 L68 60 Q100 74 132 60 L132 46 Q100 58 68 46Z', fill: CAP } });
  s.push({ t: 'polygon', p: { points: '100,18 164,38 100,58 36,38', fill: CAP, stroke: '#3A3F4D', strokeWidth: 2, strokeLinejoin: 'round' } });
  s.push({ t: 'circle', p: { cx: 100, cy: 38, r: 4, fill: GOLD } });
  s.push({ t: 'line', p: { x1: 100, y1: 38, x2: 154, y2: 41, stroke: GOLD, strokeWidth: 2.5, strokeLinecap: 'round' } });
  s.push({ t: 'line', p: { x1: 154, y1: 41, x2: 154, y2: 66, stroke: GOLD, strokeWidth: 3, strokeLinecap: 'round' } });
  s.push({ t: 'circle', p: { cx: 154, cy: 70, r: 5, fill: GOLD } });

  return s;
}
