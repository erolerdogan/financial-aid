import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface ScoreRingProps {
  /** 0-100; null draws the empty track. */
  score: number | null;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
  /** Sweep from empty on mount and on change. Skipped when the system asks for reduced motion. */
  animated?: boolean;
  children?: React.ReactNode;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// RN Animated, not Reanimated: Reanimated cannot be imported under this tsconfig.
export function ScoreRing({ score, size, strokeWidth, color, trackColor, animated = false, children }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = score === null ? 0 : Math.min(1, Math.max(0, score / 100));
  // State, not a ref: the value is read while rendering (interpolate).
  const [progress] = useState(() => new Animated.Value(animated ? 0 : fraction));

  useEffect(() => {
    if (!animated) {
      progress.setValue(fraction);
      return;
    }

    let cancelled = false;
    let running: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          progress.setValue(fraction);
          return;
        }
        running = Animated.timing(progress, {
          toValue: fraction,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
        running.start();
      });

    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [animated, fraction, progress]);

  const strokeDashoffset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {score !== null && (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            // Start at 12 o'clock.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
