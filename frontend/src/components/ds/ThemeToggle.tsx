// src/components/ds/ThemeToggle.tsx — alterna claro/escuro (e salva no perfil quando logado)
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';

export const ThemeToggle: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedMode, setMode } = useTheme();
  const { user, savePreferences } = useAuth();
  const next = resolvedMode === 'dark' ? 'light' : 'dark';

  const toggle = () => {
    setMode(next); // aplica na hora
    if (user) savePreferences({ theme: next }).catch(() => undefined);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={next === 'dark' ? t('navbar.themeToDark') : t('navbar.themeToLight')}
      title={next === 'dark' ? t('navbar.themeToDark') : t('navbar.themeToLight')}
    >
      {resolvedMode === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </Button>
  );
};
