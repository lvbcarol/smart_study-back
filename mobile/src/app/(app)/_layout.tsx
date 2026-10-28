import React from 'react';
import { View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { Button, Loading, Screen, T } from '@/ui';

export default function AppLayout() {
  const { t } = useTranslation();
  const { user, loading, logout } = useAuth();
  const { colors } = useTheme();

  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;

  // o app é para alunos; professores usam o site
  if (user.role === 'teacher') {
    return (
      <Screen>
        <View style={{ gap: 12, paddingTop: 48 }}>
          <T variant="title">{t('teacher.title')}</T>
          <T variant="muted">{t('teacher.text')}</T>
          <Button title={t('teacher.logout')} variant="outline" onPress={logout} />
        </View>
      </Screen>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
