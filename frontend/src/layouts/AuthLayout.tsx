// src/layouts/AuthLayout.tsx — telas de entrada (login, cadastro, recuperação de senha)
import React from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { BookOpen, Layers, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '../components/ds/BrandMark';
import { ThemeToggle } from '../components/ds/ThemeToggle';
import { useAuth } from '../context/AuthContext';

const AuthLayout: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  if (!loading && user) return <Navigate to="/home" replace />;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-accent p-12 text-accent-foreground lg:flex">
        <Link to="/login" aria-label="Smart Study"><BrandLogo markClassName="h-11 w-11" /></Link>
        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">{t('auth.brandTagline')}</h1>
          <p className="max-w-md text-lg opacity-90">{t('auth.brandSubtitle')}</p>
        </div>
        <ul className="relative z-10 flex gap-3" aria-hidden="true">
          {[BookOpen, ListChecks, Layers].map((Icon, i) => (
            <li key={i} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary shadow-soft">
              <Icon className="h-7 w-7" />
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/10" />
        <div aria-hidden="true" className="absolute -bottom-32 right-10 h-96 w-96 rounded-full bg-primary/10" />
      </aside>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 pr-16 lg:justify-end">
          <Link to="/login" aria-label="Smart Study" className="lg:hidden"><BrandLogo markClassName="h-9 w-9" /></Link>
          <ThemeToggle />
        </div>
        <main id="main-content" className="flex flex-1 items-center justify-center px-4 pb-12">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AuthLayout;
