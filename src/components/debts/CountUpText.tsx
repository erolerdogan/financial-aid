import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, type TextProps } from 'react-native';

interface CountUpTextProps extends Omit<TextProps, 'children'> {
  value: number;
  /** Turns the running number into the text to show; called for every frame. */
  formatValue: (value: number) => string;
}

const DURATION_MS = 450;

// Runs from the number on screen to the new one. Under "Reduce Motion" the new number is shown at once.
export function CountUpText({ value, formatValue, ...textProps }: CountUpTextProps) {
  // RN Animated, not Reanimated: Reanimated cannot be imported under this tsconfig.
  const [progress] = useState(() => new Animated.Value(0));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = progress.addListener((state) => setShown(state.value));
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    let cancelled = false;
    let running: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          progress.setValue(value);
          return;
        }
        running = Animated.timing(progress, {
          toValue: value,
          duration: DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
        running.start();
      });

    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [value, progress]);

  return <Text {...textProps}>{formatValue(shown)}</Text>;
}
