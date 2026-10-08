import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { BANK_CARD_HEIGHT, BANK_CARD_RADIUS, BANK_CARD_WIDTH } from './BanksScene';
import { SceneCaption, SceneLayout, tween, useSceneValues, type IntroSceneProps } from './shared';

const WIDTH = 290;
const HEIGHT = 130;
const LINE_Y = 63;
const LINE_HEIGHT = 4;
const MARK = 16;

// Example values, shown with an "Example" note.
const DEBT_FREE_MONTH = '2028-03';
const FREE_YEAR = new Date(2049, 0, 1);

const pop = Easing.out(Easing.back(1.8));

const build = ([unfold, first, second, caption]: Animated.Value[]): Animated.CompositeAnimation =>
  Animated.parallel([
    tween(caption, 400, 200),
    Animated.sequence([
      tween(unfold, 550, 150, Easing.inOut(Easing.cubic)),
      tween(first, 320, 0, pop),
      tween(second, 320, 120, pop),
    ]),
  ]);

/** Scene 5: the merged card unfolds into a timeline with two milestones. */
export function TimelineScene({ reduceMotion }: IntroSceneProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const [unfold, first, second, caption] = useSceneValues(4, reduceMotion, build);

  const markStyle = { backgroundColor: colors.card, borderColor: colors.accent };

  return (
    <SceneLayout caption={<SceneCaption text={t('welcome.intro.wholePlan')} value={caption} />}>
      <View style={styles.canvas}>
        <Animated.View
          style={[
            styles.line,
            { opacity: unfold.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }) },
          ]}
        >
          <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.lineFill} />
        </Animated.View>

        {/* Same place and size as the card the banks scene ends on. */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: unfold.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [
                { scaleX: unfold.interpolate({ inputRange: [0, 1], outputRange: [1, WIDTH / BANK_CARD_WIDTH] }) },
                { scaleY: unfold.interpolate({ inputRange: [0, 1], outputRange: [1, LINE_HEIGHT / BANK_CARD_HEIGHT] }) },
              ],
            },
          ]}
        >
          <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardFill} />
        </Animated.View>

        <Animated.Text style={[styles.label, styles.firstLabel, { color: colors.text, opacity: first }]}>
          {t('welcome.intro.debtFree', { date: format.monthYear(DEBT_FREE_MONTH, 'short') })}
        </Animated.Text>
        <Animated.View style={[styles.mark, styles.firstMark, markStyle, { opacity: first, transform: [{ scale: first }] }]} />

        <Animated.View style={[styles.mark, styles.secondMark, markStyle, { opacity: second, transform: [{ scale: second }] }]} />
        <Animated.Text style={[styles.label, styles.secondLabel, { color: colors.text, opacity: second }]}>
          {t('welcome.intro.financiallyFree', { date: format.date(FREE_YEAR, { year: 'numeric' }) })}
        </Animated.Text>
        <Animated.Text style={[styles.example, { color: colors.textSecondary, opacity: second }]}>
          {t('welcome.intro.example')}
        </Animated.Text>
      </View>
    </SceneLayout>
  );
}

const styles = StyleSheet.create({
  canvas: { width: WIDTH, height: HEIGHT },
  line: { position: 'absolute', left: 0, right: 0, top: LINE_Y, height: LINE_HEIGHT },
  lineFill: { flex: 1, borderRadius: LINE_HEIGHT / 2 },
  card: {
    position: 'absolute',
    left: (WIDTH - BANK_CARD_WIDTH) / 2,
    top: (HEIGHT - BANK_CARD_HEIGHT) / 2,
    width: BANK_CARD_WIDTH,
    height: BANK_CARD_HEIGHT,
  },
  cardFill: { flex: 1, borderRadius: BANK_CARD_RADIUS },
  mark: {
    position: 'absolute',
    top: LINE_Y + LINE_HEIGHT / 2 - MARK / 2,
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 4,
  },
  firstMark: { left: WIDTH * 0.3 - MARK / 2 },
  secondMark: { left: WIDTH * 0.86 - MARK / 2 },
  label: { position: 'absolute', fontSize: 14, fontWeight: '700' },
  firstLabel: { left: 0, right: WIDTH * 0.2, top: 26, textAlign: 'center' },
  secondLabel: { left: WIDTH * 0.2, right: 0, top: 86, textAlign: 'right' },
  // Outside the canvas, so the card stays where the banks scene left it.
  example: { position: 'absolute', left: 0, right: 0, top: HEIGHT + 8, fontSize: 12, fontWeight: '500', textAlign: 'center' },
});
