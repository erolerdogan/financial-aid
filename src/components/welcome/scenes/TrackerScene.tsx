import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue } from 'react-native';
import { PACE, SceneCaption, SceneLayout, tween, useSceneValues, type IntroSceneProps } from './shared';

// Widths of the two bars of each made-up row; no text, no amounts.
const ROWS: readonly (readonly [DimensionValue, DimensionValue])[] = [
  ['58%', '34%'],
  ['44%', '26%'],
  ['66%', '40%'],
  ['50%', '30%'],
  ['62%', '22%'],
  ['40%', '36%'],
];

const build = ([rowsIn, crumple, cross, caption]: Animated.Value[]): Animated.CompositeAnimation =>
  Animated.sequence([
    tween(rowsIn, 450),
    Animated.delay(250 * PACE),
    Animated.parallel([
      tween(crumple, 450, 0, Easing.inOut(Easing.cubic)),
      tween(cross, 320, 300, Easing.out(Easing.back(1.8))),
      tween(caption, 400, 250),
    ]),
  ]);

/** Scene 2: a grey transaction list scrolls in, then shrinks, tilts and dims under a cross. */
export function TrackerScene({ reduceMotion }: IntroSceneProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [rowsIn, crumple, cross, caption] = useSceneValues(4, reduceMotion, build);

  return (
    <SceneLayout caption={<SceneCaption text={t('welcome.intro.notTracker')} value={caption} />}>
      <Animated.View
        style={[
          styles.listSlot,
          {
            opacity: rowsIn,
            transform: [{ translateY: rowsIn.interpolate({ inputRange: [0, 1], outputRange: [70, 0] }) }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.list,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              // It stays in the picture, so the caption is never left alone on the screen.
              opacity: crumple.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
              transform: [
                { scale: crumple.interpolate({ inputRange: [0, 1], outputRange: [1, 0.66] }) },
                { rotate: crumple.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] }) },
              ],
            },
          ]}
        >
          {ROWS.map(([title, detail], index) => (
            <View key={index} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: colors.track }]} />
              <View style={styles.rowBody}>
                <View style={[styles.bar, { width: title, backgroundColor: colors.track }]} />
                <View style={[styles.barSmall, { width: detail, backgroundColor: colors.surface }]} />
              </View>
              <View style={[styles.amount, { backgroundColor: colors.track }]} />
            </View>
          ))}
        </Animated.View>

        <View style={styles.crossSlot} pointerEvents="none">
          <Animated.View
            style={[styles.cross, { backgroundColor: colors.accent, opacity: cross, transform: [{ scale: cross }] }]}
          >
            <Ionicons name="close" size={36} color="#FFFFFF" />
          </Animated.View>
        </View>
      </Animated.View>
    </SceneLayout>
  );
}

const styles = StyleSheet.create({
  listSlot: { width: '100%', maxWidth: 300 },
  list: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 8, paddingHorizontal: 14 },
  crossSlot: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  cross: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 38 },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  rowBody: { flex: 1, gap: 6 },
  bar: { height: 8, borderRadius: 4 },
  barSmall: { height: 6, borderRadius: 3 },
  amount: { width: 38, height: 8, borderRadius: 4 },
});
