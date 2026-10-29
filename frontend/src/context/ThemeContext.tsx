// src/context/ThemeContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { applyTheme, readStoredPrefs, sanitizePrefs, storePrefs, ThemePrefs } from '../theme/applyTheme';
import { getPalette, type PaletteId, type ResolvedMode } from '../theme/palettes';
import type { ThemeMode } from '../types';

interface ThemeContextType extends ThemePrefs {
  resolvedMode: ResolvedMode;
  /** true quando a paleta escolhida só existe em um modo (ex.: Programador, sempre escuro) */
  modeLocked: boolean;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: PaletteId) => void;
  setFontScale: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<ThemePrefs>(readStoredPrefs);
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>(() => applyTheme(prefs));

  // Ao entrar (ou ao salvar o perfil), as preferências do servidor passam a valer
  useEffect(() => {
    if (!user) return;
    setPrefs(sanitizePrefs({ mode: user.theme, palette: user.palette, fontScale: user.fontScale }));
  }, [user?._id, user?.theme, user?.palette, user?.fontScale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setResolvedMode(applyTheme(prefs));
    storePrefs(prefs);
  }, [prefs]);

  // No modo "sistema", acompanha a mudança do sistema operacional
  useEffect(() => {
    if (prefs.mode !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolvedMode(applyTheme(prefs));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [prefs]);

  const setMode = useCallback((mode: ThemeMode) => setPrefs((p) => ({ ...p, mode })), []);
  const setPalette = useCallback((palette: PaletteId) => setPrefs((p) => ({ ...p, palette })), []);
  const setFontScale = useCallback((fontScale: number) => setPrefs((p) => sanitizePrefs({ ...p, fontScale })), []);

  const value = useMemo(
    () => ({ ...prefs, resolvedMode, modeLocked: !!getPalette(prefs.palette).forceMode, setMode, setPalette, setFontScale }),
    [prefs, resolvedMode, setMode, setPalette, setFontScale]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
