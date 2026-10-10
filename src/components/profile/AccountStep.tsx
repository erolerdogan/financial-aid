import { SignInButtons } from '@/components/account/SignInButtons';
import { SetupProgress } from '@/components/profile/ProfileSetup';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AccountStepProps {
  /** Position of this step among the profile questions, for the progress dots. */
  current: number;
  total: number;
  /** Signed in, or continued without an account. */
  onDone: () => void;
  onBack: () => void;
}

/** The step after the first-launch questions: an account is offered, and can be skipped. */
export function AccountStep({ current, total, onDone, onBack }: AccountStepProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const handleSkip = () => {
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

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: colors.tintBackground }]}>
            <Ionicons name="person-circle-outline" size={40} color={colors.accent} />
          </View>
          <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {t('account.create.title')}
          </SelectableText>
          <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('account.create.subtitle')}
          </SelectableText>
        </View>

        <SignInButtons onSignedIn={onDone} />
      </ScrollView>

      <TouchableOpacity style={styles.link} onPress={handleSkip} accessibilityRole="button">
        <Text style={[styles.linkText, { color: colors.accent }]}>{t('account.continueWithout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  topBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
  body: { alignItems: 'center', paddingHorizontal: 8, marginBottom: 28 },
  iconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  link: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  linkText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
