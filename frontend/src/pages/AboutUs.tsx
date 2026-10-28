// src/pages/AboutUs.tsx
import React from 'react';
import { BarChart3, BookOpen, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '../components/ds/BrandMark';

const AboutUs: React.FC = () => {
  const { t } = useTranslation();

  const pillars = [
    { key: 'summary', icon: <BookOpen className="h-6 w-6" aria-hidden="true" /> },
    { key: 'quizz', icon: <ListChecks className="h-6 w-6" aria-hidden="true" /> },
    { key: 'progress', icon: <BarChart3 className="h-6 w-6" aria-hidden="true" /> },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-14">
      <section className="space-y-5 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{t('aboutUs.title')}</h1>
        <p
          className="mx-auto max-w-3xl text-lg leading-relaxed text-muted-foreground [&_strong]:text-foreground"
          dangerouslySetInnerHTML={{ __html: t('aboutUs.philosophy.text') }}
        />
        <div className="grid gap-4 pt-4 md:grid-cols-3">
          {pillars.map((p, i) => (
            <div key={p.key} className="rounded-2xl border border-border bg-card p-6 text-left shadow-soft animate-fade-in-up" style={{ animationDelay: `${i * 120}ms` }}>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">{p.icon}</span>
              <h2 className="mt-4 text-xl font-bold">{t(`aboutUs.pillars.${p.key}.title`)}</h2>
              <p className="mt-1 text-muted-foreground">{t(`aboutUs.pillars.${p.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid items-center gap-8 rounded-3xl bg-accent p-8 text-accent-foreground md:grid-cols-[auto_1fr] md:p-12">
        <BrandMark className="mx-auto h-28 w-28 md:h-36 md:w-36" />
        <div className="space-y-4">
          <h2 className="text-3xl font-extrabold tracking-tight">{t('aboutUs.story.title')}</h2>
          <p className="leading-relaxed [&_strong]:font-bold" dangerouslySetInnerHTML={{ __html: t('aboutUs.story.text') }} />
          <p className="font-display text-xl font-bold italic">{t('aboutUs.story.motto')}</p>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;
