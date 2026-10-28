import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import pt from './pt';
import en from './en';

const device = getLocales()[0]?.languageCode === 'pt' ? 'pt' : 'en';

i18n.use(initReactI18next).init({
  resources: { pt: { translation: pt }, en: { translation: en } },
  lng: device,
  fallbackLng: 'pt',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** 'pt-BR' | 'en-US' (do servidor) -> 'pt' | 'en' */
export const shortLang = (lang: string) => (lang.toLowerCase().startsWith('pt') ? 'pt' : 'en');

export default i18n;
