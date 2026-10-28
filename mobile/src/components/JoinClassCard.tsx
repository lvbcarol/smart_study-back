// O aluno entra (ou sai) de uma turma pelo código que o professor passou
import React, { useState } from 'react';
import { View } from 'react-native';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { Badge, Button, Card, Field, T } from '@/ui';

export function JoinClassCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, refreshLinks } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);
  const turmas = user?.turmas ?? [];

  const join = async () => {
    setBusy(true); setNote(null);
    try {
      const { data } = await api.post<{ already: boolean; turma: { name: string } }>('/turmas/join', { code });
      setNote({ text: t(data.already ? 'joinClass.already' : 'joinClass.joined', { name: data.turma.name }), error: false });
      setCode('');
      await refreshLinks();
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      setNote({ text: t(status === 404 ? 'joinClass.invalid' : status === 429 ? 'joinClass.tooMany' : 'joinClass.error'), error: true });
    } finally {
      setBusy(false);
    }
  };

  const leave = async (id: string, name: string) => {
    setBusy(true); setNote(null);
    try {
      await api.delete(`/turmas/${id}/leave`);
      setNote({ text: t('joinClass.left', { name }), error: false });
      setConfirmLeave(null);
      await refreshLinks();
    } catch {
      setNote({ text: t('joinClass.error'), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 12 }}>
      <T variant="heading">{t('joinClass.title')}</T>
      <Badge variant={turmas.length ? 'success' : 'neutral'}>{turmas.length ? t('joinClass.linked') : t('joinClass.independent')}</Badge>
      <T variant="muted">{turmas.length ? t('joinClass.linkedHint') : t('joinClass.independentHint')}</T>

      {turmas.map((x) => (
        <View key={x._id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 }}>
          <T variant="label">{x.name}</T>
          {x.teacherName ? <T variant="small">{t('joinClass.teacher', { name: x.teacherName })}</T> : null}
          {/* confirmação em dois toques (Alert não funciona na versão web) */}
          <Button
            title={confirmLeave === x._id ? t('joinClass.leaveConfirm', { name: x.name }) : t('joinClass.leave')}
            variant={confirmLeave === x._id ? 'destructive' : 'outline'} loading={busy}
            onPress={() => (confirmLeave === x._id ? leave(x._id, x.name) : setConfirmLeave(x._id))}
          />
        </View>
      ))}

      <Field
        label={t('joinClass.codeLabel')} hint={t('joinClass.codeHint')} placeholder={t('joinClass.codePlaceholder')}
        value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={12}
      />
      <Button title={t('joinClass.join')} onPress={join} loading={busy} disabled={!code.trim()} />
      {note ? <T variant="small" color={note.error ? colors.destructive : colors.primary} accessibilityLiveRegion="polite">{note.text}</T> : null}
    </Card>
  );
}
