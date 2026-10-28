import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import api, { setUnauthorizedHandler, TOKEN_KEY } from '@/services/api';
import { getItem, removeItem, setItem } from '@/services/storage';
import i18n, { shortLang } from '@/i18n';
import type { User } from '@/types';

export type PreferenceChanges = Partial<Pick<User, 'name' | 'language' | 'theme' | 'palette' | 'fontScale'>>;

interface AuthContextType {
  user: User | null;
  /** true enquanto o token salvo está sendo validado ao abrir o app */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  savePreferences: (changes: PreferenceChanges) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) i18n.changeLanguage(shortLang(u.language));
  }, []);

  const logout = useCallback(async () => {
    await removeItem(TOKEN_KEY);
    setUserState(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUserState(null));
    (async () => {
      const token = await getItem(TOKEN_KEY);
      if (token) {
        try {
          setUser((await api.get<User>('/usuario/me')).data);
        } catch {
          await removeItem(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
    return () => setUnauthorizedHandler(null);
  }, [setUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ usuario: User; token: string }>('/usuario/login', { email, password });
    await setItem(TOKEN_KEY, data.token);
    setUser(data.usuario);
    return data.usuario;
  };

  // o app só cria contas de aluno
  const register = async (name: string, email: string, password: string) => {
    await api.post('/usuario/register', { name, email, password, role: 'student', language: shortLang(i18n.language) === 'pt' ? 'pt-BR' : 'en-US' });
  };

  const savePreferences = async (changes: PreferenceChanges) => {
    const { data } = await api.put<User>('/usuario/me', changes);
    setUser(data);
    return data;
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, savePreferences }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
