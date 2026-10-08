import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { INTRO_DONUT_SEGMENTS } from '@/utils/welcomeIntro';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SceneCaption, SceneLayout, tween, useSceneValues, type IntroSceneProps } from './shared';

const PHONE_WIDTH = 124;
const PHONE_HEIGHT = 216;
const DOT = 12;

// Where each dot meets the inside of the phone's edge, from the centre.
const REACH: readonly (readonly [number, number])[] = [
  [-48, -52],
  [48, -66],
  [-48, 24],
  [48, 8],
  [-28, 92],
  [24, -92],
];

// Out to the edge, back, and a small second bounce before resting near the lock.
const TRAVEL = [0, 0.5, 0.72, 0.86, 1];
const along = (reach: number): number[] => [0, reach, reach * 0.32, reach * 0.5, reach * 0.42];

const build = ([travel, lock, second, caption]: Animated.Value[]): Animated.CompositeAnimation =>
  Animated.sequence([
    Animated.parallel([tween(caption, 350, 150), tween(travel, 1100, 100, Easing.inOut(Easing.quad))]),
    tween(lock, 350),
    tween(second, 400, 150),
  ]);

/** Scene 7: dots try to leave the phone, bounce off its edge, and a lock appears. */
export function PrivacyScene({ reduceMotion }: IntroSceneProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [travel, lock, second, caption] = useSceneValues(4, reduceMotion, build);

  return (
    <SceneLayout
      caption={
        <>
          <SceneCaption text={t('welcome.intro.nothingLeaves')} value={caption} />
          <SceneCaption text={t('welcome.intro.forFamilies')} value={second} secondary />
        </>
      }
    >
      <View style={[styles.phone, { borderColor: colors.textSecondary, backgroundColor: colors.card }]}>
        <View style={[styles.speaker, { backgroundColor: colors.track }]} />
        {REACH.map(([x, y], index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: INTRO_DONUT_SEGMENTS[index % INTRO_DONUT_SEGMENTS.length].color,
                transform: [
                  { translateX: travel.interpolate({ inputRange: TRAVEL, outputRange: along(x) }) },
                  { translateY: travel.interpolate({ inputRange: TRAVEL, outputRange: along(y) }) },
                ],
              },
            ]}
          />
        ))}
        <Animated.View
          style={[
            styles.lock,
            {
              backgroundColor: colors.surface,
              opacity: lock,
              transform: [{ scale: lock.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            },
          ]}
        >
          <Ionicons name="lock-closed" size={26} color={colors.accent} />
        </Animated.View>
      </View>
    </SceneLayout>
  );
}

const styles = StyleSheet.create({
  phone: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speaker: { position: 'absolute', top: 10, width: 36, height: 5, borderRadius: 3 },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2 },
  lock: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
