// src/components/ASLHelperButton.tsx
import React from 'react';
import { Hand } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ASLHelperButton: React.FC = () => {
  const { t } = useTranslation();
  return (
    <button
      onClick={() => window.open('https://www.handspeak.com/', '_blank', 'noopener')}
      title={t('widgets.aslTitle')}
      aria-label={t('widgets.aslTitle')}
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lifted transition-transform hover:scale-105"
    >
      <Hand className="h-6 w-6" aria-hidden="true" />
    </button>
  );
};

export default ASLHelperButton;
