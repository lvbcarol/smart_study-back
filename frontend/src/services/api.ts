// src/services/api.ts
import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const TOKEN_KEY = 'authToken';
export const AUTH_LOGOUT_EVENT = 'auth:logout';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para adicionar o token a todas as requisições
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Token expirado/inválido: limpa a sessão e avisa o AuthContext (que redireciona para o login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
    }
    return Promise.reject(error);
  }
);

export default api;
