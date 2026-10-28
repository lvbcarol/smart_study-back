// src/pages/NotFound.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '../components/ds/BrandMark';
import { buttonVariants } from '../components/ds/Button';

const NotFound: React.FC = () => {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-6 text-center">
      <BrandMark className="h-16 w-16" />
      <p className="font-display text-6xl font-extrabold text-primary">404</p>
      <h1 className="text-2xl font-bold">{t('notFound.title')}</h1>
      <p className="max-w-sm text-muted-foreground">{t('notFound.text')}</p>
      <Link to="/home" className={buttonVariants({ size: 'lg' })}>{t('notFound.back')}</Link>
    </main>
  );
};

export default NotFound;
