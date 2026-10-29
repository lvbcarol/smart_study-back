// src/context/AuthContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import api, { TOKEN_KEY, AUTH_LOGOUT_EVENT } from '../services/api';
import { useAccessibility } from './AccessibilityContext';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  /** true enquanto o token salvo está sendo validado no boot */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  /** Aplica no estado um usuário atualizado (ex.: depois de salvar o perfil) */
  setUser: (user: User) => void;
  /** Salva preferências/perfil no servidor e atualiza o usuário no estado */
  savePreferences: (changes: PreferenceChanges) => Promise<User>;
  /** Recarrega só o vínculo com turmas (entrar/sair de uma turma) sem mexer em tema e idioma */
  refreshLinks: () => Promise<void>;
}

export type PreferenceChanges = Partial<Pick<User, 'name' | 'language' | 'theme' | 'palette' | 'fontScale' | 'avatarColor' | 'weeklyGoalMinutes'>> & {
  accessibility?: Partial<User['accessibility']>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const { setSignLanguageEnabled, setAudioEnabled } = useAccessibility();
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!localStorage.getItem(TOKEN_KEY));

  // Aplica as preferências salvas no servidor (idioma e acessibilidade)
  const applyPreferences = useCallback((u: User) => {
    i18n.changeLanguage(u.language.split('-')[0]);
    setSignLanguageEnabled(u.accessibility.signLanguage);
    setAudioEnabled(u.accessibility.audioDescription);
  }, [i18n, setSignLanguageEnabled, setAudioEnabled]);

  const setUser = useCallback((u: User) => {
    setUserState(u);
    applyPreferences(u);
  }, [applyPreferences]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUserState(null);
  }, []);

  // Boot: se há token salvo, carrega o usuário
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api.get<User>('/usuario/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O interceptor do axios dispara este evento quando a API responde 401
  useEffect(() => {
    window.addEventListener(AUTH_LOGOUT_EVENT, logout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, logout);
  }, [logout]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post<{ usuario: User; token: string }>('/usuario/login', { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setUser(res.data.usuario);
    return res.data.usuario;
  };

  const savePreferences = async (changes: PreferenceChanges): Promise<User> => {
    const res = await api.put<User>('/usuario/me', changes);
    setUser(res.data);
    return res.data;
  };

  const refreshLinks = async () => {
    const res = await api.get<User>('/usuario/me');
    setUserState((prev) => (prev ? { ...prev, turmas: res.data.turmas, linked: res.data.linked } : res.data));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, savePreferences, refreshLinks }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
