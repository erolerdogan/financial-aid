import { SignInSheet } from '@/components/account/SignInSheet';
import { SelectableText } from '@/components/SelectableText';
import { FEATURES, isPaywallFeature, type PaywallFeature } from '@/constants/features';
import { BENEFIT_GROUPS, DEFAULT_PLAN, PRIVACY_URL, TERMS_URL, type PlanId } from '@/constants/paywall';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { getOfferings, purchase, restore, type Offering } from '@/services/purchases';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/** What Pro adds and the plans to buy it. `feature` says why it was opened. */
export default function PaywallScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ feature?: string }>();
  const feature: PaywallFeature | null = isPaywallFeature(params.feature) ? params.feature : null;
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { source, refresh } = useEntitlement();
  const insets = useSafeAreaInsets();
  // A purchase belongs to an account: without one, the sign-in sheet comes first.
  const { requireAccount, sheet: signInSheet } = useRequireAccount();

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selected, setSelected] = useState<PlanId>(DEFAULT_PLAN);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOfferings()
      .then((list) => {
        if (!cancelled) setOfferings(list);
      })
      .catch((error) => console.error('Failed to load offerings:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const hasPro = source !== 'free';
  const selectedOffering = offerings.find((offering) => offering.id === selected);

  const reason =
    feature === null || feature === 'offer'
      ? null
      : feature === 'budgets'
      ? t('paywall.reason.budgets', { limit: FEATURES.limits.maxBudgets })
      : feature === 'debts'
      ? t('paywall.reason.debts', { limit: FEATURES.limits.maxDebts })
      : t(`paywall.reason.${feature}`);

  // The group that answers why the paywall opened comes first.
  const groups = [...BENEFIT_GROUPS].sort(
    (a, b) => Number(feature !== null && b.features.includes(feature)) - Number(feature !== null && a.features.includes(feature))
  );

  const priceText = (offering: Offering): string => {
    const price = format.money(offering.amount, offering.currencySymbol, 2);
    if (offering.id === 'yearly') return t('paywall.price.perYear', { price });
    if (offering.id === 'monthly') return t('paywall.price.perMonth', { price });
    return t('paywall.price.once', { price });
  };

  const subText = (offering: Offering): string => {
    if (offering.id === 'lifetime') return t('paywall.price.lifetimeSub');
    if (offering.id === 'monthly') return t('paywall.price.monthlySub');
    return offering.trialDays > 0
      ? t('paywall.price.yearlySub', { days: offering.trialDays })
      : t('paywall.price.perYear', { price: format.money(offering.amount, offering.currencySymbol, 2) });
  };

  const badgeText = (offering: Offering): string | null => {
    if (offering.id === 'yearly' && offering.trialDays > 0) return t('paywall.plan.yearlyBadge', { days: offering.trialDays });
    if (offering.id === 'lifetime') return t('paywall.plan.lifetimeBadge');
    return null;
  };

  const primaryLabel = !selectedOffering
    ? t('paywall.cta.subscribe')
    : selectedOffering.id === 'lifetime'
    ? t('paywall.cta.lifetime')
    : selectedOffering.trialDays > 0
    ? t('paywall.cta.trial', { days: selectedOffering.trialDays })
    : t('paywall.cta.subscribe');

  const handleSelect = (plan: PlanId) => {
    if (plan === selected) return;
    Haptics.selectionAsync().catch(() => {});
    setSelected(plan);
  };

  const handlePurchase = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await purchase(db, selected);
      if (result === 'success') {
        refresh();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(t('paywall.successTitle'), t('paywall.successMessage'), [
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t('paywall.comingSoonTitle'), t('paywall.comingSoonMessage'));
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      Alert.alert(t('common.error'), t('paywall.comingSoonMessage'));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await restore();
      if (result === 'success') {
        refresh();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(t('paywall.successTitle'), t('paywall.successMessage'));
      } else if (result === 'nothingToRestore') {
        Alert.alert(t('paywall.nothingToRestoreTitle'), t('paywall.nothingToRestoreMessage'));
      } else {
        Alert.alert(t('paywall.comingSoonTitle'), t('paywall.comingSoonMessage'));
      }
    } catch (error) {
      console.error('Restore failed:', error);
    } finally {
      setBusy(false);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch((error) => console.warn('Could not open link:', error));
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Measures its own overlap with the status bar: none in an iOS sheet, where window insets would leave a gap. */}
          <SafeAreaView edges={['top']}>
          <View style={styles.hero}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Ionicons name="close" size={22} color={colors.onGradient} />
          </TouchableOpacity>
          <Text style={[styles.heroTitle, { color: colors.onGradient }]} accessibilityRole="header">
            {hasPro ? t('paywall.activeTitle') : t('paywall.title')}
          </Text>
          <Text style={[styles.heroSub, { color: colors.onGradient }]}>
            {hasPro ? t('paywall.successMessage') : t('paywall.subtitle')}
          </Text>
          </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.body}>
          {reason && !hasPro && (
            <View style={[styles.reason, { backgroundColor: colors.tintBackground }]}>
              <Ionicons name="lock-closed" size={16} color={colors.accent} />
              <SelectableText style={[styles.reasonText, { color: colors.text }]}>{reason}</SelectableText>
            </View>
          )}

          {!hasPro && (
            <>
              <View style={styles.plans} accessibilityRole="radiogroup">
                {offerings.map((offering) => {
                  const isSelected = offering.id === selected;
                  const badge = badgeText(offering);
                  const title = t(`paywall.plan.${offering.id}`);
                  return (
                    <TouchableOpacity
                      key={offering.id}
                      activeOpacity={0.85}
                      style={[
                        styles.plan,
                        { backgroundColor: colors.card, borderColor: isSelected ? colors.accent : colors.border },
                        isSelected && styles.planSelected,
                      ]}
                      onPress={() => handleSelect(offering.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={t('paywall.planA11y', {
                        plan: badge ? `${title}, ${badge}` : title,
                        price: `${priceText(offering)}. ${subText(offering)}`,
                      })}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={isSelected ? colors.accent : colors.textSecondary}
                      />
                      <View style={styles.planBody}>
                        <View style={styles.planTitleRow}>
                          <Text style={[styles.planTitle, { color: colors.text }]}>{title}</Text>
                          {badge && (
                            <View style={[styles.planBadge, { backgroundColor: colors.tintBackground }]}>
                              <Text style={[styles.planBadgeText, { color: colors.accent }]}>{badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.planPrice, { color: colors.text }]}>{priceText(offering)}</Text>
                        <Text style={[styles.planSub, { color: colors.textSecondary }]}>{subText(offering)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.accent }, busy && styles.busy]}
                activeOpacity={0.85}
                onPress={() => requireAccount(handlePurchase)}
                disabled={busy || !selectedOffering}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || !selectedOffering, busy }}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{primaryLabel}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.plainBtn} onPress={() => requireAccount(handleRestore)} disabled={busy} accessibilityRole="button">
                <Text style={[styles.plainText, { color: colors.accent }]}>{t('paywall.restore')}</Text>
              </TouchableOpacity>
            </>
          )}

          {groups.map((group) => {
            const highlighted = !hasPro && feature !== null && group.features.includes(feature);
            return (
              <View
                key={group.key}
                style={[
                  styles.group,
                  { backgroundColor: colors.card, borderColor: highlighted ? colors.accent : colors.border },
                  highlighted && styles.groupHighlighted,
                ]}
              >
                <View style={styles.groupHeader}>
                  <View style={[styles.groupIcon, { backgroundColor: colors.tintBackground }]}>
                    <Ionicons name={group.icon} size={18} color={colors.accent} />
                  </View>
                  <SelectableText style={[styles.groupTitle, { color: colors.text }]} accessibilityRole="header">
                    {t(group.title)}
                  </SelectableText>
                </View>
                {group.benefits.map((benefit) => (
                  <View key={benefit} style={styles.benefit}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                    <SelectableText style={[styles.benefitText, { color: colors.text }]}>{t(benefit)}</SelectableText>
                  </View>
                ))}
              </View>
            );
          })}

          {!hasPro && (
            <>
              <View style={styles.links}>
                <TouchableOpacity
                  style={styles.link}
                  onPress={() => openLink(TERMS_URL)}
                  hitSlop={6}
                  accessibilityRole="link"
                >
                  <Text style={[styles.linkText, { color: colors.accent }]}>{t('settings.terms')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.link}
                  onPress={() => openLink(PRIVACY_URL)}
                  hitSlop={6}
                  accessibilityRole="link"
                >
                  <Text style={[styles.linkText, { color: colors.accent }]}>{t('settings.privacyPolicy')}</Text>
                </TouchableOpacity>
              </View>
              <SelectableText style={[styles.disclosure, { color: colors.textSecondary }]}>
                {t('paywall.disclosure')}
              </SelectableText>
            </>
          )}
        </View>
      </ScrollView>

      {/* Always in reach, whatever the scroll position. */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom },
        ]}
      >
        <TouchableOpacity style={styles.plainBtn} onPress={() => router.back()} accessibilityRole="button">
          <Text style={[styles.plainText, { color: colors.textSecondary }]}>
            {hasPro ? t('common.done') : t('common.notNow')}
          </Text>
        </TouchableOpacity>
      </View>
      <SignInSheet {...signInSheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 20 },
  bottomBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, paddingHorizontal: 20 },
  // The close button floats in the corner, so the title needs room on both sides to stay centred.
  hero: { paddingHorizontal: 52, paddingVertical: 12, alignItems: 'center', gap: 2 },
  closeBtn: {
    position: 'absolute',
    top: 6,
    right: 12,
    zIndex: 1,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  heroSub: { fontSize: 14, lineHeight: 19, textAlign: 'center', opacity: 0.9 },
  body: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  reasonText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  group: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  groupHighlighted: { borderWidth: 2 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  benefitText: { flex: 1, fontSize: 15, lineHeight: 20 },
  plans: { gap: 10 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  planSelected: { borderWidth: 2 },
  planBody: { flex: 1, gap: 2 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  planTitle: { fontSize: 16, fontWeight: '700' },
  planBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  planBadgeText: { fontSize: 11, fontWeight: '800' },
  planPrice: { fontSize: 15, fontWeight: '600' },
  planSub: { fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  busy: { opacity: 0.7 },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  plainBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  plainText: { fontSize: 15, fontWeight: '600' },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 20 },
  link: { minHeight: 32, justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '600' },
  disclosure: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
