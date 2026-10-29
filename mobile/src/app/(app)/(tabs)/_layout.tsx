import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, fs } = useTheme();

  const tab = (name: string, title: string, icon: IconName) => (
    <Tabs.Screen
      name={name}
      options={{ title, tabBarIcon: ({ color, size }) => <Ionicons name={icon} size={size} color={color as string} />, tabBarAccessibilityLabel: title }}
    />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedFg,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: fs(11), fontWeight: '600' },
      }}
    >
      {tab('home', t('tabs.home'), 'home-outline')}
      {tab('notebooks', t('tabs.notebooks'), 'book-outline')}
      {tab('agenda', t('tabs.agenda'), 'calendar-outline')}
      {tab('flashcards', t('tabs.flashcards'), 'layers-outline')}
      {tab('performance', t('tabs.performance'), 'stats-chart-outline')}
      {tab('profile', t('tabs.profile'), 'person-outline')}
    </Tabs>
  );
}
