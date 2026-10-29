import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { PALETTES } from '@/theme/palettes';
import { JoinClassCard } from '@/components/JoinClassCard';
import { PrivacyCard } from '@/components/PrivacyCard';
import { Badge, Button, Card, Row, Screen, T } from '@/ui';

/** Opção selecionável (rádio) com estado acessível. */
function Choice({ label, selected, onPress, children, disabled }: { label: string; selected: boolean; onPress: () => void; children?: React.ReactNode; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress} disabled={disabled} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected, disabled }}
      style={{ opacity: disabled ? 0.5 : 1, flexGrow: 1, minHeight: 48, borderRadius: 14, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.accent : colors.card, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', gap: 6 }}
    >
      {children}
      <T variant="label" color={selected ? colors.accentFg : undefined}>{label}</T>
    </Pressable>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, logout, savePreferences } = useAuth();
  const { colors, mode, palette, fontScale, resolvedMode, modeLocked, update } = useTheme();
  const router = useRouter();

  const sizes = [[0.9, t('profile.sizes.small')], [1, t('profile.sizes.normal')], [1.15, t('profile.sizes.large')]] as const;
  const currentSize = sizes.reduce((best, s) => (Math.abs(s[0] - fontScale) < Math.abs(best[0] - fontScale) ? s : best));

  return (
    <Screen>
      <View style={{ paddingTop: 8 }}><T variant="title">{t('profile.title')}</T></View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="title" color={colors.primaryFg}>{user?.name.charAt(0).toUpperCase()}</T>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="heading">{user?.name}</T>
          <T variant="muted" numberOfLines={1}>{user?.email}</T>
          <Badge variant="primary">{t('profile.role')}</Badge>
        </View>
      </Card>

      <JoinClassCard />

      <Card style={{ gap: 14 }}>
        <T variant="heading">{t('profile.appearance')}</T>

        <T variant="label">{t('profile.mode')}</T>
        {modeLocked && <T variant="small" accessibilityLiveRegion="polite">{t('profile.modeLocked')}</T>}
        <Row style={{ flexWrap: 'nowrap' }} >
          {(['light', 'dark', 'system'] as const).map((m) => (
            <Choice key={m} label={t(`profile.${m}`)} selected={mode === m} disabled={modeLocked} onPress={() => update({ mode: m })} />
          ))}
        </Row>

        <T variant="label">{t('profile.palette')}</T>
        <Row style={{ gap: 10 }}>
          {PALETTES.map((p) => (
            <Choice key={p.id} label={p.name} selected={palette === p.id} onPress={() => update({ palette: p.id })}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[p[resolvedMode].primary, p[resolvedMode].accent, p[resolvedMode].charts[1]].map((c, i) => (
                  <View key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: c, borderWidth: 1, borderColor: colors.border }} />
                ))}
              </View>
            </Choice>
          ))}
        </Row>

        <T variant="label">{t('profile.textSize')}</T>
        <Row style={{ flexWrap: 'nowrap' }}>
          {sizes.map(([value, label]) => (
            <Choice key={value} label={label} selected={currentSize[0] === value} onPress={() => update({ fontScale: value })} />
          ))}
        </Row>

        <T variant="label">{t('profile.language')}</T>
        <Row style={{ flexWrap: 'nowrap' }}>
          {([['pt-BR', 'Português'], ['es-ES', 'Español'], ['en-US', 'English']] as const).map(([lang, label]) => (
            <Choice key={lang} label={label} selected={user?.language === lang} onPress={() => savePreferences({ language: lang }).catch(() => undefined)} />
          ))}
        </Row>
      </Card>

      <PrivacyCard />

      <Button title={t('profile.logout')} variant="outline" onPress={async () => { await logout(); router.replace('/login'); }} />
    </Screen>
  );
}
