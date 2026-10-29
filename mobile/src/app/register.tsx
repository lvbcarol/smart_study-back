import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { AuthHero } from '@/components/AuthHero';
import { Button, Field, Screen, T } from '@/ui';

export default function Register() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { register, login } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  const submit = async () => {
    if (password.length < 6) return setError(t('auth.passwordShort'));
    setLoading(true);
    setError('');
    try {
      await register(name.trim(), email.trim(), password);
      await login(email.trim(), password);
      router.replace('/home');
    } catch (e: any) {
      setError(e.response?.data?.error ?? t('auth.registerError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: 24 }}>
      <AuthHero pose="happy" message={t('auth.bobRegister')} />
      <View style={{ gap: 6 }}>
        <T variant="display">{t('auth.registerTitle')}</T>
        <T variant="muted">{t('auth.registerSubtitle')}</T>
      </View>
      <Field label={t('auth.name')} value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      <Field label={t('auth.email')} placeholder={t('auth.emailPlaceholder')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint={t('auth.passwordHint')} />
      {error ? <T variant="small" color={colors.destructive}>{error}</T> : null}
      <Pressable
        onPress={() => setAccepted((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} accessibilityLabel={t('auth.acceptTerms')}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
      >
        <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: accepted ? colors.primary : colors.border, backgroundColor: accepted ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {accepted && <Ionicons name="checkmark" size={18} color={colors.primaryFg} />}
        </View>
        <T variant="small" style={{ flex: 1 }}>{t('auth.acceptTerms')}</T>
      </Pressable>
      <Button title={loading ? t('auth.creating') : t('auth.createAccount')} onPress={submit} loading={loading} disabled={!name || !email || !password || !accepted} />
      <T variant="muted" align="center">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" style={{ color: colors.primary, fontWeight: '700' }}>{t('auth.logIn')}</Link>
      </T>
    </Screen>
  );
}
