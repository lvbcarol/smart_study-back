import '@/i18n';
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

function ThemedStack() {
  const { colors, resolvedMode } = useTheme();
  return (
    <>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ThemedStack />
      </ThemeProvider>
    </AuthProvider>
  );
}
