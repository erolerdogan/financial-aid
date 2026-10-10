import { SignInSheet } from '@/components/account/SignInSheet';
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { HeaderActions } from '@/components/HeaderActions';
import { HouseholdSheet } from '@/components/health/HouseholdSheet';
import { BackupRestoreModal } from '@/components/modals/BackupRestoreModal';
import { PasscodeModal, type PasscodeModalMode } from '@/components/modals/PasscodeModal';
import { ProfileSwitcherModal } from '@/components/ProfileSwitcherModal';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ThemeSwatches } from '@/components/ThemeSwatches';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WelcomeIntro } from '@/components/welcome/WelcomeIntro';
import { LanguageSheet } from '@/components/you/LanguageSheet';
import { SettingsRow, SettingsSection } from '@/components/you/SettingsRow';
import type { Household } from '@/constants/benchmarks';
import { PRO_TESTING_ENABLED, SUPPORT_EMAIL } from '@/constants/buildConfig';
import { currencyInfo, DEFAULT_CURRENCY } from '@/constants/currencies';
import { faqTranslate } from '@/content/faq';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { usePasscode } from '@/contexts/PasscodeContext';
import { useProfile } from '@/contexts/ProfileContext';
import { TabSwipeBlocker } from '@/contexts/TabSwipeContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getHousehold, saveHousehold } from '@/db/database';
import { useEraseAllData } from '@/hooks/useEraseAllData';
import { usePaywall } from '@/hooks/usePaywall';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import { LANGUAGES } from '@/i18n';
import { getRates, RATE_PROVIDER } from '@/services/exchangeRates';
import { restore } from '@/services/purchases';
import { conversionFactor } from '@/utils/exchangeRates';
import { cancelCurrentMonthReminders, requestAndScheduleImportReminders } from '@/utils/notifications';
import { getStoreLinks } from '@/utils/storeLinks';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

/**
 * The You tab: account and subscription, profiles, import, data, preferences and help.
 * It took the place of the Settings screen; `/settings` redirects here.
 */
