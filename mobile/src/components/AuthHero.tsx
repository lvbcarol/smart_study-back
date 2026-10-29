// Topo das telas de entrada: Bob com balão de fala e os ícones do tema de estudo (livro, notebook, capelo de TCC, código)
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeContext';
import { Mascot } from '@/components/mascot/Mascot';
import type { MascotPose } from '@/components/mascot/shapes';
import { T } from '@/ui';

const ICONS = ['book-outline', 'laptop-outline', 'school-outline', 'code-slash-outline'] as const;

export function AuthHero({ pose, message }: { pose: MascotPose; message: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Mascot pose={pose} size={120} label={t('auth.bobAlt')} />
        <View style={{ flex: 1, marginBottom: 56, backgroundColor: colors.accent, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
          <T variant="small" color={colors.accentFg} style={{ fontWeight: '700' }}>{message}</T>
        </View>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 10 }}>
        {ICONS.map((name) => (
          <View key={name} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={name} size={22} color={colors.primary} />
          </View>
        ))}
      </View>
    </View>
  );
}
