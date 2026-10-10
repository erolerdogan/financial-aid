import { SetupProgress } from '@/components/profile/ProfileSetup';
import { SelectableText } from '@/components/SelectableText';
import { BENEFIT_GROUPS } from '@/constants/paywall';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OfferStepProps {
  /** Position of this step among the first-launch steps, for the progress dots. */
  current: number;
  total: number;
  /** Moved on, with or without looking at the plans. */
  onDone: () => void;
  onBack: () => void;
}

/** The step after the profile questions: what Pro adds. The plans and the purchase are the paywall's. */
export function OfferStep({ current, total, onDone, onBack }: OfferStepProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { source } = useEntitlement();
  const hasPro = source !== 'free';

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const handleSeePlans = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: '/paywall', params: { feature: 'offer' } });
  };

  const handleContinue = () => {
    Haptics.selectionAsync().catch(() => {});
    onDone();
  };

  return (
    <View style={styles.fill}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.topBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <SetupProgress current={current} total={total} />
        <View style={styles.topBtn} />
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: colors.tintBackground }]}>
            <Ionicons name="sparkles-outline" size={40} color={colors.accent} />
          </View>
          <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {hasPro ? t('paywall.activeTitle') : t('welcome.offer.title')}
          </SelectableText>
          <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {hasPro ? t('paywall.successMessage') : t('welcome.offer.subtitle')}
          </SelectableText>
        </View>

        <View style={styles.groups}>
          {BENEFIT_GROUPS.map((group) => (
            <View key={group.key} style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.groupIcon, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name={group.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.groupBody}>
                <SelectableText style={[styles.groupTitle, { color: colors.text }]}>{t(group.title)}</SelectableText>
                <SelectableText style={[styles.groupText, { color: colors.textSecondary }]}>
                  {t(group.benefits[0])}
                </SelectableText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {hasPro ? (
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={handleContinue}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{t('common.continue')}</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
            activeOpacity={0.85}
            onPress={handleSeePlans}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{t('welcome.offer.seePlans')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={handleContinue} accessibilityRole="button">
            <Text style={[styles.linkText, { color: colors.accent }]}>{t('welcome.offer.continueFree')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  topBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
  body: { alignItems: 'center', paddingHorizontal: 8, marginBottom: 24 },
  iconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  groups: { gap: 10 },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  groupBody: { flex: 1, gap: 2 },
  groupTitle: { fontSize: 15, fontWeight: '700' },
  groupText: { fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  link: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  linkText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
