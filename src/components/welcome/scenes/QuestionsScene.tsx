import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { PACE, tween, useSceneValues, type IntroSceneProps } from './shared';

const QUESTIONS: readonly TranslationKey[] = [
  'welcome.intro.question1',
  'welcome.intro.question2',
  'welcome.intro.question3',
];

/** How much larger the newest question is drawn. A scale, not a font size, so it runs on the native driver. */
const HIGHLIGHT = 1.22;
/** Opacity of a question once the next one has taken over. */
const DIMMED = 0.5;
/** Time a question has to itself before the next one arrives. */
const PAUSE_MS = 900 * PACE;

const settle = Easing.inOut(Easing.cubic);

// Values: one "arrive" per question, then one "step back" for each question that is followed by another.
const build = (values: Animated.Value[]): Animated.CompositeAnimation => {
  const arrive = values.slice(0, QUESTIONS.length);
  const stepBack = values.slice(QUESTIONS.length);
  return Animated.sequence(
    arrive.flatMap((value, index) =>
      index === 0
        ? [tween(value, 500)]
        : [Animated.delay(PAUSE_MS), Animated.parallel([tween(stepBack[index - 1], 500, 0, settle), tween(value, 500)])]
    )
  );
};

/** Scene 1: the three questions the app answers, one after the other; the newest is large and in the theme's accent colour. */
export function QuestionsScene({ reduceMotion }: IntroSceneProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const values = useSceneValues(QUESTIONS.length * 2 - 1, reduceMotion, build);
  const spoken = QUESTIONS.map((key) => t(key)).join(' ');

  // Does nothing without a screen reader.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(spoken);
  }, [spoken]);

  return (
    <View style={styles.scene}>
      {QUESTIONS.map((key, index) => {
        const arrive = values[index];
        // The last question has nothing after it and stays highlighted.
        const stepBack: Animated.Value | undefined = values[QUESTIONS.length + index];
        const arriveScale = arrive.interpolate({ inputRange: [0, 1], outputRange: [0.9, HIGHLIGHT] });

        return (
          <Animated.View
            key={key}
            style={{
              opacity: arrive,
              transform: [
                { translateY: arrive.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                { scale: arriveScale },
                ...(stepBack
                  ? [{ scale: stepBack.interpolate({ inputRange: [0, 1], outputRange: [1, 1 / HIGHLIGHT] }) }]
                  : []),
              ],
            }}
          >
            {/* Two layers cross-fade, because a colour cannot be animated on the native driver. */}
            <Animated.Text
              style={[
                styles.question,
                {
                  color: colors.text,
                  opacity: stepBack ? stepBack.interpolate({ inputRange: [0, 1], outputRange: [0, DIMMED] }) : 0,
                },
              ]}
            >
              {t(key)}
            </Animated.Text>
            <Animated.Text
              style={[
                styles.question,
                styles.highlight,
                {
                  color: colors.accent,
                  opacity: stepBack ? stepBack.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 1,
                },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {t(key)}
            </Animated.Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Wide padding: the highlighted question is drawn larger than its layout box.
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44, gap: 34 },
  highlight: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  question: { fontSize: 23, fontWeight: '700', textAlign: 'center', letterSpacing: -0.4, lineHeight: 29 },
});
