// Bob, o robô-professor (mascote do Smart Study). O desenho vem de shapes.ts, igual ao do site.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeContext';
import { MASCOT_VIEWBOX, mascotShapes, MascotPose } from './shapes';

const TAGS = { rect: Rect, circle: Circle, path: Path, line: Line, polygon: Polygon, polyline: Polyline, ellipse: Ellipse } as const;

interface MascotProps {
  pose?: MascotPose;
  /** largura em px (a altura acompanha) */
  size?: number;
  /** descrição para leitores de tela; sem ela o desenho é decorativo */
  label?: string;
  /** balança de leve (desligado com "reduzir movimento") */
  animated?: boolean;
}

export function Mascot({ pose = 'wave', size = 140, label, animated = true }: MascotProps) {
  const { colors } = useTheme();
  const y = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined); }, []);
  useEffect(() => {
    if (!animated || reduceMotion) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -5, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(y, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animated, reduceMotion, y]);

  const shapes = mascotShapes({
    primary: colors.primary, accent: colors.accent,
    detail1: colors.charts[1], detail2: colors.charts[3], detail3: colors.charts[2],
  }, pose);

  return (
    <Animated.View
      accessible={!!label} accessibilityRole={label ? 'image' : undefined} accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'} style={{ transform: [{ translateY: y }] }}
    >
      <Svg width={size} height={Math.round(size * (232 / 200))} viewBox={MASCOT_VIEWBOX}>
        {shapes.map((shape, i) => {
          const Tag = TAGS[shape.t] as unknown as React.ComponentType<Record<string, string | number>>;
          return <Tag key={i} {...shape.p} />;
        })}
      </Svg>
    </Animated.View>
  );
}

export default Mascot;
