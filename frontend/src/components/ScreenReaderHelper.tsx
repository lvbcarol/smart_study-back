// src/components/ScreenReaderHelper.tsx
import React from 'react';
import { Headphones } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ScreenReaderHelper: React.FC = () => {
  const { t } = useTranslation();
  return (
    <button
      onClick={() => window.open('https://www.nvaccess.org/download/', '_blank', 'noopener')}
      title={t('widgets.screenReaderTitle')}
      aria-label={t('widgets.screenReaderTitle')}
      className="fixed bottom-4 left-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lifted transition-transform hover:scale-105"
    >
      <Headphones className="h-6 w-6" aria-hidden="true" />
    </button>
  );
};

export default ScreenReaderHelper;
