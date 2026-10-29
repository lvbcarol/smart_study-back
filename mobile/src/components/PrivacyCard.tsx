// Privacidade (LGPD): o aluno decide o que o professor vê e pode excluir a conta
import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { Button, Card, Field, T } from '@/ui';

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="label">{label}</T>
        <T variant="small">{desc}</T>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

export function PrivacyCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, savePreferences, deleteAccount } = useAuth();
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const save = async (changes: { shareStudyTimeWithTeacher?: boolean; showLearningProfile?: boolean }) => {
    try { await savePreferences(changes); setNote({ text: t('privacy.saved'), error: false }); } catch { setNote({ text: t('privacy.saveError'), error: true }); }
  };

  const remove = async () => {
    setBusy(true);
    try { await deleteAccount(password); } catch { setNote({ text: t('privacy.deleteError'), error: true }); setBusy(false); }
  };

  return (
    <Card style={{ gap: 14 }}>
      <T variant="heading">{t('privacy.title')}</T>
      <T variant="small">{t('privacy.desc')}</T>
      <Toggle label={t('privacy.shareTime')} desc={t('privacy.shareTimeDesc')} value={!!user.shareStudyTimeWithTeacher} onChange={(v) => save({ shareStudyTimeWithTeacher: v })} />
      <Toggle label={t('privacy.showProfile')} desc={t('privacy.showProfileDesc')} value={user.showLearningProfile !== false} onChange={(v) => save({ showLearningProfile: v })} />
      {note ? <T variant="small" color={note.error ? colors.destructive : colors.primary} accessibilityLiveRegion="polite">{note.text}</T> : null}

      <T variant="small">{t('privacy.exportOnWeb')}</T>
      {confirming ? (
        <View style={{ gap: 10 }}>
          <T variant="small">{t('privacy.deleteBody')}</T>
          <Field label={t('privacy.passwordLabel')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
          <Button title={t('privacy.deleteConfirm')} variant="destructive" onPress={remove} loading={busy} disabled={!password} />
          <Button title={t('common.cancel')} variant="ghost" onPress={() => { setConfirming(false); setPassword(''); }} />
        </View>
      ) : (
        <Button title={t('privacy.delete')} variant="outline" onPress={() => setConfirming(true)} />
      )}
    </Card>
  );
}