export default function YouScreen() {
  const { activeProfile, updateCurrency, isDemoMode, dataVersion, refreshProfiles } = useProfile();
  const { isDark, toggleTheme, colors } = useTheme();
  const { enabled: passcodeEnabled } = usePasscode();
  const { t, format, language, storedLanguage } = useI18n();
  const router = useRouter();
  const db = useSQLiteContext();
  const { source, setDevOverride, refresh: refreshEntitlement } = useEntitlement();
  const { user, available: accountAvailable } = useAuth();
  const { openPaywall } = usePaywall();
  const { guardWrite } = useProfileAccess();
  const { requireAccount, sheet: signInSheet } = useRequireAccount();
  const eraseAllData = useEraseAllData();
  const { importStatement, importing } = useStatementImporter();
  const profileId = activeProfile?.id ?? 1;

  const [loading, setLoading] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdVisible, setHouseholdVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [passcodeModalVisible, setPasscodeModalVisible] = useState(false);
  const [passcodeModalMode, setPasscodeModalMode] = useState<PasscodeModalMode>('set');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [introVisible, setIntroVisible] = useState(false);

  const appVersion = Constants.expoConfig?.version;
  const storeLinks = getStoreLinks(Platform.OS);
  const busy = importing || loading;

  useEffect(() => {
    let cancelled = false;
    getHousehold(db, profileId)
      .then((row) => {
        if (!cancelled) setHousehold(row);
      })
      .catch((error) => console.warn('Failed to load the household:', error));
    return () => {
      cancelled = true;
    };
  }, [db, profileId, dataVersion]);

  const openLink = (url: string) => {
    Linking.openURL(url).catch((error) => console.warn('Could not open link:', error));
  };

  const activeCurrencyCode = activeProfile?.currency || DEFAULT_CURRENCY;
  const activeCurrencySymbol = currencyInfo(activeCurrencyCode).symbol.trim();
  const activeLanguageLabel = LANGUAGES.find((item) => item.code === language)?.label ?? '';
  const profileName = activeProfile?.name || t('profile.defaultName');

  const householdSummary = household
    ? `${t('health.household.adults')} ${household.adults} · ${t('health.household.children')} ${household.children} · ${t(
        household.housingType === 'own' ? 'health.household.own' : 'health.household.rent'
      )}`
    : t('health.options.householdUnset');

  const openPasscodeModal = (mode: PasscodeModalMode) => {
    setPasscodeModalMode(mode);
    setPasscodeModalVisible(true);
  };

  const handleSaveHousehold = async (next: Household) => {
    try {
      await saveHousehold(db, profileId, next);
      setHouseholdVisible(false);
      // Budget Health reads the household; this reloads it.
      await refreshProfiles();
    } catch (error) {
      console.error('Failed to save household:', error);
      Alert.alert(t('common.error'));
    }
  };

  const handleRestorePurchases = async () => {
    try {
      const result = await restore();
      if (result === 'success') {
        refreshEntitlement();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(t('paywall.successTitle'), t('paywall.successMessage'));
      } else if (result === 'nothingToRestore') {
        Alert.alert(t('paywall.nothingToRestoreTitle'), t('paywall.nothingToRestoreMessage'));
      } else {
        Alert.alert(t('paywall.comingSoonTitle'), t('paywall.comingSoonMessage'));
      }
    } catch (error) {
      console.error('Restore failed:', error);
    }
  };

  const handleSelectCurrency = async (newCurrencyCode: string) => {
    if (newCurrencyCode === activeCurrencyCode) {
      setCurrencyModalVisible(false);
      return;
    }

    // Converting needs today's rate; without one the currency stays as it is.
    setRateLoading(true);
    const table = await getRates(db).catch(() => null);
    setRateLoading(false);
    const factor = table ? conversionFactor(table, activeCurrencyCode, newCurrencyCode) : null;

    if (!table || factor === null) {
      Alert.alert(t('settings.ratesUnavailableTitle'), t('settings.ratesUnavailableMessage'));
      return;
    }

    const message = t('settings.switchCurrencyMessage', {
      from: activeCurrencyCode,
      symbol: activeCurrencySymbol,
      to: newCurrencyCode,
    });
    const rate = t('settings.switchCurrencyRate', {
      from: activeCurrencyCode,
      to: newCurrencyCode,
      rate: format.number(factor, { maximumFractionDigits: factor < 1 ? 6 : 4 }),
      date: format.date(new Date(table.updatedAt), { day: 'numeric', month: 'short', year: 'numeric' }),
    });
    Alert.alert(t('settings.switchCurrencyTitle'), `${message}\n\n${rate}`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.switchCurrencyConfirm'),
        onPress: async () => {
          try {
            await updateCurrency(newCurrencyCode, factor);
            setCurrencyModalVisible(false);
          } catch (error) {
            console.error('Error updating currency:', error);
            Alert.alert(t('common.error'), t('settings.convertFailedMessage'));
          }
        },
      },
    ]);
  };

  const handleResetDatabase = () => {
    Alert.alert(t('settings.resetTitle'), t('settings.resetMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.resetConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await eraseAllData();
          } catch (error) {
            console.error('Reset error:', error);
            Alert.alert(t('common.error'), t('settings.resetFailed'));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (value) {
      await requestAndScheduleImportReminders();
      Alert.alert(t('settings.notificationsOnTitle'), t('settings.notificationsOnMessage'));
    } else {
      await cancelCurrentMonthReminders();
      Alert.alert(t('settings.notificationsOffTitle'), t('settings.notificationsOffMessage'));
    }
  };

  // Nothing from the database goes into the mail: only the version and the platform.
  const handleSupport = () => {
    const subject = t('you.supportSubject', { version: appVersion ?? '', platform: Platform.OS === 'ios' ? 'iOS' : 'Android' });
    openLink(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
  };

  const switchColors = {
    trackColor: { false: colors.track, true: colors.accent },
    thumbColor: '#FFFFFF',
    ios_backgroundColor: colors.track,
  };

  return (
    <ScreenContainer>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <HeaderActions title={t('tabs.you')} />

        <SettingsSection title={t('you.profilesHousehold')}>
          <SettingsRow
            icon="person-outline"
            leading={
              <View style={[styles.avatar, { backgroundColor: activeProfile?.avatarColor || colors.accent }]}>
                <Text style={styles.avatarText} allowFontScaling={false}>
                  {profileName.substring(0, 1).toUpperCase()}
                </Text>
              </View>
            }
            title={profileName}
            sub={t('settings.activeProfile')}
            value={t('you.manage')}
            onPress={() => setProfileModalVisible(true)}
            disabled={isDemoMode}
          />
          <SettingsRow
            icon="people-outline"
            title={t('health.options.household')}
            sub={householdSummary}
            onPress={() => guardWrite(() => setHouseholdVisible(true))}
          />
          <SettingsRow
            icon="cash-outline"
            title={t('settings.currency')}
            sub={`${activeCurrencyCode} (${activeCurrencySymbol})`}
            value={activeCurrencyCode}
            onPress={() => guardWrite(() => setCurrencyModalVisible(true))}
          />
        </SettingsSection>

        <SettingsSection title={t('you.accountSubscription')}>
          <SettingsRow
            icon="sparkles-outline"
            title={t('settings.planLabel')}
            value={t(source === 'dev' ? 'settings.planDev' : source === 'pro' ? 'settings.planPro' : 'settings.planFree')}
          />
          <SettingsRow icon="star-outline" title={t('pro.seePro')} onPress={() => openPaywall()} />
          <SettingsRow icon="refresh-outline" title={t('paywall.restore')} onPress={() => requireAccount(handleRestorePurchases)} />
          {/* Optional, and absent from a build without the account service. Sign out is on the Account screen. */}
          {accountAvailable && (
            <SettingsRow
              icon="person-circle-outline"
              title={user ? t('account.title') : t('account.signInRow')}
              sub={user ? user.email ?? t('account.noEmail') : t('account.signInRowSub')}
              onPress={() => router.push('/account')}
            />
          )}
          {PRO_TESTING_ENABLED && (
            <SettingsRow
              icon="construct-outline"
              title={t('settings.devPro')}
              right={<Switch value={source === 'dev'} onValueChange={setDevOverride} {...switchColors} />}
            />
          )}
        </SettingsSection>

        <SettingsSection title={t('settings.preferences')}>
          <SettingsRow
            icon="language-outline"
            title={t('settings.language')}
            sub={storedLanguage ? activeLanguageLabel : t('settings.languageSystem')}
            value={activeLanguageLabel}
            onPress={() => setLanguageModalVisible(true)}
          />
          {/* The swatches scroll sideways, so a drag that starts on them must not switch tab. */}
          <TabSwipeBlocker>
            <ThemeSwatches />
          </TabSwipeBlocker>
          <SettingsRow
            icon={isDark ? 'moon' : 'sunny'}
            title={t('settings.darkMode')}
            right={<Switch value={isDark} onValueChange={toggleTheme} accessibilityLabel={t('settings.darkMode')} {...switchColors} />}
          />
          <SettingsRow
            icon="notifications-outline"
            title={t('settings.importReminders')}
            sub={t('settings.importRemindersSub')}
            disabled={isDemoMode}
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                disabled={isDemoMode}
                accessibilityLabel={t('settings.importReminders')}
                {...switchColors}
              />
            }
          />
          <SettingsRow icon="pricetags-outline" title={t('settings.categories')} onPress={() => router.push('/categories')} />
          <SettingsRow icon="disc-outline" title={t('settings.budgets')} onPress={() => router.push('/goals')} />
        </SettingsSection>

        <SettingsSection title={t('you.security')}>
          <SettingsRow
            icon="keypad-outline"
            title={t('settings.passcode')}
            sub={t('settings.passcodeSub')}
            right={
              // Stays on its old value until the sheet has set or removed the passcode.
              <Switch
                value={passcodeEnabled}
                onValueChange={(value) => openPasscodeModal(value ? 'set' : 'remove')}
                accessibilityLabel={t('settings.passcode')}
                {...switchColors}
              />
            }
          />
          {passcodeEnabled && (
            <SettingsRow icon="key-outline" title={t('settings.changePasscode')} onPress={() => openPasscodeModal('change')} />
          )}
          <SettingsRow icon="hand-left-outline" title={t('settings.dataPrivacy')} onPress={() => router.push('/data-privacy')} />
        </SettingsSection>

        <SettingsSection title={t('settings.data')} note={isDemoMode ? t('settings.demoNote') : undefined}>
          <SettingsRow
            icon="document-text-outline"
            title={t('settings.import')}
            onPress={importStatement}
            disabled={busy || isDemoMode}
            busy={importing}
          />
          <SettingsRow icon="help-buoy-outline" title={t('guide.settingsRow')} onPress={() => router.push('/export-guide')} disabled={busy} />
          <SettingsRow
            icon="shield-checkmark-outline"
            title={t('settings.backup')}
            onPress={() => setBackupModalVisible(true)}
            disabled={busy || isDemoMode}
          />
          <SettingsRow
            icon="trash-outline"
            title={t('settings.reset')}
            onPress={handleResetDatabase}
            disabled={busy || isDemoMode}
            danger
          />
        </SettingsSection>

        <SettingsSection title={t('you.help')}>
          <SettingsRow icon="play-circle-outline" title={t('you.watchIntro')} onPress={() => setIntroVisible(true)} />
          <SettingsRow icon="help-circle-outline" title={faqTranslate(language, 'faq.title')} onPress={() => router.push('/faq')} />
          <SettingsRow icon="mail-outline" title={t('you.support')} sub={SUPPORT_EMAIL} onPress={handleSupport} external />
          <SettingsRow
            icon="document-outline"
            title={t('settings.terms')}
            onPress={() => router.push({ pathname: '/legal', params: { page: 'terms' } })}
          />
          {storeLinks && (
            <SettingsRow icon="star-outline" title={t('settings.rateApp')} onPress={() => openLink(storeLinks.rate)} external />
          )}
          {storeLinks && (
            <SettingsRow icon="create-outline" title={t('settings.writeReview')} onPress={() => openLink(storeLinks.review)} external />
          )}
          {appVersion ? <SettingsRow icon="information-circle-outline" title={t('settings.version')} value={appVersion} /> : null}
        </SettingsSection>

        {PRO_TESTING_ENABLED && (
          <Text style={[styles.testBuildLabel, { color: colors.textSecondary }]}>{t('settings.testBuild')}</Text>
        )}
      </ScrollView>

      <SignInSheet {...signInSheet} />

      {/* The full sheet: switch, add, rename and delete. The header avatar opens the short one. */}
      <ProfileSwitcherModal visible={profileModalVisible} onClose={() => setProfileModalVisible(false)} />

      <HouseholdSheet
        visible={householdVisible}
        household={household}
        detectedIncome={null}
        onSave={handleSaveHousehold}
        onClose={() => setHouseholdVisible(false)}
      />

      <PasscodeModal visible={passcodeModalVisible} mode={passcodeModalMode} onClose={() => setPasscodeModalVisible(false)} />

      <BackupRestoreModal visible={backupModalVisible} onClose={() => setBackupModalVisible(false)} />

      <CurrencyPickerSheet
        visible={currencyModalVisible}
        selected={activeCurrencyCode}
        busy={rateLoading}
        onSelect={handleSelectCurrency}
        onClose={() => setCurrencyModalVisible(false)}
        footer={
          <TouchableOpacity style={styles.ratesCredit} onPress={() => openLink(RATE_PROVIDER.url)} accessibilityRole="link">
            <Text style={[styles.ratesCreditText, { color: colors.textSecondary }]}>{t('settings.ratesCredit')}</Text>
          </TouchableOpacity>
        }
      />

      <LanguageSheet visible={languageModalVisible} onClose={() => setLanguageModalVisible(false)} />

      {/* The scenes shown before Welcome on first launch. Watching them again does not touch `welcome_intro_seen`. */}
      <Modal visible={introVisible} animationType="fade" onRequestClose={() => setIntroVisible(false)}>
        <SafeAreaProvider>
          <LinearGradient colors={[colors.background, colors.tintBackground, colors.background]} style={styles.intro}>
            {introVisible && <WelcomeIntro onDone={() => setIntroVisible(false)} />}
          </LinearGradient>
        </SafeAreaProvider>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 0, paddingBottom: 100 },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  testBuildLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center', marginTop: 16 },
  ratesCredit: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  ratesCreditText: { fontSize: 12, textDecorationLine: 'underline' },
  intro: { flex: 1 },
});
