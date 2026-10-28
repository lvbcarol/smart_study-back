// src/pages/ResetPassword.tsx
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { token } = useParams();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error(t('auth.mismatch'));
    if (!token) return toast.error(t('auth.tokenMissing'));
    setIsLoading(true);
    try {
      await api.post('/usuario/reset-password', { token, password });
      toast.success(t('auth.resetSuccess'));
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.status === 501 ? t('auth.forgotUnavailable') : error.response?.data?.error || t('auth.genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.resetTitle')}</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t('auth.newPassword')} type="password" autoComplete="new-password" hint={t('auth.passwordHint')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <Field label={t('auth.confirmPassword')} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        <Button type="submit" size="lg" fullWidth loading={isLoading}>{isLoading ? t('auth.saving') : t('auth.resetDo')}</Button>
      </form>
    </div>
  );
};

export default ResetPassword;
