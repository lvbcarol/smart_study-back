// src/pages/Register.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Role } from '../types';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';
import { cn } from '@/lib/utils';

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const roles: { id: Role; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'student', label: t('auth.roleStudent'), desc: t('auth.roleStudentDesc'), icon: <BookOpen className="h-5 w-5" aria-hidden="true" /> },
    { id: 'teacher', label: t('auth.roleTeacher'), desc: t('auth.roleTeacherDesc'), icon: <GraduationCap className="h-5 w-5" aria-hidden="true" /> },
  ];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t('auth.passwordShort'));
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/usuario/register', { name, email, password, role, ...(role === 'teacher' ? { inviteCode } : {}) });
      toast.success(t('auth.registerSuccess'));
      navigate('/login');
    } catch (err: any) {
      const status = err.response?.status;
      toast.error(status === 403 ? err.response.data.error : err.response?.data?.error || t('auth.registerError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.registerTitle')}</h1>
        <p className="text-muted-foreground">{t('auth.registerSubtitle')}</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">{t('auth.iAm')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((r) => (
              <label
                key={r.id}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring',
                  role === r.id ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:bg-secondary'
                )}
              >
                <input type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} className="sr-only" disabled={isLoading} />
                <span className="flex items-center gap-2 font-semibold">{r.icon}{r.label}</span>
                <span className={cn('text-xs', role === r.id ? '' : 'text-muted-foreground')}>{r.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t('auth.name')} autoComplete="name" placeholder={t('auth.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} />
        <Field label={t('auth.email')} type="email" autoComplete="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
        <Field label={t('auth.password')} type="password" autoComplete="new-password" hint={t('auth.passwordHint')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={isLoading} />
        {role === 'teacher' && (
          <Field label={t('auth.inviteCode')} hint={t('auth.inviteHint')} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required disabled={isLoading} autoComplete="off" />
        )}

        <Button type="submit" size="lg" fullWidth loading={isLoading}>
          {isLoading ? t('auth.creating') : t('auth.createAccount')}
        </Button>
      </form>

      <div className="space-y-3 text-center text-sm text-muted-foreground">
        <p>
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">{t('auth.logIn')}</Link>
        </p>
        <p>
          {t('auth.termsPrefix')}{' '}
          <Link to="/terms-of-use" className="underline hover:text-foreground">{t('auth.termsLink')}</Link>.
        </p>
      </div>
    </div>
  );
};

export default Register;
