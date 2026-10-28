// src/pages/Login.tsx
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success(t('auth.loginSuccess'));
      navigate((location.state as { from?: string } | null)?.from || '/home', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.status === 401 ? t('auth.loginError') : t('auth.genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.loginTitle')}</h1>
        <p className="text-muted-foreground">{t('auth.loginSubtitle')}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <Field
          label={t('auth.email')} type="email" autoComplete="email" placeholder={t('auth.emailPlaceholder')}
          value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading}
        />
        <Field
          label={t('auth.password')} type="password" autoComplete="current-password" placeholder={t('auth.passwordPlaceholder')}
          value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading}
        />
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">{t('auth.forgot')}</Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={isLoading}>
          {isLoading ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-primary hover:underline">{t('auth.signUp')}</Link>
      </p>
    </div>
  );
};

export default Login;
