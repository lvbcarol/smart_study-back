// Lembretes motivacionais contextuais na Home (dispensáveis)
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useTheme } from '@/theme/ThemeContext';
import { T } from '@/ui';

interface Nudge { id: string; kind: string; params: Record<string, string | number> }

export function NudgesCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<{ nudges: Nudge[] }>('/study/nudges', { params: { tzOffset: new Date().getTimezoneOffset() } })
      .then((r) => setNudges(r.data.nudges)).catch(() => setNudges([]));
  }, []);

  const visible = nudges.filter((n) => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      {visible.map((n) => (
        <View key={n.id} accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.accent, borderRadius: 16, padding: 12 }}>
          <Ionicons name="sparkles-outline" size={20} color={colors.accentFg} style={{ marginTop: 2 }} />
          <T variant="small" color={colors.accentFg} style={{ flex: 1, fontWeight: '600' }}>{t(`nudge.${n.kind}`, n.params)}</T>
          <Pressable onPress={() => setDismissed((d) => new Set(d).add(n.id))} accessibilityRole="button" accessibilityLabel={t('nudge.dismiss')} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.accentFg} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
