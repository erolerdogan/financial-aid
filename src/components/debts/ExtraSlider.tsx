import { TabSwipeBlocker } from '@/contexts/TabSwipeContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type GestureResponderEvent } from 'react-native';

interface ExtraSliderProps {
  value: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** The value as VoiceOver reads it, e.g. "€ 150". */
  valueText: string;
}

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;
const TOUCH_HEIGHT = 44;

// The responder props PanResponder is built on, not a native slider: no extra native module, and Reanimated cannot be imported under this tsconfig.
export function ExtraSlider({ value, max, step, onChange, accessibilityLabel, valueText }: ExtraSliderProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const clamped = Math.min(Math.max(0, value), max);
  // Page x of the track's left edge, taken when a touch starts.
  const trackLeft = useRef(0);

  const moveTo = (pageX: number) => {
    const usable = width - THUMB_SIZE;
    if (usable <= 0 || max <= 0) return;
    const fraction = Math.min(1, Math.max(0, (pageX - trackLeft.current - THUMB_SIZE / 2) / usable));
    const next = Math.min(max, Math.round((fraction * max) / step) * step);
    if (next === clamped) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  const onGrant = (event: GestureResponderEvent) => {
    // The children take no touches, so `locationX` is measured from the track itself.
    trackLeft.current = event.nativeEvent.pageX - event.nativeEvent.locationX;
    moveTo(event.nativeEvent.pageX);
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const delta = event.nativeEvent.actionName === 'increment' ? step : event.nativeEvent.actionName === 'decrement' ? -step : 0;
    if (delta === 0) return;
    const next = Math.min(max, Math.max(0, Math.round((clamped + delta) / step) * step));
    if (next !== clamped) onChange(next);
  };

  const fraction = max > 0 ? clamped / max : 0;
  const thumbLeft = Math.max(0, width - THUMB_SIZE) * fraction;

  return (
    <TabSwipeBlocker>
      <View
        style={styles.touch}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: valueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // The page scroll view must not take the drag back half-way.
        onResponderTerminationRequest={() => false}
        onResponderGrant={onGrant}
        onResponderMove={(event) => moveTo(event.nativeEvent.pageX)}
      >
        <View style={[styles.track, { backgroundColor: colors.track }]} pointerEvents="none">
          <View style={[styles.fill, { backgroundColor: colors.accent, width: thumbLeft + THUMB_SIZE / 2 }]} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.thumb, { left: thumbLeft, backgroundColor: colors.raised, borderColor: colors.border }]}
        />
      </View>
    </TabSwipeBlocker>
  );
}

const styles = StyleSheet.create({
  touch: { height: TOUCH_HEIGHT, justifyContent: 'center' },
  track: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, overflow: 'hidden' },
  fill: { height: TRACK_HEIGHT },
  thumb: {
    position: 'absolute',
    top: (TOUCH_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
