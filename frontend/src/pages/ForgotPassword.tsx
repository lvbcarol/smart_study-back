// src/pages/ForgotPassword.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/usuario/forgot-password', { email });
      toast.success(t('auth.forgotSent'));
    } catch (error: any) {
      toast.error(error.response?.status === 501 ? t('auth.forgotUnavailable') : error.response?.data?.error || t('auth.genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.forgotTitle')}</h1>
        <p className="text-muted-foreground">{t('auth.forgotDesc')}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t('auth.email')} type="email" autoComplete="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
        <Button type="submit" size="lg" fullWidth loading={isLoading}>{isLoading ? t('auth.sending') : t('auth.sendLink')}</Button>
      </form>
      <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('auth.backToLogin')}
      </Link>
    </div>
  );
};

export default ForgotPassword;
