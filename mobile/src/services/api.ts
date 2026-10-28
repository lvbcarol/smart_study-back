// Cliente da API. O endereço do backend vem, nesta ordem, de:
//  1) EXPO_PUBLIC_API_URL (ex.: https://meu-backend.onrender.com/api)
//  2) o IP do computador que está rodando o Expo (no celular, "localhost" seria o próprio celular)
//  3) http://localhost:3000/api (navegador no mesmo computador)
import axios from 'axios';
import Constants from 'expo-constants';
import { getItem, removeItem } from './storage';

export const TOKEN_KEY = 'ss-auth-token';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:3000/api`;
}

export const API_URL = resolveBaseUrl();

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const token = await getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Quando o token expira, o AuthContext é avisado para voltar ao login
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      await removeItem(TOKEN_KEY);
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export default api;
