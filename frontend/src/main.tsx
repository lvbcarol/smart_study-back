import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css'
import './i18n';
import { initTheme } from './theme/applyTheme';

initTheme(); // aplica o tema salvo antes do primeiro render (evita flash)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)