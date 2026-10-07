import { BackupRestoreModal } from '@/components/modals/BackupRestoreModal';
import { ProfileSwitcherModal } from '@/components/ProfileSwitcherModal';
import { ImportSummaryHost } from '@/contexts/ImportResultContext';
import { useI18n } from '@/contexts/LanguageContext';
import { CURRENCY_SYMBOLS, useProfile } from '@/contexts/ProfileContext';
import { THEMES, useTheme } from '@/contexts/ThemeContext';
import { clearAllData } from '@/db/database';
import { LANGUAGES, LanguageCode } from '@/i18n';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import {
  cancelCurrentMonthReminders,
  requestAndScheduleImportReminders
} from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AVAILABLE_CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'] as const;

export default function SettingsScreen() {
  const { activeProfile, updateCurrency, refreshProfiles } = useProfile();
  const { isDark, toggleTheme, colors, themeName, setThemeName } = useTheme();
  const { t, language, storedLanguage, setLanguage } = useI18n();
  const router = useRouter();
  const db = useSQLiteContext();

  const [loading, setLoading] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const { importStatement, importing } = useStatementImporter();

  const activeCurrencyCode = activeProfile?.currency || 'EUR';
  const activeCurrencySymbol = CURRENCY_SYMBOLS[activeCurrencyCode] || '€';

  const activeLanguageLabel = LANGUAGES.find((item) => item.code === language)?.label ?? '';
  const languageOptions: { code: LanguageCode | null; label: string }[] = [
    { code: null, label: t('settings.languageSystem') },
    ...LANGUAGES,
  ];

  const handleSelectLanguage = (code: LanguageCode | null) => {
    Haptics.selectionAsync();
    setLanguage(code);
    setLanguageModalVisible(false);
  };

  const handleSelectCurrency = (newCurrencyCode: string) => {
    if (newCurrencyCode === activeCurrencyCode) {
      setCurrencyModalVisible(false);
      return;
    }

    Alert.alert(
      t('settings.switchCurrencyTitle'),
      t('settings.switchCurrencyMessage', {
        from: activeCurrencyCode,
        symbol: activeCurrencySymbol,
        to: newCurrencyCode,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.switchCurrencyConfirm'),
          onPress: async () => {
            await updateCurrency(newCurrencyCode);
            setCurrencyModalVisible(false);
          },
        },
      ]
    );
  };

  const handleResetDatabase = () => {
    Alert.alert(
      t('settings.resetTitle'),
      t('settings.resetMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.resetConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await clearAllData(db);
              await refreshProfiles();
              router.dismissAll();
              router.replace('/welcome');
            } catch (error) {
              console.error('Reset error:', error);
              Alert.alert(t('common.error'), t('settings.resetFailed'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.title')}</Text>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.background }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* PROFILES SECTION */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('settings.profiles')}</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => setProfileModalVisible(true)}
          >
            <View style={styles.rowLeft}>
              <View
                style={[
                  styles.avatarDot,
                  { backgroundColor: activeProfile?.avatarColor || '#007AFF' },
                ]}
              >
                <Text style={styles.avatarText}>
                  {activeProfile?.name?.substring(0, 1) || 'P'}
                </Text>
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {activeProfile?.name || t('profile.defaultName')}
                </Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                  {t('settings.activeProfile')}
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.actionBadgeText, { color: colors.accent }]}>{t('settings.switch')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* DATA & STORAGE SECTION */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('settings.data')}</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={importStatement}
            disabled={importing || loading}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="document-text-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.import')}</Text>
            </View>
            {importing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => setBackupModalVisible(true)}
            disabled={importing || loading}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.backup')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={handleResetDatabase}
            disabled={importing || loading}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#FFE5E5' }]}>
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              </View>
              <Text style={[styles.rowTitle, { color: '#FF3B30' }]}>
                {t('settings.reset')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* PREFERENCES SECTION */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('settings.preferences')}</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {/* CURRENCY SELECTION ROW */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => setCurrencyModalVisible(true)}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="cash-outline" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.currency')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                  {activeCurrencyCode} ({activeCurrencySymbol})
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.actionBadgeText, { color: colors.accent }]}>
                {activeCurrencyCode}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* LANGUAGE SELECTION ROW */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => setLanguageModalVisible(true)}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="language-outline" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.language')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                  {storedLanguage ? activeLanguageLabel : t('settings.languageSystem')}
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.actionBadgeText, { color: colors.accent }]}>{activeLanguageLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* CATEGORIES ROW */}
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => router.push('/categories')}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="pricetags-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.categories')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => router.push('/goals')}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#EAF8E6' }]}>
                <Ionicons name="disc-outline" size={18} color="#34C759" />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.budgets')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* NOTIFICATIONS SECTION */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('settings.notifications')}</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="notifications-outline" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.importReminders')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                  {t('settings.importRemindersSub')}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#78788029', true: colors.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#78788029"
            />
          </View>
        </View>

        {/* APPEARANCE SECTION */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('settings.appearance')}</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themeRow}
          >
            {THEMES.map((theme) => {
              const selected = theme.name === themeName;
              const preview = isDark ? theme.dark : theme.light;
              return (
                <TouchableOpacity
                  key={theme.name}
                  style={styles.themeOption}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.themeLabel', { name: theme.label })}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setThemeName(theme.name);
                  }}
                >
                  <View style={[styles.themeRing, { borderColor: selected ? colors.accent : 'transparent' }]}>
                    <LinearGradient
                      colors={preview.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.themeSwatch}
                    >
                      {selected && <Ionicons name="checkmark" size={20} color={preview.onGradient} />}
                    </LinearGradient>
                  </View>
                  <Text
                    style={[
                      styles.themeLabel,
                      { color: selected ? colors.text : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {theme.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.accent} />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.darkMode')}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#78788029', true: colors.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#78788029"
            />
          </View>
        </View>
      </ScrollView>

      {/* Profile Switcher Modal */}
      <ImportSummaryHost />

      <ProfileSwitcherModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
      />

      <BackupRestoreModal
        visible={backupModalVisible}
        onClose={() => setBackupModalVisible(false)}
      />

      {/* Currency Picker Sheet Modal */}
      <Modal visible={currencyModalVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCurrencyModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('settings.selectCurrency')}</Text>
              </View>
              <ScrollView style={{ maxHeight: 320 }}>
                {AVAILABLE_CURRENCIES.map((code) => {
                  const isSelected = activeCurrencyCode === code;
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[
                        styles.sheetItem,
                        { borderBottomColor: colors.border },
                        isSelected && { backgroundColor: colors.tintBackground },
                      ]}
                      onPress={() => handleSelectCurrency(code)}
                    >
                      <Text
                        style={[
                          styles.sheetItemText,
                          { color: colors.text },
                          isSelected && { fontWeight: '700', color: colors.accent },
                        ]}
                      >
                        {t(`currency.${code}`)}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Language Picker Sheet Modal */}
      <Modal visible={languageModalVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLanguageModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('settings.selectLanguage')}</Text>
              </View>
              <ScrollView style={{ maxHeight: 420 }}>
                {languageOptions.map((option) => {
                  const isSelected = storedLanguage === option.code;
                  return (
                    <TouchableOpacity
                      key={option.code ?? 'system'}
                      style={[
                        styles.sheetItem,
                        { borderBottomColor: colors.border },
                        isSelected && { backgroundColor: colors.tintBackground },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => handleSelectLanguage(option.code)}
                    >
                      <Text
                        style={[
                          styles.sheetItemText,
                          { color: colors.text },
                          isSelected && { fontWeight: '700', color: colors.accent },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  cardGroup: {
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 11, marginTop: 1 },
  actionBadgeText: { fontSize: 12, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
  themeRow: { gap: 14, paddingVertical: 16 },
  themeOption: { alignItems: 'center', width: 72 },
  themeRing: { padding: 3, borderRadius: 30, borderWidth: 2 },
  themeSwatch: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeLabel: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  sheetHeader: { alignItems: 'center', marginBottom: 16 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetItemText: { fontSize: 16, fontWeight: '500' },
});