// src/components/VLibrasWidget.tsx
// Atalho para o site oficial do VLibras (alternativa para quando o widget embutido não está no ar).
import React from 'react';
import { Hand } from 'lucide-react';
import { useTranslation } from 'react-i18next';

declare global {
  interface Window {
    VLibras: any;
  }
}

const VLibrasWidget: React.FC = () => {
  const { t } = useTranslation();
  return (
    <button
      onClick={() => window.open('https://www.gov.br/vlibras/pt-br', '_blank', 'noopener')}
      title={t('widgets.vlibrasTitle')}
      aria-label={t('widgets.vlibrasTitle')}
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lifted transition-transform hover:scale-105"
    >
      <Hand className="h-6 w-6" aria-hidden="true" />
    </button>
  );
};

export default VLibrasWidget;
