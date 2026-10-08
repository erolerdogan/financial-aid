import { ImportProgressOverlay } from '@/components/ImportProgressOverlay';
import { BackupRestoreModal } from '@/components/modals/BackupRestoreModal';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const db = useSQLiteContext();
  const { setIsDemoMode, refreshProfiles, activeProfile, profiles, switchProfile } = useProfile();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [restoreVisible, setRestoreVisible] = useState(false);

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

  const gradientColors = [colors.background, colors.tintBackground, colors.background] as const;

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.heroSlot}>
          <View style={[styles.iconGlowRing, { borderColor: colors.accent + '33' }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="wallet-outline" size={38} color={colors.accent} />
            </View>
          </View>
          
          <View style={styles.badgeRow}>
            <Ionicons name="shield-checkmark" size={13} color="#34C759" />
            <SelectableText style={styles.badgeText}>{t('welcome.badge')}</SelectableText>
          </View>
        </View>

        <View style={styles.header}>
          <SelectableText style={[styles.title, { color: colors.text }]}>
            {t('welcome.title')}
          </SelectableText>
          <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('welcome.subtitle')}
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
                {importing ? t('welcome.processing') : t('welcome.import')}
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
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{t('welcome.demo')}</Text>
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
  heroSlot: { alignItems: 'center', marginTop: 36 },
  iconGlowRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#34C759', letterSpacing: 0.8 },
  header: { alignItems: 'center', paddingHorizontal: 12 },
  title: { fontSize: 38, fontWeight: '800', textAlign: 'center', letterSpacing: -1, lineHeight: 44, marginBottom: 14 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 8 },
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