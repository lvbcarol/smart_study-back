import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { getItem, setItem } from '@/services/storage';
import type { ThemeMode } from '@/types';
import { getPalette, isPaletteId, NEUTRALS, PaletteId, ResolvedMode } from './palettes';

export interface Colors {
  background: string; foreground: string; card: string; secondary: string; secondaryFg: string; mutedFg: string; border: string;
  primary: string; primaryFg: string; accent: string; accentFg: string;
  destructive: string; destructiveFg: string; success: string; warning: string;
  /** cinco cores de gráfico da paleta, em ordem fixa */
  charts: readonly string[];
}

export function buildColors(paletteId: string, mode: ResolvedMode): Colors {
  const n = NEUTRALS[mode];
  const t = getPalette(paletteId)[mode];
  return {
    background: n.background, foreground: n.foreground, card: n.card, secondary: n.secondary, secondaryFg: n.secondaryFg, mutedFg: n.mutedFg, border: n.border,
    primary: t.primary, primaryFg: t.primaryFg, accent: t.accent, accentFg: t.accentFg,
    destructive: n.destructive, destructiveFg: n.destructiveFg, success: n.success, warning: n.warning,
    charts: t.charts,
  };
}

interface Prefs { mode: ThemeMode; palette: PaletteId; fontScale: number }
const DEFAULTS: Prefs = { mode: 'system', palette: 'indigo', fontScale: 1 };
const STORAGE_KEY = 'ss-theme';

interface ThemeContextType extends Prefs {
  colors: Colors;
  resolvedMode: ResolvedMode;
  /** aplica um tamanho de fonte respeitando a preferência do aluno */
  fs: (size: number) => number;
  /** muda na hora e salva no servidor (quando logado) */
  update: (changes: Partial<Prefs>) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const sanitize = (p: Partial<Record<keyof Prefs, unknown>>): Prefs => ({
  mode: p.mode === 'light' || p.mode === 'dark' || p.mode === 'system' ? p.mode : DEFAULTS.mode,
  palette: isPaletteId(p.palette) ? p.palette : DEFAULTS.palette,
  fontScale: typeof p.fontScale === 'number' && p.fontScale >= 0.85 && p.fontScale <= 1.4 ? p.fontScale : 1,
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, savePreferences } = useAuth();
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  // tema salvo neste aparelho (vale já na tela de login)
  useEffect(() => {
    getItem(STORAGE_KEY).then((raw) => { if (raw) try { setPrefs(sanitize(JSON.parse(raw))); } catch { /* ignora */ } });
  }, []);

  // ao entrar, valem as preferências da conta
  useEffect(() => {
    if (user) setPrefs(sanitize({ mode: user.theme, palette: user.palette, fontScale: user.fontScale }));
  }, [user?._id, user?.theme, user?.palette, user?.fontScale]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedMode: ResolvedMode = prefs.mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : prefs.mode;
  const colors = useMemo(() => buildColors(prefs.palette, resolvedMode), [prefs.palette, resolvedMode]);

  const update = useCallback((changes: Partial<Prefs>) => {
    setPrefs((cur) => {
      const next = sanitize({ ...cur, ...changes });
      setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    if (user) {
      const server: Record<string, unknown> = {};
      if (changes.mode) server.theme = changes.mode;
      if (changes.palette) server.palette = changes.palette;
      if (changes.fontScale) server.fontScale = changes.fontScale;
      savePreferences(server).catch(() => undefined);
    }
  }, [user, savePreferences]);

  const value = useMemo(
    () => ({ ...prefs, colors, resolvedMode, fs: (size: number) => Math.round(size * prefs.fontScale), update }),
    [prefs, colors, resolvedMode, update]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
