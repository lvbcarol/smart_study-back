import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import pt from './pt';
import en from './en';
import es from './es';

const code = getLocales()[0]?.languageCode;
const device = code === 'pt' ? 'pt' : code === 'es' ? 'es' : 'en';

i18n.use(initReactI18next).init({
  resources: { pt: { translation: pt }, en: { translation: en }, es: { translation: es } },
  lng: device,
  fallbackLng: 'pt',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** 'pt-BR' | 'es-ES' | 'en-US' (do servidor) -> 'pt' | 'es' | 'en' */
export const shortLang = (lang: string) => {
  const l = lang.toLowerCase();
  return l.startsWith('pt') ? 'pt' : l.startsWith('es') ? 'es' : 'en';
};

/** 'pt' | 'es' | 'en' (do app) -> código que o servidor guarda */
export const serverLang = (lang: string) => ({ pt: 'pt-BR', es: 'es-ES', en: 'en-US' }[shortLang(lang)] as 'pt-BR' | 'es-ES' | 'en-US');

export default i18n;
