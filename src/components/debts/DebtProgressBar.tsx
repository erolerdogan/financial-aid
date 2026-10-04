import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface DebtProgressBarProps {
  percent: number;
  color: string;
  height?: number;
}

export function DebtProgressBar({ percent, color, height = 10 }: DebtProgressBarProps) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent, anim]);

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: colors.track },
      ]}
    >
      <Animated.View style={{ height: '100%', width, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});