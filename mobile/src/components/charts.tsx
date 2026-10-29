// Gráficos simples do painel de desempenho: barras em Views e linha com react-native-svg.
// Todos têm um resumo em texto no accessibilityLabel (leitor de tela) e usam as cores do tema.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeContext';
import { T } from '@/ui';

export interface Datum { key?: string; label: string; value: number; color?: string }

/** Barras verticais; toque em uma barra chama onSelect. */
export function BarChartV({ data, max, height = 150, unit = '', summary, selected, onSelect }: {
  data: Datum[]; max?: number; height?: number; unit?: string; summary: string; selected?: string | null; onSelect?: (key: string) => void;
}) {
  const { colors } = useTheme();
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: height + 40 }}>
      {data.map((d) => {
        const key = d.key ?? d.label;
        const h = Math.max(d.value > 0 ? 4 : 0, Math.round((d.value / top) * height));
        const dim = selected && selected !== key;
        const bar = (
          <View style={{ alignItems: 'center', justifyContent: 'flex-end', height: height + 40 }}>
            <T variant="small" style={{ fontSize: 11 }}>{d.value > 0 ? `${d.value}${unit}` : ''}</T>
            <View style={{ width: '70%', maxWidth: 40, height: h, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: d.color ?? colors.primary, opacity: dim ? 0.4 : 1, marginVertical: 2 }} />
            <T variant="small" numberOfLines={1} style={{ fontSize: 11, height: 16 }}>{d.label}</T>
          </View>
        );
        return onSelect ? (
          <Pressable key={key} onPress={() => onSelect(key)} accessibilityRole="button" accessibilityLabel={`${d.label}: ${d.value}${unit}`} accessibilityState={{ selected: selected === key }} style={{ flex: 1 }}>{bar}</Pressable>
        ) : <View key={key} style={{ flex: 1 }}>{bar}</View>;
      })}
    </View>
  );
}

/** Barras horizontais de 0 a 100 (percentuais), cada uma com a sua cor. */
export function BarChartH({ data, summary }: { data: Datum[]; summary: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ gap: 12 }}>
      {data.map((d) => (
        <View key={d.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="small" style={{ color: colors.foreground }}>{d.label}</T>
            <T variant="small">{d.value < 0 ? '–' : `${d.value}%`}</T>
          </View>
          <View style={{ height: 10, borderRadius: 999, backgroundColor: colors.secondary, overflow: 'hidden' }}>
            <View style={{ height: 10, borderRadius: 999, width: `${Math.max(0, d.value)}%`, backgroundColor: d.color ?? colors.primary }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Linha de 0 a 100 com pontos; mostra o primeiro e o último rótulo no eixo. */
export function LineChart({ data, height = 160, summary }: { data: Datum[]; height?: number; summary: string }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const padX = 28;
  const padY = 14;
  const innerW = Math.max(1, width - padX - 8);
  const innerH = height - padY * 2;
  const x = (i: number) => padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padY + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: height + 20 }}>
      {width > 0 && (
        <Svg width={width} height={height + 20}>
          {[0, 50, 100].map((g) => (
            <React.Fragment key={g}>
              <Line x1={padX} x2={width - 8} y1={y(g)} y2={y(g)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={0} y={y(g) + 4} fontSize={10} fill={colors.mutedFg}>{g}</SvgText>
            </React.Fragment>
          ))}
          {data.length > 1 && <Polyline points={points} fill="none" stroke={colors.primary} strokeWidth={2} />}
          {data.map((d, i) => <Circle key={`${d.label}-${i}`} cx={x(i)} cy={y(d.value)} r={4.5} fill={colors.card} stroke={colors.primary} strokeWidth={2} />)}
          <SvgText x={x(0)} y={height + 14} fontSize={10} fill={colors.mutedFg} textAnchor={data.length === 1 ? 'middle' : 'start'}>{data[0]?.label}</SvgText>
          {data.length > 1 && <SvgText x={x(data.length - 1)} y={height + 14} fontSize={10} fill={colors.mutedFg} textAnchor="end">{data[data.length - 1].label}</SvgText>}
        </Svg>
      )}
    </View>
  );
}
