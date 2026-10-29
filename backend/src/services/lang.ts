// src/services/lang.ts — idioma que a IA deve usar nas respostas (pt-BR, es-ES ou en-US)
export type AiLanguage = 'Brazilian Portuguese' | 'Spanish' | 'English';

export function aiLanguageName(language?: string): AiLanguage {
  const l = (language ?? '').toLowerCase();
  return l.startsWith('pt') ? 'Brazilian Portuguese' : l.startsWith('es') ? 'Spanish' : 'English';
}
