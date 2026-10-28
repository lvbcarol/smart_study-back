// src/layouts/AppLayout.tsx — navbar + conteúdo + rodapé (páginas internas e públicas de conteúdo)
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppNavbar from '../components/ds/AppNavbar';
import SiteFooter from '../components/ds/SiteFooter';

const AppLayout: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t('navbar.skip')}
      </a>
      <AppNavbar />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none md:py-10">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
};

export default AppLayout;
