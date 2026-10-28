// scripts/check-contrast.ts — valida WCAG AA de todas as paletas nos dois modos.
// Uso: npm run check:contrast
import { PALETTES, NEUTRALS } from '../src/theme/palettes.ts';

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function luminance(hex: string) {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
// cor `fg` com opacidade `alpha` sobre `bg`
function mix(fg: string, bg: string, alpha: number) {
  const f = rgb(fg), b = rgb(bg);
  const c = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

interface Check { label: string; fg: string; bg: string; min: number }
let failures = 0;
let total = 0;

for (const mode of ['light', 'dark'] as const) {
  const n = NEUTRALS[mode];
  for (const p of PALETTES) {
    const t = p[mode];
    const checks: Check[] = [
      { label: 'texto / fundo', fg: n.foreground, bg: n.background, min: 4.5 },
      { label: 'texto / card', fg: n.foreground, bg: n.card, min: 4.5 },
      { label: 'texto suave / fundo', fg: n.mutedFg, bg: n.background, min: 4.5 },
      { label: 'texto suave / card', fg: n.mutedFg, bg: n.card, min: 4.5 },
      { label: 'texto suave / secundário', fg: n.mutedFg, bg: n.secondary, min: 4.5 },
      { label: 'texto / secundário', fg: n.secondaryFg, bg: n.secondary, min: 4.5 },
      { label: 'botão primário', fg: t.primaryFg, bg: t.primary, min: 4.5 },
      { label: 'primária como texto / fundo', fg: t.primary, bg: n.background, min: 4.5 },
      { label: 'primária como texto / card', fg: t.primary, bg: n.card, min: 4.5 },
      { label: 'texto sobre tinta (accent)', fg: t.accentFg, bg: t.accent, min: 4.5 },
      { label: 'tinta (accent) sobre fundo (borda de UI)', fg: t.primary, bg: t.accent, min: 3 },
      { label: 'botão destrutivo', fg: n.destructiveFg, bg: n.destructive, min: 4.5 },
      { label: 'sucesso / fundo', fg: n.success, bg: n.background, min: 4.5 },
      { label: 'aviso / fundo', fg: n.warning, bg: n.background, min: 4.5 },
      { label: 'sucesso sobre tinta 12%', fg: n.success, bg: mix(n.success, n.card, 0.12), min: 4.5 },
      { label: 'aviso sobre tinta 12%', fg: n.warning, bg: mix(n.warning, n.card, 0.12), min: 4.5 },
      { label: 'destrutivo sobre tinta 12%', fg: n.destructive, bg: mix(n.destructive, n.card, 0.12), min: 4.5 },
      { label: 'anel de foco / fundo (UI)', fg: t.primary, bg: n.background, min: 3 },
      ...t.charts.map((c, i) => ({ label: `gráfico ${i + 1} / card (UI)`, fg: c, bg: n.card, min: 3 })),
    ];
    for (const c of checks) {
      total++;
      const r = ratio(c.fg, c.bg);
      if (r < c.min) {
        failures++;
        console.error(`✗ [${mode}] ${p.id}: ${c.label} = ${r.toFixed(2)} (mínimo ${c.min})  ${c.fg} em ${c.bg}`);
      }
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} de ${total} verificações falharam.`);
  process.exit(1);
}
console.log(`✓ ${total} verificações de contraste passaram (WCAG AA) em ${PALETTES.length} paletas × 2 modos.`);
