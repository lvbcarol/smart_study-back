// src/components/mascot/Mascot.tsx — Bob, o robô-professor (mascote do Smart Study)
import React from 'react';
import { MASCOT_VIEWBOX, mascotShapes, MascotColors, MascotPose } from './shapes';
import { cn } from '@/lib/utils';

// as cores vêm dos tokens do tema: o Bob acompanha a paleta escolhida
const COLORS: MascotColors = {
  primary: 'hsl(var(--primary))',
  accent: 'hsl(var(--accent))',
  detail1: 'hsl(var(--chart-2))',
  detail2: 'hsl(var(--chart-4))',
  detail3: 'hsl(var(--chart-3))',
};

const STYLE_PROPS = new Set(['fill', 'stroke', 'opacity']);

interface MascotProps {
  pose?: MascotPose;
  /** largura em px (a altura acompanha) */
  size?: number;
  className?: string;
  /** descrição para leitores de tela; sem ela o desenho é decorativo */
  label?: string;
  /** o Bob pisca e balança suavemente (some com "reduzir movimento") */
  animated?: boolean;
}

export const Mascot: React.FC<MascotProps> = ({ pose = 'wave', size = 160, className, label, animated = true }) => (
  <svg
    viewBox={MASCOT_VIEWBOX} width={size} height={Math.round(size * (232 / 200))} role={label ? 'img' : undefined} aria-label={label}
    aria-hidden={label ? undefined : true} focusable="false" className={cn(animated && 'mascot-bob', className)}
  >
    {mascotShapes(COLORS, pose).map((shape, i) => {
      // cores usam var(): só funcionam como estilo CSS, não como atributo SVG
      const style: React.CSSProperties = {};
      const attrs: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(shape.p)) {
        if (STYLE_PROPS.has(k)) (style as Record<string, string | number>)[k] = v;
        else attrs[k] = v;
      }
      const Tag = shape.t as 'rect';
      return <Tag key={i} {...attrs} style={style} className={cn(animated && shape.cls)} />;
    })}
  </svg>
);

export default Mascot;
