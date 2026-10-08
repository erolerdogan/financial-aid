import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SceneCaption, SceneLayout, tween, useSceneValues, type IntroSceneProps } from './shared';

// Any month end and the first day after it.
const LAST_DAY = new Date(2026, 11, 31);
const FIRST_DAY = new Date(2027, 0, 1);

const build = ([flip, glow, caption]: Animated.Value[]): Animated.CompositeAnimation =>
  Animated.parallel([
    tween(caption, 400, 200),
    Animated.sequence([tween(flip, 600, 250, Easing.inOut(Easing.cubic)), tween(glow, 800, 0, Easing.linear)]),
  ]);

interface PageProps {
  date: Date;
}

function Page({ date }: PageProps) {
  const { colors } = useTheme();
  const { format } = useI18n();

  return (
    <View style={[styles.page, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.pageHead, { backgroundColor: colors.accent }]}>
        <Text style={styles.month}>{format.date(date, { month: 'short' })}</Text>
      </View>
      <View style={styles.pageBody}>
        <Text style={[styles.day, { color: colors.text }]}>{format.date(date, { day: 'numeric' })}</Text>
      </View>
    </View>
  );
}

/** Scene 6: the calendar turns to day 1 and the monthly summary glows once. */
export function CalendarScene({ reduceMotion }: IntroSceneProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [flip, glow, caption] = useSceneValues(3, reduceMotion, build);
  const ink = `${colors.onGradient}55`;

  return (
    <SceneLayout caption={<SceneCaption text={t('welcome.intro.calmLook')} value={caption} />}>
      <View style={styles.calendar}>
        <Page date={FIRST_DAY} />
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.turning,
            {
              opacity: flip.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
              transform: [
                { perspective: 700 },
                { rotateX: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-95deg'] }) },
              ],
            },
          ]}
        >
          <Page date={LAST_DAY} />
        </Animated.View>
      </View>

      <View style={styles.summarySlot}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.halo,
            {
              backgroundColor: colors.accent,
              opacity: glow.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.45, 0] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }],
            },
          ]}
        />
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summary}>
          <View style={[styles.summaryDot, { backgroundColor: ink }]} />
          <View style={styles.summaryLines}>
            <View style={[styles.summaryLine, { backgroundColor: colors.onGradient }]} />
            <View style={[styles.summaryLineShort, { backgroundColor: ink }]} />
          </View>
        </LinearGradient>
      </View>
    </SceneLayout>
  );
}

const styles = StyleSheet.create({
  calendar: { width: 104, height: 112 },
  turning: { transformOrigin: 'top' },
  page: { flex: 1, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  pageHead: { height: 30, alignItems: 'center', justifyContent: 'center' },
  month: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  pageBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  day: { fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  summarySlot: { width: 200, height: 64, marginTop: 30 },
  halo: { borderRadius: 18 },
  summary: { flex: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  summaryDot: { width: 32, height: 32, borderRadius: 16 },
  summaryLines: { flex: 1, gap: 8 },
  summaryLine: { width: '75%', height: 8, borderRadius: 4 },
  summaryLineShort: { width: '45%', height: 7, borderRadius: 4 },
});
