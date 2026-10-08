import { useI18n } from '@/contexts/LanguageContext';
import { usePasscode } from '@/contexts/PasscodeContext';
import { useTheme } from '@/contexts/ThemeContext';
import { INTRO_SCENE_DURATIONS_MS, nextScene } from '@/utils/welcomeIntro';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BanksScene } from './scenes/BanksScene';
import { CalendarScene } from './scenes/CalendarScene';
import { DonutScene } from './scenes/DonutScene';
import { PrivacyScene } from './scenes/PrivacyScene';
import { QuestionsScene } from './scenes/QuestionsScene';
import { type IntroSceneProps } from './scenes/shared';
import { TimelineScene } from './scenes/TimelineScene';
import { TrackerScene } from './scenes/TrackerScene';

// One per entry of INTRO_SCENE_DURATIONS_MS; Welcome itself is the scene after the last.
const SCENES: readonly React.ComponentType<IntroSceneProps>[] = [
  QuestionsScene,
  TrackerScene,
  DonutScene,
  BanksScene,
  TimelineScene,
  CalendarScene,
  PrivacyScene,
];

interface Accessibility {
  reduceMotion: boolean;
  screenReader: boolean;
}

const isAway = (status: AppStateStatus): boolean => status === 'background' || status === 'inactive';

interface WelcomeIntroProps {
  /** The last scene ended or "Skip" was tapped. */
  onDone: () => void;
}

/**
 * The animated scenes before Welcome. Each stays for its duration, a tap moves on, "Skip" ends it.
 * It waits while the passcode lock or the app switcher covers the app, and with a screen reader
 * it moves on by tap only.
 */
export function WelcomeIntro({ onDone }: WelcomeIntroProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { locked, covered } = usePasscode();
  const [scene, setScene] = useState(0);
  // Null until read, so a scene never starts moving before reduced motion is known.
  const [accessibility, setAccessibility] = useState<Accessibility | null>(null);
  const [away, setAway] = useState(() => isAway(AppState.currentState));
  const [fade] = useState(() => new Animated.Value(1));
  const leaving = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
    ]).then(([reduceMotion, screenReader]) => {
      if (active) setAccessibility({ reduceMotion, screenReader });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => setAway(isAway(status)));
    return () => subscription.remove();
  }, []);

  useEffect(() => () => fade.stopAnimation(), [fade]);

  const covering = locked || covered || away;
  const autoAdvance = accessibility !== null && !covering && !accessibility.screenReader;

  const advance = () => {
    if (leaving.current) return;
    leaving.current = true;
    const next = nextScene(scene);
    Animated.timing(fade, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(
      ({ finished }) => {
        if (!finished) return;
        if (next === null) {
          onDone();
          return;
        }
        leaving.current = false;
        setScene(next);
        Animated.timing(fade, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      }
    );
  };

  // The scene is unmounted while the app is covered, so it plays from its start afterwards and gets its full time.
  useEffect(() => {
    if (!autoAdvance) return;
    const timer = setTimeout(advance, INTRO_SCENE_DURATIONS_MS[scene]);
    return () => clearTimeout(timer);
    // `advance` reads only the scene, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvance, scene]);

  const handleTap = () => {
    Haptics.selectionAsync().catch(() => {});
    advance();
  };

  const handleSkip = () => {
    Haptics.selectionAsync().catch(() => {});
    onDone();
  };

  const Scene = SCENES[scene];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.skip}
          onPress={handleSkip}
          activeOpacity={0.7}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>{t('welcome.intro.skip')}</Text>
        </TouchableOpacity>
      </View>

      <Pressable style={styles.stage} onPress={handleTap} accessibilityRole="button">
        <Animated.View style={[styles.stage, { opacity: fade }]}>
          {accessibility !== null && !covering && <Scene key={scene} reduceMotion={accessibility.reduceMotion} />}
        </Animated.View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12 },
  skip: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 16, fontWeight: '600' },
  stage: { flex: 1 },
});
