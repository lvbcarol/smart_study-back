import React, { useState } from 'react';
import { View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { AuthHero } from '@/components/AuthHero';
import { Button, Field, Screen, T } from '@/ui';

export default function Login() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Redirect href="/home" />;

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.response ? t('auth.invalid') : t('auth.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: 24 }}>
      <AuthHero pose="wave" message={t('auth.bobLogin')} />
      <View style={{ gap: 6 }}>
        <T variant="small" color={colors.primary} style={{ fontWeight: '800', letterSpacing: 1 }}>SMART STUDY</T>
        <T variant="display">{t('auth.loginTitle')}</T>
        <T variant="muted">{t('auth.loginSubtitle')}</T>
      </View>
      <Field label={t('auth.email')} placeholder={t('auth.emailPlaceholder')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label={t('auth.password')} placeholder={t('auth.passwordPlaceholder')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      {error ? <T variant="small" color={colors.destructive} >{error}</T> : null}
      <Button title={loading ? t('auth.signingIn') : t('auth.signIn')} onPress={submit} loading={loading} disabled={!email || !password} />
      <T variant="muted" align="center">
        {t('auth.noAccount')}{' '}
        <Link href="/register" style={{ color: colors.primary, fontWeight: '700' }}>{t('auth.signUp')}</Link>
      </T>
    </Screen>
  );
}
