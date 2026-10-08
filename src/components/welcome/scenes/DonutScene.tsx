import { useI18n } from '@/contexts/LanguageContext';
import { donutSegmentDashes, INTRO_DONUT_SEGMENTS, introDots } from '@/utils/welcomeIntro';
import React from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SceneCaption, SceneLayout, tween, useSceneValues, type IntroSceneProps } from './shared';

const SIZE = 200;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DOT = 14;

const DOTS = introDots(SIZE, RADIUS);
const DASHES = donutSegmentDashes(
  INTRO_DONUT_SEGMENTS.map((segment) => segment.fraction),
  CIRCUMFERENCE,
  3
);

const build = ([gather, settle, caption]: Animated.Value[]): Animated.CompositeAnimation =>
  Animated.parallel([
    tween(caption, 400, 200),
    Animated.sequence([tween(gather, 900, 100, Easing.inOut(Easing.cubic)), tween(settle, 450)]),
  ]);

/** Scene 3: scattered dots drift onto a ring and settle into a donut in the category colours. */
export function DonutScene({ reduceMotion }: IntroSceneProps) {
  const { t } = useI18n();
  const [gather, settle, caption] = useSceneValues(3, reduceMotion, build);

  return (
    <SceneLayout caption={<SceneCaption text={t('welcome.intro.makesSense')} value={caption} />}>
      <View style={styles.canvas}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: settle.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
          ]}
        >
          {DOTS.map((dot, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  left: dot.startX - DOT / 2,
                  top: dot.startY - DOT / 2,
                  backgroundColor: dot.color,
                  transform: [
                    { translateX: gather.interpolate({ inputRange: [0, 1], outputRange: [0, dot.endX - dot.startX] }) },
                    { translateY: gather.interpolate({ inputRange: [0, 1], outputRange: [0, dot.endY - dot.startY] }) },
                  ],
                },
              ]}
            />
          ))}
        </Animated.View>

        <Animated.View
          style={{
            opacity: settle,
            transform: [{ scale: settle.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          }}
        >
          <Svg width={SIZE} height={SIZE}>
            {INTRO_DONUT_SEGMENTS.map((segment, index) => (
              <Circle
                key={segment.category}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={segment.color}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${DASHES[index].dash} ${CIRCUMFERENCE}`}
                strokeDashoffset={DASHES[index].offset}
                // Start at 12 o'clock.
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            ))}
          </Svg>
        </Animated.View>
      </View>
    </SceneLayout>
  );
}

const styles = StyleSheet.create({
  canvas: { width: SIZE, height: SIZE },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2 },
});
