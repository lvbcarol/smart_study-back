// src/components/ds/SiteFooter.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from './BrandMark';

const SiteFooter: React.FC = () => {
  const { t } = useTranslation();
  return (
    <footer className="mt-auto border-t border-border bg-card/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <BrandLogo markClassName="h-7 w-7" className="[&>span]:text-base" />
          <p>{t('footer.description')}</p>
        </div>
        <div className="space-y-2 md:text-right">
          <nav aria-label="Footer" className="flex gap-4 md:justify-end">
            <Link to="/about-us" className="font-medium text-foreground hover:underline">{t('footer.about')}</Link>
            <Link to="/terms-of-use" className="font-medium text-foreground hover:underline">{t('footer.terms')}</Link>
          </nav>
          <p>{t('footer.developedBy')}</p>
          <p>&copy; {new Date().getFullYear()} Smart Study. {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
