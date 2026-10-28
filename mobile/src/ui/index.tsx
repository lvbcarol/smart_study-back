// Componentes visuais do app, sobre os tokens do tema (mesma identidade do web)
import React, { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleProp, Text as RNText, TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';

/* ---------- Texto ---------- */
type Variant = 'display' | 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label';
const SIZES: Record<Variant, { size: number; weight: TextStyle['fontWeight']; line?: number }> = {
  display: { size: 30, weight: '800', line: 36 },
  title: { size: 24, weight: '800', line: 30 },
  heading: { size: 18, weight: '700', line: 24 },
  body: { size: 16, weight: '400', line: 24 },
  muted: { size: 15, weight: '400', line: 22 },
  small: { size: 13, weight: '500', line: 18 },
  label: { size: 14, weight: '600', line: 20 },
};

interface TProps { variant?: Variant; color?: string; style?: StyleProp<TextStyle>; children?: ReactNode; numberOfLines?: number; align?: TextStyle['textAlign']; selectable?: boolean; accessibilityLiveRegion?: 'none' | 'polite' | 'assertive' }

export const T: React.FC<TProps> = ({ variant = 'body', color, style, children, numberOfLines, align, selectable, accessibilityLiveRegion }) => {
  const { colors, fs } = useTheme();
  const v = SIZES[variant];
  const defaultColor = variant === 'muted' || variant === 'small' ? colors.mutedFg : colors.foreground;
  return (
    <RNText
      selectable={selectable} numberOfLines={numberOfLines} accessibilityLiveRegion={accessibilityLiveRegion}
      style={[{ fontSize: fs(v.size), fontWeight: v.weight, lineHeight: v.line ? fs(v.line) : undefined, color: color ?? defaultColor, textAlign: align }, style]}
    >
      {children}
    </RNText>
  );
};

/* ---------- Botão ---------- */
interface ButtonProps {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  loading?: boolean; disabled?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress, variant = 'primary', loading, disabled, icon, style, accessibilityLabel }) => {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryFg, border: colors.primary },
    secondary: { bg: colors.secondary, fg: colors.secondaryFg, border: colors.secondary },
    outline: { bg: colors.card, fg: colors.foreground, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.foreground, border: 'transparent' },
    destructive: { bg: colors.destructive, fg: colors.destructiveFg, border: colors.destructive },
  }[variant];
  return (
    <Pressable
      onPress={onPress} disabled={inactive} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        { minHeight: 48, borderRadius: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon}
      <T variant="label" color={palette.fg} style={{ fontSize: 16 }}>{title}</T>
    </Pressable>
  );
};

/* ---------- Cartão ---------- */
export const Card: React.FC<{ children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }> = ({ children, style, onPress, accessibilityLabel }) => {
  const { colors } = useTheme();
  const base: ViewStyle = { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, shadowColor: '#3A2A1A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
      {children}
    </Pressable>
  );
};

/* ---------- Campo ---------- */
interface FieldProps extends TextInputProps { label: string; hint?: string; error?: string }

export const Field = React.forwardRef<React.ComponentRef<typeof TextInput>, FieldProps>(({ label, hint, error, style, ...props }, ref) => {
  const { colors, fs } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <TextInput
        ref={ref} accessibilityLabel={label} placeholderTextColor={colors.mutedFg} autoCapitalize="none"
        style={[{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: error ? colors.destructive : colors.border, backgroundColor: colors.card, color: colors.foreground, paddingHorizontal: 14, paddingVertical: 10, fontSize: fs(16) }, style]}
        {...props}
      />
      {hint && !error ? <T variant="small">{hint}</T> : null}
      {error ? <T variant="small" color={colors.destructive}>{error}</T> : null}
    </View>
  );
});
Field.displayName = 'Field';

/* ---------- Selo ---------- */
export const Badge: React.FC<{ children: ReactNode; variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'destructive' }> = ({ children, variant = 'neutral' }) => {
  const { colors } = useTheme();
  const map = {
    neutral: { bg: colors.secondary, fg: colors.secondaryFg },
    primary: { bg: colors.accent, fg: colors.accentFg },
    success: { bg: colors.success + '22', fg: colors.success },
    warning: { bg: colors.warning + '22', fg: colors.warning },
    destructive: { bg: colors.destructive + '22', fg: colors.destructive },
  }[variant];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <T variant="small" color={map.fg} style={{ fontWeight: '700' }}>{children}</T>
    </View>
  );
};

export const scoreVariant = (score: number): 'success' | 'warning' | 'destructive' => (score >= 70 ? 'success' : score >= 50 ? 'warning' : 'destructive');

/* ---------- Tela ---------- */
interface ScreenProps { children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; contentStyle?: StyleProp<ViewStyle>; edges?: ('top' | 'bottom' | 'left' | 'right')[] }

export const Screen: React.FC<ScreenProps> = ({ children, scroll = true, refreshing, onRefresh, contentStyle, edges = ['top', 'left', 'right'] }) => {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled" contentContainerStyle={[{ padding: 20, gap: 16, paddingBottom: 40 }, contentStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 20, gap: 16 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
};

export const Loading: React.FC = () => {
  const { colors } = useTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}><ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading" /></View>;
};

export const ProgressBar: React.FC<{ value: number; max: number; label: string }> = ({ value, max, label }) => {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max, now: value }} style={{ height: 8, borderRadius: 999, backgroundColor: colors.secondary, overflow: 'hidden' }}>
      <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.primary, width: `${max ? (value / max) * 100 : 0}%` }} />
    </View>
  );
};

export const EmptyState: React.FC<{ title: string; description?: string; action?: ReactNode }> = ({ title, description, action }) => {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10, padding: 28, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border }}>
      <T variant="heading" align="center">{title}</T>
      {description ? <T variant="muted" align="center">{description}</T> : null}
      {action}
    </View>
  );
};

export const Row: React.FC<{ children: ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, style]}>{children}</View>
);
