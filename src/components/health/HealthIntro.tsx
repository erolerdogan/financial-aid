import { ScoreRing } from '@/components/health/ScoreRing';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { biggestImprovement, healthScore, pillarScores, type HealthMetrics } from '@/utils/budgetHealth';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** `app_meta` key; set once the introduction has been read (app-wide, like the Future Growth one). */
export const HEALTH_INTRO_SEEN_KEY = 'health_intro_seen';

// Only the five pillar figures are read; the score in the card comes from the real engine.
const EXAMPLE: HealthMetrics = {
  netIncome: 0,
  spending: 0,
  saved: 0,
  savingsRate: 10,
  housingPct: 33,
  fixedCosts: 0,
  fixedPct: 55,
  debtPayments: 0,
  debtPct: 5,
  bufferMonths: 1.5,
};

type Step = { icon: keyof typeof Ionicons.glyphMap; title: TranslationKey; text: TranslationKey };

const STEPS: Step[] = [
  { icon: 'pulse-outline', title: 'health.intro.step1Title', text: 'health.intro.step1Text' },
  { icon: 'cash-outline', title: 'health.intro.step2Title', text: 'health.intro.step2Text' },
  { icon: 'options-outline', title: 'health.intro.step3Title', text: 'health.intro.step3Text' },
  { icon: 'flag-outline', title: 'health.intro.step4Title', text: 'health.intro.step4Text' },
  { icon: 'notifications-outline', title: 'health.intro.step5Title', text: 'health.intro.step5Text' },
];

interface HealthIntroProps {
  actionLabel: string;
  onDone: () => void;
}

export function HealthIntro({ actionLabel, onDone }: HealthIntroProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const example = useMemo(() => {
    const pillars = pillarScores(EXAMPLE);
    return { score: healthScore(pillars) ?? 0, improvement: biggestImprovement(pillars) };
  }, []);

  const exampleText = t('health.intro.exampleText', {
    savings: EXAMPLE.savingsRate ?? 0,
    housing: EXAMPLE.housingPct ?? 0,
    buffer: format.number(EXAMPLE.bufferMonths ?? 0),
  });
  const improvementText = example.improvement
    ? t(example.improvement.message.key, example.improvement.message.params)
    : '';

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SelectableText style={[styles.heading, { color: colors.text }]} accessibilityRole="header">
        {t('health.intro.heading')}
      </SelectableText>
      <SelectableText style={[styles.lead, { color: colors.textSecondary }]}>{t('health.intro.lead')}</SelectableText>

      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.exampleCard}
        accessible
        accessibilityLabel={`${t('health.intro.exampleLabel')}. ${exampleText} ${t('health.scoreOf', { score: example.score })}. ${improvementText}`}
      >
        <SelectableText style={[styles.exampleLabel, { color: colors.onGradient }]}>{t('health.intro.exampleLabel')}</SelectableText>
        <View style={styles.exampleRow}>
          <ScoreRing
            score={example.score}
            size={72}
            strokeWidth={7}
            color={colors.onGradient}
            trackColor={`${colors.onGradient}40`}
          >
            <SelectableText style={[styles.exampleScore, { color: colors.onGradient }]}>{example.score}</SelectableText>
          </ScoreRing>
          <View style={styles.exampleBody}>
            <SelectableText style={[styles.exampleText, { color: colors.onGradient }]}>{exampleText}</SelectableText>
            {improvementText ? (
              <SelectableText style={[styles.exampleSub, { color: colors.onGradient }]}>{improvementText}</SelectableText>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SelectableText style={[styles.cardTitle, { color: colors.textSecondary }]}>{t('freedom.intro.howItWorks')}</SelectableText>
        {STEPS.map((step, index) => (
          <View key={step.title} style={[styles.step, index > 0 && styles.stepGap]}>
            <View style={[styles.stepIcon, { backgroundColor: colors.tintBackground }]}>
              <Ionicons name={step.icon} size={18} color={colors.accent} />
            </View>
            <View style={styles.stepBody}>
              <SelectableText style={[styles.stepTitle, { color: colors.text }]}>{t(step.title)}</SelectableText>
              <SelectableText style={[styles.stepText, { color: colors.textSecondary }]}>{t(step.text)}</SelectableText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.privacyRow}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
        <SelectableText style={[styles.privacyText, { color: colors.textSecondary }]}>{t('health.intro.privacy')}</SelectableText>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.actionBtn, { backgroundColor: colors.accent }]}
        onPress={onDone}
        accessibilityRole="button"
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>

      <SelectableText style={[styles.disclaimer, { color: colors.textSecondary }]}>{t('health.disclaimer')}</SelectableText>
    </ScrollView>
  );
}

interface HealthIntroModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HealthIntroModal({ visible, onClose }: HealthIntroModalProps) {
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
          <SelectableText style={[styles.headerTitle, { color: colors.text }]}>{t('health.intro.modalTitle')}</SelectableText>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.headerAction} accessibilityRole="button">
            <Text style={[styles.headerActionText, { color: colors.accent }]}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <HealthIntro actionLabel={t('freedom.intro.gotIt')} onDone={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// Same measures as `FreedomIntro`, so the two introductions read as one family.
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
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  exampleBody: { flex: 1 },
  exampleScore: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  exampleText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  exampleSub: { fontSize: 12, lineHeight: 17, opacity: 0.9, marginTop: 6 },
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
