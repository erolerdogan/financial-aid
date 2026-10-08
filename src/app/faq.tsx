import { SelectableText } from '@/components/SelectableText';
import { BANK_GUIDES, guideName } from '@/content/bankGuides';
import { FAQ_GROUPS, faqParams, faqTranslate, type FaqGroupId, type FaqKey } from '@/content/faq';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GROUP_ICONS: Record<FaqGroupId, keyof typeof Ionicons.glyphMap> = {
  start: 'flag-outline',
  import: 'document-text-outline',
  categories: 'pricetags-outline',
  plan: 'pulse-outline',
  privacy: 'lock-closed-outline',
  profiles: 'people-outline',
};

/** Frequently asked questions, from `src/content/faq`: the same text as on the website. */
export default function FaqScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const [openKey, setOpenKey] = useState<FaqKey | null>(null);

  const params = useMemo(() => faqParams(t, BANK_GUIDES.map(guideName).join(', ')), [t]);

  const toggle = (key: FaqKey) => {
    Haptics.selectionAsync();
    setOpenKey((current) => (current === key ? null : key));
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {faqTranslate(language, 'faq.title')}
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
        <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {faqTranslate(language, 'faq.intro')}
        </SelectableText>

        {FAQ_GROUPS.map((group) => (
          <Fragment key={group.id}>
            <View style={styles.groupHeader}>
              <Ionicons name={GROUP_ICONS[group.id]} size={16} color={colors.accent} />
              <SelectableText style={[styles.groupTitle, { color: colors.text }]} accessibilityRole="header">
                {typeof group.title === 'string' ? faqTranslate(language, group.title) : t(group.title.app)}
              </SelectableText>
            </View>
            <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
              {group.items.map((item, index) => {
                const open = openKey === item.q;
                return (
                  <Fragment key={item.q}>
                    {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                    <TouchableOpacity
                      style={styles.rowItem}
                      activeOpacity={0.7}
                      onPress={() => toggle(item.q)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                    >
                      <Text style={[styles.question, { color: colors.text }]}>
                        {faqTranslate(language, item.q, params)}
                      </Text>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    {open && (
                      <SelectableText style={[styles.answer, { color: colors.textSecondary }]}>
                        {faqTranslate(language, item.a, params)}
                      </SelectableText>
                    )}
                  </Fragment>
                );
              })}
            </View>
          </Fragment>
        ))}

        <View style={[styles.cardGroup, styles.linkGroup, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.linkRow} activeOpacity={0.7} onPress={() => router.push('/export-guide')}>
            <Text style={[styles.linkText, { color: colors.accent }]}>{t('guide.settingsRow')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.linkRow} activeOpacity={0.7} onPress={() => router.push('/data-privacy')}>
            <Text style={[styles.linkText, { color: colors.accent }]}>{t('settings.dataPrivacy')}</Text>
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
  subtitle: { fontSize: 14, lineHeight: 20, marginHorizontal: 4 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  groupTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
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
    gap: 12,
    paddingVertical: 14,
    minHeight: 44,
  },
  question: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  answer: { fontSize: 14, lineHeight: 20, paddingBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth },
  linkGroup: { marginTop: 24 },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: '600' },
});
