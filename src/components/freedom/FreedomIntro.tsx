import { SCENARIO_LABELS } from '@/components/freedom/ScenarioSelector';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { projectGrowth, SCENARIOS, summarize, type FreedomInput } from '@/utils/freedom';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** `app_meta` key; set once the introduction has been read. */
export const FREEDOM_INTRO_SEEN_KEY = 'freedom_intro_seen';

const EXAMPLE: FreedomInput = {
  years: 20,
  lumpSum: 0,
  monthly: 250,
  annualIncreasePct: 0,
  returnPct: 0.07,
  feePct: 0,
};

const percent = (value: number): string => `${Number((value * 100).toFixed(2))}%`;

type Step = { icon: keyof typeof Ionicons.glyphMap; title: TranslationKey; text: TranslationKey };

const STEPS: Step[] = [
  {
    icon: 'create-outline',
    title: 'freedom.intro.step1Title',
    text: 'freedom.intro.step1Text',
  },
  {
    icon: 'trending-up-outline',
    title: 'freedom.intro.step2Title',
    text: 'freedom.intro.step2Text',
  },
  {
    icon: 'bar-chart-outline',
    title: 'freedom.intro.step3Title',
    text: 'freedom.intro.step3Text',
  },
  {
    icon: 'flag-outline',
    title: 'freedom.intro.step4Title',
    text: 'freedom.intro.step4Text',
  },
  {
    icon: 'scale-outline',
    title: 'freedom.intro.step5Title',
    text: 'freedom.intro.step5Text',
  },
];

interface FreedomIntroProps {
  currencySymbol: string;
  actionLabel: string;
  onDone: () => void;
}

export function FreedomIntro({ currencySymbol, actionLabel, onDone }: FreedomIntroProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();
  // Only the outlook step uses it; the other step texts have no placeholder.
  const scenarios = SCENARIOS.map((scenario) =>
    t('freedom.intro.scenarioAssumes', {
      label: t(SCENARIO_LABELS[scenario.key]),
      percent: percent(scenario.returnPct),
    })
  ).join(', ');

  const example = useMemo(() => summarize(projectGrowth(EXAMPLE), EXAMPLE), []);

  const fmt = (value: number) => format.money(Math.round(value), currencySymbol);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">
        {t('freedom.intro.heading')}
      </Text>
      <Text style={[styles.lead, { color: colors.textSecondary }]}>
        {t('freedom.intro.lead')}
      </Text>

      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.exampleCard}
        accessible
        accessibilityLabel={t('freedom.intro.exampleA11y', {
          amount: fmt(EXAMPLE.monthly),
          years: EXAMPLE.years,
          percent: percent(EXAMPLE.returnPct),
          invested: fmt(example.totalInvested),
          profit: fmt(example.profit),
          balance: fmt(example.finalBalance),
        })}
      >
        <Text style={[styles.exampleLabel, { color: colors.onGradient }]}>{t('freedom.intro.exampleLabel')}</Text>
        <Text style={[styles.exampleText, { color: colors.onGradient }]}>
          {t('freedom.intro.exampleText', {
            amount: fmt(EXAMPLE.monthly),
            years: EXAMPLE.years,
            percent: percent(EXAMPLE.returnPct),
          })}
        </Text>
        <View style={styles.exampleRow}>
          <View style={styles.exampleCell}>
            <Text style={[styles.exampleValue, { color: colors.onGradient }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(example.totalInvested)}
            </Text>
            <Text style={[styles.exampleSub, { color: colors.onGradient }]}>{t('freedom.intro.youPayIn')}</Text>
          </View>
          <Text style={[styles.exampleSign, { color: colors.onGradient }]}>+</Text>
          <View style={styles.exampleCell}>
            <Text style={[styles.exampleValue, { color: colors.onGradient }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(example.profit)}
            </Text>
            <Text style={[styles.exampleSub, { color: colors.onGradient }]}>{t('freedom.intro.growth')}</Text>
          </View>
          <Text style={[styles.exampleSign, { color: colors.onGradient }]}>=</Text>
          <View style={styles.exampleCell}>
            <Text style={[styles.exampleValue, { color: colors.onGradient }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(example.finalBalance)}
            </Text>
            <Text style={[styles.exampleSub, { color: colors.onGradient }]}>{t('freedom.intro.finalBalance')}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{t('freedom.intro.howItWorks')}</Text>
        {STEPS.map((step, index) => (
          <View key={step.title} style={[styles.step, index > 0 && styles.stepGap]}>
            <View style={[styles.stepIcon, { backgroundColor: colors.tintBackground }]}>
              <Ionicons name={step.icon} size={18} color={colors.accent} />
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>{t(step.title)}</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>{t(step.text, { scenarios })}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.privacyRow}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
          {t('freedom.intro.privacy')}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.actionBtn, { backgroundColor: colors.accent }]}
        onPress={onDone}
        accessibilityRole="button"
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>

      <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
        {t('freedom.disclaimer')}
      </Text>
    </ScrollView>
  );
}

interface FreedomIntroModalProps {
  visible: boolean;
  onClose: () => void;
  currencySymbol: string;
}

export function FreedomIntroModal({ visible, onClose, currencySymbol }: FreedomIntroModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
        edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('freedom.intro.modalTitle')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.headerAction} accessibilityRole="button">
            <Text style={[styles.headerActionText, { color: colors.accent }]}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <FreedomIntro currencySymbol={currencySymbol} actionLabel={t('freedom.intro.gotIt')} onDone={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerAction: { position: 'absolute', right: 20 },
  headerActionText: { fontSize: 16, fontWeight: '600' },
  modalBody: { flex: 1, paddingTop: 20 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  heading: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  lead: { fontSize: 15, lineHeight: 21, marginBottom: 4 },
  exampleCard: { borderRadius: 18, padding: 18 },
  exampleLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, opacity: 0.85 },
  exampleText: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  exampleRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 14, gap: 6 },
  exampleCell: { flex: 1 },
  exampleValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  exampleSub: { fontSize: 11, opacity: 0.85, marginTop: 2 },
  exampleSign: { fontSize: 18, fontWeight: '700', opacity: 0.85 },
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  cardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 },
  step: { flexDirection: 'row', gap: 12 },
  stepGap: { marginTop: 16 },
  stepIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '600' },
  stepText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  privacyText: { fontSize: 12, flexShrink: 1 },
  actionBtn: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginTop: 4 },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disclaimer: { fontSize: 12, textAlign: 'center' },
});
