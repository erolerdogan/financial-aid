import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SceneCaption, SceneLayout, tween, useSceneValues, type IntroSceneProps } from './shared';

export const BANK_CARD_WIDTH = 160;
export const BANK_CARD_HEIGHT = 100;
export const BANK_CARD_RADIUS = 16;

// Keyframes of the one value: apart, fanned out, merged.
const STEPS = [0, 0.55, 1];

interface CardPath {
  x: number[];
  y: number[];
  rotate: string[];
  /** Fades into the front card on the merge. */
  absorbed: boolean;
}

// The front card is the last one.
const PATHS: readonly CardPath[] = [
  { x: [-170, -26, 0], y: [-30, -12, 0], rotate: ['-12deg', '-7deg', '0deg'], absorbed: true },
  { x: [170, 26, 0], y: [-30, -12, 0], rotate: ['12deg', '7deg', '0deg'], absorbed: true },
  { x: [0, 0, 0], y: [150, 10, 0], rotate: ['0deg', '0deg', '0deg'], absorbed: false },
];

const build = ([move, caption]: Animated.Value[]): Animated.CompositeAnimation =>
  Animated.parallel([tween(caption, 400, 200), tween(move, 1400, 100, Easing.inOut(Easing.quad))]);

interface CardFaceProps {
  ink: string;
}

function CardFace({ ink }: CardFaceProps) {
  return (
    <View style={styles.face}>
      <View style={[styles.chip, { backgroundColor: ink }]} />
      <View style={styles.lines}>
        <View style={[styles.line, { backgroundColor: ink }]} />
        <View style={[styles.lineShort, { backgroundColor: ink }]} />
      </View>
    </View>
  );
}

/** Scene 4: three plain bank cards slide together and become one. */
export function BanksScene({ reduceMotion }: IntroSceneProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [move, caption] = useSceneValues(2, reduceMotion, build);

  return (
    <SceneLayout caption={<SceneCaption text={t('welcome.intro.allBanks')} value={caption} />}>
      <View style={styles.stack}>
        {PATHS.map((path, index) => (
          <Animated.View
            key={index}
            style={[
              styles.card,
              {
                opacity: move.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 1, 1, path.absorbed ? 0 : 1],
                }),
                transform: [
                  { translateX: move.interpolate({ inputRange: STEPS, outputRange: path.x }) },
                  { translateY: move.interpolate({ inputRange: STEPS, outputRange: path.y }) },
                  { rotate: move.interpolate({ inputRange: STEPS, outputRange: path.rotate }) },
                ],
              },
            ]}
          >
            {path.absorbed ? (
              <View
                style={[
                  styles.fill,
                  styles.bordered,
                  { backgroundColor: index === 0 ? colors.card : colors.surface, borderColor: colors.border },
                ]}
              >
                <CardFace ink={colors.track} />
              </View>
            ) : (
              <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
                <CardFace ink={`${colors.onGradient}55`} />
              </LinearGradient>
            )}
          </Animated.View>
        ))}
      </View>
    </SceneLayout>
  );
}

const styles = StyleSheet.create({
  stack: { width: BANK_CARD_WIDTH, height: BANK_CARD_HEIGHT },
  card: { position: 'absolute', width: BANK_CARD_WIDTH, height: BANK_CARD_HEIGHT },
  fill: { flex: 1, borderRadius: BANK_CARD_RADIUS, overflow: 'hidden' },
  bordered: { borderWidth: StyleSheet.hairlineWidth },
  face: { flex: 1, padding: 14, justifyContent: 'space-between' },
  chip: { width: 30, height: 22, borderRadius: 5 },
  lines: { gap: 7 },
  line: { width: '70%', height: 7, borderRadius: 4 },
  lineShort: { width: '40%', height: 7, borderRadius: 4 },
});
