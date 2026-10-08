import { ImportProgressOverlay } from '@/components/ImportProgressOverlay';
import { BackupRestoreModal } from '@/components/modals/BackupRestoreModal';
import { SelectableText } from '@/components/SelectableText';
import { WelcomeIntro } from '@/components/welcome/WelcomeIntro';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getAppMeta, setAppMeta } from '@/db/database';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import { WELCOME_INTRO_SEEN_KEY } from '@/utils/welcomeIntro';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const APP_ICON = require('../../assets/images/icon.png');

export default function WelcomeScreen() {
  const db = useSQLiteContext();
  const { setIsDemoMode, refreshProfiles, activeProfile, profiles, switchProfile } = useProfile();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [restoreVisible, setRestoreVisible] = useState(false);
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
      {introSeen === true && (
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
                onPress={importStatement} 
                activeOpacity={0.85}
                disabled={importing}
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
                  <Text style={styles.buttonSubtext}>{t('welcome.importSub')}</Text>
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
  buttonSubtext: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2, fontWeight: '500' },
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