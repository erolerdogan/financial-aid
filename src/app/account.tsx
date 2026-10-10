import { SignInButtons } from '@/components/account/SignInButtons';
import { SelectableText } from '@/components/SelectableText';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useEraseAllData } from '@/hooks/useEraseAllData';
import type { TranslationKey } from '@/i18n';
import type { AuthMethod } from '@/utils/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const METHOD_LABEL: Record<AuthMethod, TranslationKey> = {
  apple: 'account.method.apple',
  google: 'account.method.google',
  email: 'account.method.email',
};

/** Settings → Account: sign in, or see the account, sign out and delete it. */
export default function AccountScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isDemoMode } = useProfile();
  const { user, signOut, deleteAccount } = useAuth();
  const eraseAllData = useEraseAllData();
  const [busy, setBusy] = useState(false);

  const handleSignOut = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(t('account.signOutTitle'), t('account.signOutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.signOut'),
        onPress: async () => {
          setBusy(true);
          await signOut();
          setBusy(false);
        },
      },
    ]);
  };

  const runDelete = async (erase: boolean) => {
    setBusy(true);
    const result = await deleteAccount();
    if (result !== 'success') {
      setBusy(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert(t('common.error'), t(result === 'offline' ? 'account.error.offline' : 'account.deleteFailed'));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!erase) {
      setBusy(false);
      Alert.alert(t('account.deletedTitle'), t('account.deletedMessage'));
      return;
    }
    try {
      // Leaves this screen for Welcome.
      await eraseAllData();
    } catch (error) {
      console.error('Erase after account deletion failed:', error);
      setBusy(false);
      Alert.alert(t('account.deletedTitle'), t('settings.resetFailed'));
    }
  };

  const handleDelete = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(t('account.deleteTitle'), t('account.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.deleteOnly'), style: 'destructive', onPress: () => runDelete(false) },
      // Not in the demo workspace, where Settings does not offer a reset either.
      ...(isDemoMode
        ? []
        : [{ text: t('account.deleteAndErase'), style: 'destructive' as const, onPress: () => runDelete(true) }]),
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SelectableText style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t('account.title')}
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

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {user ? (
            <>
              <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
                <View style={styles.rowItem}>
                  <SelectableText style={[styles.rowTitle, { color: colors.text }]}>{t('account.email')}</SelectableText>
                  <SelectableText style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {user.email ?? t('account.noEmail')}
                  </SelectableText>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.rowItem}>
                  <SelectableText style={[styles.rowTitle, { color: colors.text }]}>{t('account.method')}</SelectableText>
                  <SelectableText style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {t(user.method ? METHOD_LABEL[user.method] : 'account.method.other')}
                  </SelectableText>
                </View>
              </View>
              <SelectableText style={[styles.note, { color: colors.textSecondary }]}>{t('account.stored')}</SelectableText>

              <View style={[styles.cardGroup, styles.actions, { backgroundColor: colors.card }]}>
                <TouchableOpacity
                  style={[styles.rowItem, busy && styles.rowDisabled]}
                  activeOpacity={0.7}
                  onPress={handleSignOut}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                      <Ionicons name="log-out-outline" size={18} color={colors.accent} />
                    </View>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{t('account.signOut')}</Text>
                  </View>
                  {busy && <ActivityIndicator size="small" color={colors.accent} />}
                </TouchableOpacity>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={[styles.rowItem, busy && styles.rowDisabled]}
                  activeOpacity={0.7}
                  onPress={handleDelete}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconCircle, styles.dangerCircle]}>
                      <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                    </View>
                    <Text style={[styles.rowTitle, styles.dangerText]}>{t('account.delete')}</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <SelectableText style={[styles.note, { color: colors.textSecondary }]}>{t('account.deleteNote')}</SelectableText>
            </>
          ) : (
            <>
              <SelectableText style={[styles.lead, { color: colors.text }]}>{t('account.signedOutLead')}</SelectableText>
              <View style={[styles.cardGroup, styles.signIn, { backgroundColor: colors.card }]}>
                <SignInButtons />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  lead: { fontSize: 16, lineHeight: 23, fontWeight: '600', marginHorizontal: 4, marginBottom: 16 },
  cardGroup: {
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  signIn: { paddingVertical: 16 },
  actions: { marginTop: 24 },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowDisabled: { opacity: 0.4 },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { flexShrink: 1, fontSize: 15, fontWeight: '600' },
  rowValue: { flexShrink: 1, fontSize: 15, textAlign: 'right' },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerCircle: { backgroundColor: '#FFE5E5' },
  dangerText: { color: '#FF3B30' },
  divider: { height: StyleSheet.hairlineWidth },
  note: { fontSize: 13, lineHeight: 18, marginHorizontal: 4, marginTop: 8 },
});
