import { SelectableText } from '@/components/SelectableText';
import { legalTranslate, type LegalKey, type LegalPage } from '@/content/legal';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// The parts of the privacy policy about the data itself, so this screen says what the policy says.
const FACTS: { icon: keyof typeof Ionicons.glyphMap; title: LegalKey; text: LegalKey }[] = [
  { icon: 'phone-portrait-outline', title: 'privacy.s1Title', text: 'privacy.s1Text' },
  { icon: 'eye-off-outline', title: 'privacy.s2Title', text: 'privacy.s2Text' },
  { icon: 'person-circle-outline', title: 'privacy.s9Title', text: 'privacy.s9Text' },
  { icon: 'share-outline', title: 'privacy.s3Title', text: 'privacy.s3Text' },
  { icon: 'trash-outline', title: 'privacy.s5Title', text: 'privacy.s5Text' },
];

// The documents, shown by the `legal` route from `src/content/legal`.
const LEGAL_ROWS: { page: LegalPage; label: TranslationKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { page: 'privacy', label: 'settings.privacyPolicy', icon: 'lock-closed-outline' },
  { page: 'terms', label: 'settings.terms', icon: 'document-outline' },
  { page: 'disclaimer', label: 'settings.disclaimer', icon: 'information-circle-outline' },
];

/** Where the user's data is stored and what happens to it, in short, and the legal documents. */
export default function DataPrivacyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, language } = useI18n();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t('settings.dataPrivacy')}
        </SelectableText>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.background }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SelectableText style={[styles.summary, { color: colors.text }]}>{t('dataPrivacy.lead')}</SelectableText>

        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {FACTS.map((fact, index) => (
            <View
              key={fact.text}
              style={[styles.fact, index > 0 && styles.factBorder, index > 0 && { borderTopColor: colors.border }]}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name={fact.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.factText}>
                <SelectableText style={[styles.factTitle, { color: colors.text }]}>{legalTranslate(language, fact.title)}</SelectableText>
                <SelectableText style={[styles.factBody, { color: colors.textSecondary }]}>
                  {legalTranslate(language, fact.text)}
                </SelectableText>
              </View>
            </View>
          ))}
        </View>

        <SelectableText style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('dataPrivacy.documents')}</SelectableText>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {LEGAL_ROWS.map((row) => (
            <Fragment key={row.page}>
              <TouchableOpacity
                style={styles.rowItem}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/legal', params: { page: row.page } })}
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                    <Ionicons name={row.icon} size={18} color={colors.accent} />
                  </View>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{t(row.label)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </Fragment>
          ))}
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.7} onPress={() => router.push('/licenses')} accessibilityRole="button">
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="code-slash-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t('licenses.title')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  summary: { fontSize: 16, lineHeight: 23, fontWeight: '600', marginHorizontal: 4, marginBottom: 16 },
  cardGroup: {
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  fact: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  factBorder: { borderTopWidth: StyleSheet.hairlineWidth },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factText: { flex: 1 },
  factTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  factBody: { fontSize: 14, lineHeight: 20 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 12 },
  rowTitle: { flexShrink: 1, fontSize: 15, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
});
