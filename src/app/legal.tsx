import { SelectableText } from '@/components/SelectableText';
import { LEGAL_DOCUMENTS, isLegalPage, legalTranslate } from '@/content/legal';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** The privacy policy, terms of use or disclaimer, from `src/content/legal`: the same text as on the website. */
export default function LegalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ page?: string }>();
  const { colors } = useTheme();
  const { t, format, language } = useI18n();

  const document = LEGAL_DOCUMENTS[isLegalPage(params.page) ? params.page : 'privacy'];
  const [year, month, day] = document.updated.split('-').map(Number);
  const date = format.date(new Date(year, month - 1, day), { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {legalTranslate(language, document.title)}
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
        <SelectableText style={[styles.updated, { color: colors.textSecondary }]}>
          {legalTranslate(language, 'privacy.updated', { date })}
        </SelectableText>
        <SelectableText style={[styles.summary, { color: colors.text }]}>{legalTranslate(language, document.summary)}</SelectableText>

        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {document.sections.map((section, index) => (
            <View
              key={section.text}
              style={[styles.section, index > 0 && styles.sectionBorder, index > 0 && { borderTopColor: colors.border }]}
            >
              <SelectableText style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
                {typeof section.title === 'string' ? legalTranslate(language, section.title) : t(section.title.app)}
              </SelectableText>
              <SelectableText style={[styles.sectionText, { color: colors.textSecondary }]}>
                {legalTranslate(
                  language,
                  section.text,
                  section.link ? { link: legalTranslate(language, section.link) } : undefined
                )}
              </SelectableText>
            </View>
          ))}
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
  updated: { fontSize: 12, marginHorizontal: 4, marginBottom: 8 },
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
  section: { paddingVertical: 14 },
  sectionBorder: { borderTopWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sectionText: { fontSize: 14, lineHeight: 20 },
});
