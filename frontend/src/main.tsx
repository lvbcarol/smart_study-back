import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css'
import i18n from './i18n';
import { initTheme } from './theme/applyTheme';

initTheme(); // aplica o tema salvo antes do primeiro render (evita flash)

// Mantém <html lang> igual ao idioma da interface (leitores de tela dependem disso)
const syncLang = (lng: string) => { document.documentElement.lang = lng; };
syncLang(i18n.language || 'pt');
i18n.on('languageChanged', syncLang);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)