import { SelectableText } from '@/components/SelectableText';
import { LICENSE_TEXTS, OPEN_SOURCE_PACKAGES } from '@/constants/licenses';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LicensesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [openName, setOpenName] = useState<string | null>(null);

  const toggle = (name: string) => {
    Haptics.selectionAsync();
    setOpenName((current) => (current === name ? null : name));
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]} maxFontSizeMultiplier={1.4}>{t('licenses.title')}</SelectableText>
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
        <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>{t('licenses.intro')}</SelectableText>
        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {OPEN_SOURCE_PACKAGES.map((item, index) => {
            const open = openName === item.name;
            return (
              <Fragment key={item.name}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity
                  style={styles.rowItem}
                  activeOpacity={0.7}
                  onPress={() => toggle(item.name)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                      {t('licenses.packageMeta', { version: item.version, license: item.license })}
                    </Text>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {open && (
                  <SelectableText style={[styles.licenseText, { color: colors.textSecondary }]}>
                    {LICENSE_TEXTS[item.text]}
                  </SelectableText>
                )}
              </Fragment>
            );
          })}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
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
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  licenseText: { fontSize: 12, lineHeight: 17, paddingBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth },
});
