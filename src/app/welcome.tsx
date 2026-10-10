import { ImportProgressOverlay } from '@/components/ImportProgressOverlay';
import { BackupRestoreModal } from '@/components/modals/BackupRestoreModal';
import { AccountStep } from '@/components/profile/AccountStep';
import { OfferStep } from '@/components/profile/OfferStep';
import { FirstStatementStep } from '@/components/profile/FirstStatementStep';
import { ProfileSetup } from '@/components/profile/ProfileSetup';
import { SelectableText } from '@/components/SelectableText';
import { WelcomeIntro } from '@/components/welcome/WelcomeIntro';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { CURRENCY_CODES } from '@/constants/currencies';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getAppMeta, getHousehold, saveHousehold, setAppMeta } from '@/db/database';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import { PRO_OFFER_SHOWN_KEY } from '@/utils/entitlement';
import { AVATAR_COLORS, buildHousehold, defaultCurrency, isProfileNameTaken, setupSteps, type SetupAnswers } from '@/utils/profileSetup';
import { WELCOME_INTRO_SEEN_KEY } from '@/utils/welcomeIntro';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const APP_ICON = require('../../assets/images/icon.png');
const QUESTION_COUNT = setupSteps(true).length;

export default function WelcomeScreen() {
  const db = useSQLiteContext();
  const {
    setIsDemoMode,
    refreshProfiles,
    activeProfile,
    profiles,
    switchProfile,
    editProfile,
    updateCurrency,
    loadingProfiles,
    dataVersion,
    isDemoMode,
  } = useProfile();
  const deviceLocales = useLocales();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user, available: accountAvailable } = useAuth();
  const { source } = useEntitlement();
  const [restoreVisible, setRestoreVisible] = useState(false);
  const [stage, setStage] = useState<'welcome' | 'questions' | 'offer' | 'account' | 'import'>('welcome');
  // The account step follows the questions once: decided when they open, so the dots do not change
  // when the user signs in on that step. Never for a user who is signed in or a build without accounts.
  const [accountStep, setAccountStep] = useState(false);
  // The Pro offer follows the questions, before the account step, for a user who has no Pro; decided
  // together with the account step for the same reason.
  const [offerStep, setOfferStep] = useState(false);
  // The questions, the offer and account steps when they are offered, and the import step.
  const setupStepCount = QUESTION_COUNT + (offerStep ? 1 : 0) + (accountStep ? 1 : 0) + 1;
  // Whether the profile questions were answered (a household row exists): "Get started" then opens the import step.
  const [setupDone, setSetupDone] = useState(false);
  // The questions stay mounted behind the import step, so going back finds the answers as they were typed.
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const setupProfileId = (activeProfile ?? profiles[0])?.id;
  // Coming back from the demo: continue on the import step when the questions are already answered.
  const { resume } = useLocalSearchParams<{ resume?: string }>();
  const resumePendingRef = useRef(resume === '1');

  useEffect(() => {
    // Leaving the demo lands here while the tables are dropped and rebuilt: wait until the profiles are back.
    if (loadingProfiles || setupProfileId === undefined) return;
    let active = true;
    getHousehold(db, setupProfileId)
      .then((household) => {
        if (!active) return;
        setSetupDone(household !== null);
        if (resumePendingRef.current) {
          resumePendingRef.current = false;
          if (household !== null) setStage('import');
        }
      })
      .catch(() => {
        // Not readable means not answered: the questions are asked.
        if (active) setSetupDone(false);
      });
    return () => {
      active = false;
    };
  }, [db, setupProfileId, loadingProfiles, dataVersion]);
  // Null until read; false plays the intro before the screen.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [contentOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let active = true;
    getAppMeta(db, WELCOME_INTRO_SEEN_KEY)
      .then((value) => {
        if (active) setIntroSeen(value === '1');
      })
      .catch(() => {
        if (active) setIntroSeen(true);
      });
    return () => {
      active = false;
    };
  }, [db]);

  const { importStatement, importing } = useStatementImporter({
    onSuccess: async () => {
      await refreshProfiles();
      const targetProfile = activeProfile ?? profiles[0];
      if (targetProfile) {
        switchProfile(targetProfile);
      }
      router.replace('/(tabs)');
    },
  });

  // A profile without household answers gets the questions first; the saved row marks them as asked.
  const handleGetStarted = () => {
    if (importing) return;
    Haptics.selectionAsync().catch(() => {});
    const ask = !setupDone && setupProfileId !== undefined;
    setQuestionsOpen(ask);
    setAccountStep(ask && accountAvailable && !user);
    setOfferStep(ask && source === 'free' && !isDemoMode);
    setStage(ask ? 'questions' : 'import');
  };

  const handleCloseSetup = () => {
    setQuestionsOpen(false);
    setStage('welcome');
  };

  const handleSetupDone = async (answers: SetupAnswers) => {
    const profile = activeProfile ?? profiles[0];
    if (profile) {
      try {
        await editProfile(profile.id, answers.name, answers.color);
        // Nothing is stored yet, so there are no amounts to convert.
        await updateCurrency(answers.currency, null);
        await saveHousehold(db, profile.id, buildHousehold(answers));
      } catch (error) {
        console.error('Failed to save the profile setup:', error);
      }
    }
    // On to the next step; the picker of the last one opens only when its button is tapped.
    setSetupDone(true);
    if (offerStep) {
      // Shown here, so the paywall that follows the first import does not repeat it.
      setAppMeta(db, PRO_OFFER_SHOWN_KEY, '1').catch((error) => console.error('Failed to save the offer flag:', error));
      setStage('offer');
    } else {
      setStage(accountStep && !user ? 'account' : 'import');
    }
  };

  const handleDemoMode = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (db) {
      await setIsDemoMode(true);
      router.replace('/(tabs)');
    }
  };

  const handleOpenRestore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestoreVisible(true);
  };

  // The root layout routes only once, so leave Welcome here.
  const handleRestored = () => {
    setRestoreVisible(false);
    router.replace('/(tabs)');
  };

  const handleIntroDone = () => {
    setIntroSeen(true);
    setAppMeta(db, WELCOME_INTRO_SEEN_KEY, '1').catch((error) => console.error('Failed to save the intro flag:', error));
    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleReplayIntro = () => {
    Haptics.selectionAsync().catch(() => {});
    setIntroSeen(false);
  };

  const gradientColors = [colors.background, colors.tintBackground, colors.background] as const;

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      {introSeen === false && <WelcomeIntro onDone={handleIntroDone} />}
      {introSeen === true && stage === 'import' && (
        <SafeAreaView style={styles.setup}>
          <FirstStatementStep
            current={setupStepCount}
            total={setupStepCount}
            importing={importing}
            onImport={importStatement}
            onHelp={() => router.push('/export-guide')}
            onDemo={handleDemoMode}
            onRestore={handleOpenRestore}
            onClose={handleCloseSetup}
            onBack={
              questionsOpen
                ? () => setStage(accountStep && !user ? 'account' : offerStep ? 'offer' : 'questions')
                : undefined
            }
          />
        </SafeAreaView>
      )}
      {introSeen === true && stage === 'account' && (
        <SafeAreaView style={styles.setup}>
          <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <AccountStep
              current={setupStepCount - 1}
              total={setupStepCount}
              onDone={() => setStage('import')}
              onBack={() => setStage(offerStep ? 'offer' : 'questions')}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
      {introSeen === true && stage === 'offer' && (
        <SafeAreaView style={styles.setup}>
          <OfferStep
            current={QUESTION_COUNT + 1}
            total={setupStepCount}
            onDone={() => setStage(accountStep && !user ? 'account' : 'import')}
            onBack={() => setStage('questions')}
          />
        </SafeAreaView>
      )}
      {introSeen === true && (stage === 'questions' || (stage !== 'welcome' && questionsOpen)) && (
        <SafeAreaView style={[styles.setup, stage !== 'questions' && styles.hidden]}>
          <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ProfileSetup
              fill
              appSteps
              isNameTaken={(name) => isProfileNameTaken(name, profiles, (activeProfile ?? profiles[0])?.id)}
              initialName={(activeProfile ?? profiles[0])?.name || t('profile.defaultName')}
              initialColor={(activeProfile ?? profiles[0])?.avatarColor || AVATAR_COLORS[0]}
              initialCurrency={defaultCurrency(deviceLocales[0]?.currencyCode, CURRENCY_CODES)}
              submitLabel={t('common.continue')}
              extraSteps={setupStepCount - QUESTION_COUNT}
              paused={stage !== 'questions'}
              onSubmit={handleSetupDone}
              onCancel={handleCloseSetup}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
      {introSeen === true && stage === 'welcome' && (
        <Animated.View style={[styles.container, { opacity: contentOpacity }]}>
          <SafeAreaView style={styles.safeArea}>
            <View>
              <TouchableOpacity
                style={styles.replay}
                onPress={handleReplayIntro}
                activeOpacity={0.7}
                disabled={importing}
                accessibilityRole="button"
              >
                <Ionicons name="play-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.replayText, { color: colors.textSecondary }]}>{t('welcome.intro.replay')}</Text>
              </TouchableOpacity>

              <View style={styles.heroSlot}>
                <View style={styles.appIconShadow}>
                  <Image source={APP_ICON} style={styles.appIcon} accessible={false} />
                </View>
              </View>
            </View>

            <View style={styles.header}>
              <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                {t('welcome.tagline')}
              </SelectableText>
            </View>

            <View style={styles.actionContainer}>
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: colors.accent, shadowColor: colors.accent }]} 
                onPress={handleGetStarted}
                activeOpacity={0.85}
                disabled={importing}
                accessibilityRole="button"
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={styles.buttonIcon} />
                ) : (
                  <Ionicons name="document-text-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                )}
                <View style={styles.buttonTextWrapper}>
                  <Text style={styles.primaryButtonText}>
                    {importing ? t('welcome.processing') : t('welcome.getStarted')}
                  </Text>
                </View>
                {!importing && <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.secondaryButton, 
                  { 
                    backgroundColor: colors.card,
                    borderColor: colors.border 
                  }
                ]} 
                onPress={handleDemoMode} 
                activeOpacity={0.85}
                disabled={importing}
                accessibilityRole="button"
              >
                <Ionicons name="sparkles-outline" size={20} color={colors.accent} style={styles.buttonIcon} />
                <View style={styles.buttonTextWrapper}>
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{t('welcome.tryDemo')}</Text>
                  <Text style={[styles.buttonSubtextSecondary, { color: colors.textSecondary }]}>
                    {t('welcome.demoSub')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <View style={styles.linkRow}>
                <TouchableOpacity
                  style={styles.link}
                  onPress={() => router.push('/export-guide')}
                  activeOpacity={0.7}
                  disabled={importing}
                  accessibilityRole="link"
                  accessibilityLabel={t('guide.link')}
                >
                  <Ionicons name="help-circle-outline" size={16} color={colors.accent} />
                  <Text style={[styles.linkText, { color: colors.accent }]} numberOfLines={2}>
                    {t('welcome.helpLink')}
                  </Text>
                </TouchableOpacity>

                <View style={[styles.linkDivider, { backgroundColor: colors.border }]} />

                <TouchableOpacity
                  style={styles.link}
                  onPress={handleOpenRestore}
                  activeOpacity={0.7}
                  disabled={importing}
                  accessibilityRole="button"
                  accessibilityLabel={t('backup.restoreFrom')}
                >
                  <Ionicons name="cloud-download-outline" size={16} color={colors.accent} />
                  <Text style={[styles.linkText, { color: colors.accent }]} numberOfLines={2}>
                    {t('welcome.restoreLink')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.legal}>
                <SelectableText style={[styles.legalText, { color: colors.textSecondary }]}>{t('welcome.legal')}</SelectableText>
                <View style={styles.legalLinks}>
                  <TouchableOpacity
                    style={styles.legalLink}
                    onPress={() => router.push({ pathname: '/legal', params: { page: 'terms' } })}
                    activeOpacity={0.7}
                    accessibilityRole="link"
                  >
                    <Text style={[styles.legalLinkText, { color: colors.accent }]}>{t('settings.terms')}</Text>
                  </TouchableOpacity>
                  <View style={[styles.linkDivider, { backgroundColor: colors.border }]} />
                  <TouchableOpacity
                    style={styles.legalLink}
                    onPress={() => router.push({ pathname: '/legal', params: { page: 'privacy' } })}
                    activeOpacity={0.7}
                    accessibilityRole="link"
                  >
                    <Text style={[styles.legalLinkText, { color: colors.accent }]}>{t('settings.privacyPolicy')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}
      <ImportProgressOverlay />
      <BackupRestoreModal
        restoreOnly
        visible={restoreVisible}
        onClose={() => setRestoreVisible(false)}
        onRestored={handleRestored}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  setup: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  hidden: { display: 'none' },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  replay: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  replayText: { fontSize: 13, fontWeight: '600' },
  heroSlot: { alignItems: 'center', marginTop: 12 },
  appIconShadow: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  appIcon: { width: 104, height: 104, borderRadius: 24, borderCurve: 'continuous' },
  header: { alignItems: 'center', paddingHorizontal: 12 },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.8, lineHeight: 36 },
  actionContainer: { width: '100%', gap: 14 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonIcon: { marginRight: 16 },
  buttonTextWrapper: { flex: 1 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  secondaryButtonText: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  buttonSubtextSecondary: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  linkRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  link: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  linkText: { flexShrink: 1, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  linkDivider: { width: StyleSheet.hairlineWidth, height: 18 },
  legal: { alignItems: 'center' },
  legalText: { fontSize: 12, lineHeight: 16, textAlign: 'center', paddingHorizontal: 8 },
  legalLinks: { flexDirection: 'row', alignItems: 'center' },
  legalLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  legalLinkText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});