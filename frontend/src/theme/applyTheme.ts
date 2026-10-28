// src/theme/applyTheme.ts
import { NEUTRALS, getPalette, isPaletteId, DEFAULT_PALETTE, PaletteId, ResolvedMode } from './palettes';
import type { ThemeMode } from '../types';

export interface ThemePrefs {
  mode: ThemeMode;
  palette: PaletteId;
  fontScale: number;
}

export const THEME_STORAGE_KEY = 'ss-theme';
export const DEFAULT_PREFS: ThemePrefs = { mode: 'system', palette: DEFAULT_PALETTE, fontScale: 1 };

/** "#RRGGBB" -> "H S% L%" (formato que o Tailwind usa em hsl(var(--x))) */
export function hexToHsl(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  return `${Math.round(hue * 10) / 10} ${Math.round(sat * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
}

export function resolveMode(mode: ThemeMode): ResolvedMode {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function buildThemeVars(paletteId: string, mode: ResolvedMode): Record<string, string> {
  const n = NEUTRALS[mode];
  const t = getPalette(paletteId)[mode];
  const vars: Record<string, string> = {
    '--background': n.background,
    '--foreground': n.foreground,
    '--card': n.card,
    '--card-foreground': n.foreground,
    '--popover': n.card,
    '--popover-foreground': n.foreground,
    '--primary': t.primary,
    '--primary-foreground': t.primaryFg,
    '--secondary': n.secondary,
    '--secondary-foreground': n.secondaryFg,
    '--muted': n.secondary,
    '--muted-foreground': n.mutedFg,
    '--accent': t.accent,
    '--accent-foreground': t.accentFg,
    '--destructive': n.destructive,
    '--destructive-foreground': n.destructiveFg,
    '--success': n.success,
    '--warning': n.warning,
    '--border': n.border,
    '--input': n.border,
    '--ring': t.primary,
    '--shadow': n.shadow,
  };
  t.charts.forEach((c, i) => { vars[`--chart-${i + 1}`] = c; });
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, hexToHsl(v)]));
}

/** Escreve os tokens no <html>. Retorna o modo efetivo (claro/escuro). */
export function applyTheme(prefs: ThemePrefs): ResolvedMode {
  const resolved = resolveMode(prefs.mode);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(buildThemeVars(prefs.palette, resolved))) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = resolved;
  root.dataset.palette = prefs.palette;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.style.fontSize = `${16 * prefs.fontScale}px`;
  return resolved;
}

export function readStoredPrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return sanitizePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function storePrefs(prefs: ThemePrefs) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* armazenamento indisponível: o tema vale só nesta sessão */
  }
}

export function sanitizePrefs(input: Partial<Record<keyof ThemePrefs, unknown>>): ThemePrefs {
  const mode = input.mode === 'light' || input.mode === 'dark' || input.mode === 'system' ? input.mode : DEFAULT_PREFS.mode;
  const palette = isPaletteId(input.palette) ? input.palette : DEFAULT_PREFS.palette;
  const fs = typeof input.fontScale === 'number' && input.fontScale >= 0.85 && input.fontScale <= 1.4 ? input.fontScale : 1;
  return { mode, palette, fontScale: fs };
}

/** Chamado antes do primeiro render para evitar "flash" de tema errado. */
export function initTheme() {
  applyTheme(readStoredPrefs());
}
