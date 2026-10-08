import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

export interface IntroSceneProps {
  /** Show the finished picture at once instead of animating towards it. */
  reduceMotion: boolean;
}

/** Height of the picture above the caption; the same in every scene so pictures line up across a scene change. */
export const ART_HEIGHT = 260;

/** Stretches every step of every scene; raise it for a calmer intro (scene durations are in `welcomeIntro.ts`). */
export const PACE = 1.35;

/** One step of a scene: `value` runs from 0 to 1, where 1 is the finished picture. `duration` and `delay` are stretched by `PACE`. */
export const tween = (
  value: Animated.Value,
  duration: number,
  delay = 0,
  easing: (input: number) => number = Easing.out(Easing.cubic)
): Animated.CompositeAnimation =>
  Animated.timing(value, { toValue: 1, duration: duration * PACE, delay: delay * PACE, easing, useNativeDriver: true });

/**
 * The values a scene animates, all 0 → 1, started on mount and stopped on unmount.
 * With reduced motion they start at 1. `build` must be a module-level function.
 * RN Animated, not Reanimated: Reanimated cannot be imported under this tsconfig.
 */
export function useSceneValues(
  count: number,
  reduceMotion: boolean,
  build: (values: Animated.Value[]) => Animated.CompositeAnimation
): Animated.Value[] {
  // State, not a ref: the values are read while rendering (interpolate).
  const [values] = useState(() => Array.from({ length: count }, () => new Animated.Value(reduceMotion ? 1 : 0)));

  useEffect(() => {
    if (reduceMotion) return;
    const running = build(values);
    running.start();
    return () => running.stop();
  }, [build, reduceMotion, values]);

  return values;
}

interface SceneLayoutProps {
  /** The picture. */
  children: React.ReactNode;
  /** Caption lines below the picture. */
  caption: React.ReactNode;
}

export function SceneLayout({ children, caption }: SceneLayoutProps) {
  return (
    <View style={styles.scene}>
      <View style={styles.art}>{children}</View>
      <View style={styles.captions}>{caption}</View>
    </View>
  );
}

interface SceneCaptionProps {
  text: string;
  /** Opacity; shown at once when left out. */
  value?: Animated.Value;
  secondary?: boolean;
}

export function SceneCaption({ text, value, secondary = false }: SceneCaptionProps) {
  const { colors } = useTheme();

  // Does nothing without a screen reader.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text);
  }, [text]);

  return (
    <Animated.Text
      style={[
        secondary ? styles.captionSecondary : styles.caption,
        { color: secondary ? colors.textSecondary : colors.text },
        value ? { opacity: value } : null,
      ]}
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  art: { width: '100%', height: ART_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  captions: { minHeight: 96, marginTop: 28, alignItems: 'center', gap: 10 },
  caption: { fontSize: 25, fontWeight: '700', textAlign: 'center', letterSpacing: -0.4, lineHeight: 31 },
  captionSecondary: { fontSize: 16, fontWeight: '500', textAlign: 'center', lineHeight: 22 },
});
