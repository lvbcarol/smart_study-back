import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useTheme } from '@/theme/ThemeContext';
import { Button, Loading, T, useKeyboardOffset } from '@/ui';

interface Message { sender: 'user' | 'bot'; text: string }

export default function Summary() {
  const { t, i18n } = useTranslation();
  const { colors, fs } = useTheme();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  useStudyTimer('summary', lessonId);
  const [title, setTitle] = useState('');
  const [materials, setMaterials] = useState(0);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { root, offset, onLayout: measure } = useKeyboardOffset();

  useEffect(() => {
    api.get(`/lessons/${lessonId}`).then((r) => {
      setTitle(r.data.lessonTitle);
      setMaterials(r.data.materialsCount ?? 0);
      if (r.data.chatHistory?.length) { setMessages(r.data.chatHistory); setSaved(true); }
      else setMessages([{ sender: 'bot', text: t('summary.initial') }]);
    }).catch(() => setMessages([{ sender: 'bot', text: t('summary.aiError') }]));
  }, [lessonId, t]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !messages) return;
    const next: Message[] = [...messages, { sender: 'user', text }];
    setMessages(next); setInput(''); setBusy(true); setSaved(false); setNote('');
    try {
      const first = !messages.some((m) => m.sender === 'user');
      const reply = first
        ? (await api.post('/ai/summarize', { topic: text, language: i18n.language, lessonId })).data.summary
        : (await api.post('/ai/chat', { lessonId, message: text, language: i18n.language, history: messages })).data.reply;
      setMessages([...next, { sender: 'bot', text: reply }]);
    } catch {
      setMessages([...next, { sender: 'bot', text: t('summary.aiError') }]);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    try {
      await api.put(`/lessons/${lessonId}/chat`, { messages });
      setSaved(true); setNote(t('summary.saved'));
    } catch { setNote(t('summary.saveError')); }
  };

  if (!messages) return <Loading />;

  const mdStyle = {
    body: { color: colors.foreground, fontSize: fs(16), lineHeight: fs(24) },
    heading1: { color: colors.foreground, fontSize: fs(22), fontWeight: '800' as const, marginTop: 8 },
    heading2: { color: colors.foreground, fontSize: fs(19), fontWeight: '700' as const, marginTop: 8 },
    heading3: { color: colors.foreground, fontSize: fs(17), fontWeight: '700' as const },
    strong: { color: colors.foreground, fontWeight: '700' as const },
    blockquote: { backgroundColor: colors.secondary, borderLeftColor: colors.primary, borderLeftWidth: 3, paddingHorizontal: 10, marginVertical: 6 },
    code_inline: { backgroundColor: colors.secondary, color: colors.foreground },
    link: { color: colors.primary },
  };

  const canSave = messages.length > 1 && !saved && !busy;

  return (
    <View ref={root} collapsable={false} onLayout={measure} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: title || t('lesson.summary') }} />
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={offset} style={{ flex: 1 }}>
        <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
        <ScrollView ref={scroller} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {materials > 0 && (
            <View style={{ backgroundColor: colors.accent, borderRadius: 14, padding: 10 }}>
              <T variant="small" color={colors.accentFg}>📎 {t('lesson.materials', { count: materials })}</T>
            </View>
          )}
          {messages.map((m, i) => (
            <View
              key={i} accessibilityLiveRegion="polite"
              style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', borderRadius: 18, padding: 12, backgroundColor: m.sender === 'user' ? colors.primary : colors.card, borderWidth: m.sender === 'user' ? 0 : 1, borderColor: colors.border }}
            >
              {m.sender === 'user'
                ? <T variant="body" color={colors.primaryFg}>{m.text}</T>
                : <Markdown style={mdStyle}>{m.text}</Markdown>}
            </View>
          ))}
          {busy && <T variant="muted" accessibilityLiveRegion="polite">{t('summary.thinking')}</T>}
          {canSave && <Button title={t('summary.save')} variant="secondary" onPress={save} />}
          {note ? <T variant="small" color={colors.primary}>{note}</T> : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card, alignItems: 'flex-end' }}>
          <TextInput
            value={input} onChangeText={setInput} editable={!busy} multiline onSubmitEditing={send} blurOnSubmit
            placeholder={messages.some((m) => m.sender === 'user') ? t('summary.followUp') : t('summary.placeholder')} placeholderTextColor={colors.mutedFg}
            accessibilityLabel={t('summary.placeholder')}
            style={{ flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground, paddingHorizontal: 14, paddingVertical: 12, fontSize: fs(16) }}
          />
          <Pressable
            onPress={send} disabled={busy || !input.trim()} accessibilityRole="button" accessibilityLabel={t('summary.send')}
            style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: busy || !input.trim() ? 0.5 : 1 }}
          >
            <Ionicons name="send" size={20} color={colors.primaryFg} />
          </Pressable>
        </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
