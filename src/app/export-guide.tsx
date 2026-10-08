import { SelectableText } from '@/components/SelectableText';
import {
  BankGuide,
  CHANNEL_KEYS,
  GENERIC_STEPS,
  GuideStep,
  findGuide,
  guideName,
  labelLanguage,
  languageName,
  searchGuides,
  stepParts,
} from '@/content/bankGuides';
import { ImportProgressOverlay } from '@/components/ImportProgressOverlay';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// `OTHER` is the general guide for a bank that has none of its own.
type Selection = BankGuide | 'OTHER' | null;

export default function ExportGuideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bank?: string }>();
  const { colors } = useTheme();
  const { t, format, language } = useI18n();
  const { refreshProfiles, hasData } = useProfile();

  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>(() => findGuide(params.bank));
  // Opened from Welcome: the tabs are not in the stack yet.
  const [openedWithoutData] = useState(!hasData);

  const { importStatement, importing, importDisabled } = useStatementImporter({
    onSuccess: async () => {
      await refreshProfiles();
      // The summary sheet is hosted by the tabs; leave this screen (and Settings under it).
      if (router.canDismiss()) router.dismissAll();
      if (openedWithoutData) router.replace('/(tabs)');
    },
  });

  const select = (next: Selection) => {
    Haptics.selectionAsync();
    setSelection(next);
  };

  const results = searchGuides(query);
  const guide = selection === 'OTHER' ? null : selection;
  const steps: GuideStep[] = guide ? guide.steps : GENERIC_STEPS;
  const menuLanguage = guide ? labelLanguage(guide, language) : language;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {selection ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => select(null)}
            accessibilityRole="button"
            accessibilityLabel={t('guide.allBanks')}
          >
            <Ionicons name="chevron-back" size={20} color={colors.accent} />
            <Text style={[styles.backText, { color: colors.accent }]}>{t('guide.allBanks')}</Text>
          </TouchableOpacity>
        ) : (
          <SelectableText style={[styles.headerTitle, { color: colors.text }]}>{t('guide.title')}</SelectableText>
        )}
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.background }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {selection ? (
        <>
          <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <SelectableText style={[styles.bankTitle, { color: colors.text }]}>
              {guide ? guideName(guide) : t('guide.otherBankTitle')}
            </SelectableText>
            {guide && (
              <View style={styles.metaRow}>
                <View style={[styles.metaPill, { backgroundColor: colors.tintBackground }]}>
                  <Ionicons
                    name={guide.channel === 'WEB' ? 'globe-outline' : 'phone-portrait-outline'}
                    size={13}
                    color={colors.accent}
                  />
                  <SelectableText style={[styles.metaText, { color: colors.accent }]}>{t(CHANNEL_KEYS[guide.channel])}</SelectableText>
                </View>
                <View style={[styles.metaPill, { backgroundColor: colors.tintBackground }]}>
                  <Ionicons name="document-text-outline" size={13} color={colors.accent} />
                  <SelectableText style={[styles.metaText, { color: colors.accent }]}>
                    {t('guide.fileType', { format: guide.format })}
                  </SelectableText>
                </View>
              </View>
            )}

            <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
              {steps.map((step, index) => (
                <View key={`${step.key}-${index}`}>
                  {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  <View style={styles.stepRow}>
                    <View style={[styles.stepNumber, { backgroundColor: colors.tintBackground }]}>
                      <SelectableText style={[styles.stepNumberText, { color: colors.accent }]}>{format.number(index + 1)}</SelectableText>
                    </View>
                    <SelectableText style={[styles.stepText, { color: colors.text }]}>
                      {stepParts(step, guide, language, t).map((part, partIndex) => (
                        <Text key={partIndex} style={part.label ? styles.stepLabel : undefined}>
                          {part.text}
                        </Text>
                      ))}
                    </SelectableText>
                  </View>
                </View>
              ))}
            </View>

            {guide?.note && (
              <View style={styles.noteRow}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                <SelectableText style={[styles.noteText, { color: colors.textSecondary }]}>{t(guide.note)}</SelectableText>
              </View>
            )}
            <View style={styles.noteRow}>
              <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
              <SelectableText style={[styles.noteText, { color: colors.textSecondary }]}>{t('guide.shareTip')}</SelectableText>
            </View>

            {guide && (
              <SelectableText style={[styles.footnote, { color: colors.textSecondary }]}>
                {menuLanguage !== language && `${t('guide.labelsNote', { language: languageName(menuLanguage) })} `}
                {t('guide.checked', { bank: guideName(guide), date: format.monthYear(guide.verified) })}
              </SelectableText>
            )}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: colors.accent }, importDisabled && styles.importBtnDisabled]}
              onPress={importStatement}
              disabled={importing || importDisabled}
              activeOpacity={0.85}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="download-outline" size={18} color="#FFF" />
              )}
              <Text style={styles.importText}>{importing ? t('welcome.processing') : t('welcome.import')}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>{t('guide.subtitle')}</SelectableText>

          <View style={[styles.searchField, { backgroundColor: colors.field }]}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
              placeholder={t('guide.search')}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>

          {results.length > 0 ? (
            <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
              {results.map((item, index) => (
                <View key={item.slug}>
                  {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  <TouchableOpacity
                    style={styles.bankRow}
                    activeOpacity={0.7}
                    onPress={() => select(item)}
                    accessibilityRole="button"
                  >
                    <View style={styles.bankRowText}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{guideName(item)}</Text>
                      <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                        {t(CHANNEL_KEYS[item.channel])}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <SelectableText style={[styles.noResults, { color: colors.textSecondary }]}>
              {t('guide.noResults', { query: query.trim() })}
            </SelectableText>
          )}

          <View style={[styles.cardGroup, styles.otherGroup, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={styles.bankRow}
              activeOpacity={0.7}
              onPress={() => select('OTHER')}
              accessibilityRole="button"
            >
              <View style={styles.bankRowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{t('guide.otherBank')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{t('guide.otherBankSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
      <ImportProgressOverlay />
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32, marginLeft: -6 },
  backText: { fontSize: 16, fontWeight: '600' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 16, marginHorizontal: 4 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  cardGroup: {
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  otherGroup: { marginTop: 16 },
  divider: { height: StyleSheet.hairlineWidth },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    minHeight: 56,
  },
  bankRowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  noResults: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  bankTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginHorizontal: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginHorizontal: 4 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  metaText: { fontSize: 12, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: { fontSize: 13, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 16, lineHeight: 23, paddingTop: 1 },
  stepLabel: { fontWeight: '700' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, marginHorizontal: 4 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  footnote: { fontSize: 12, lineHeight: 17, marginTop: 20, marginHorizontal: 4 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  importBtnDisabled: { opacity: 0.4 },
  importBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  importText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
