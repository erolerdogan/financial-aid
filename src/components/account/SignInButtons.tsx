import { SelectableText } from '@/components/SelectableText';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { GOOGLE_SIGN_IN_AVAILABLE, isAppleSignInAvailable } from '@/services/auth';
import type { AuthResult } from '@/utils/auth';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const BUTTON_HEIGHT = 52;
const BUTTON_RADIUS = 14;

const ERROR_TEXT: Partial<Record<AuthResult, TranslationKey>> = {
  invalidEmail: 'account.error.invalidEmail',
  offline: 'account.error.offline',
  unavailable: 'account.error.unavailable',
  failed: 'account.error.failed',
};

type Method = 'apple' | 'google' | 'email';

/** The Google mark in its own colours, as its sign-in guidelines ask. */
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessible={false}>
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

interface SignInButtonsProps {
  /** Called once when the user becomes signed in, also when that happens later through the email link. */
  onSignedIn?: () => void;
}

/** The three ways to sign in, and the line that says what the account stores. Shown wherever an account is offered. */
export function SignInButtons({ onSignedIn }: SignInButtonsProps) {
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const { user, linkFailed, signInWithApple, signInWithGoogle, signInWithEmail } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<Method | null>(null);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);

  useEffect(() => {
    let active = true;
    isAppleSignInAvailable().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  // The email link signs in while this is on screen, without a call from here returning.
  const wasSignedIn = useRef(user !== null);
  useEffect(() => {
    const signedIn = user !== null;
    if (signedIn && !wasSignedIn.current) onSignedIn?.();
    wasSignedIn.current = signedIn;
  }, [user, onSignedIn]);

  const run = async (method: Method, attempt: () => Promise<AuthResult>) => {
    if (busy) return;
    Haptics.selectionAsync().catch(() => {});
    setBusy(method);
    setError(null);
    const result = await attempt();
    setBusy(null);
    if (result === 'success' || result === 'emailSent') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (result === 'emailSent') setSentTo(email.trim());
      return;
    }
    if (result === 'cancelled') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setError(ERROR_TEXT[result] ?? 'account.error.failed');
  };

  const handleOtherEmail = () => {
    Haptics.selectionAsync().catch(() => {});
    setSentTo(null);
    setError(null);
  };

  const privacy = (
    <View style={styles.privacy}>
      <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
      <SelectableText style={[styles.privacyText, { color: colors.textSecondary }]}>{t('account.privacy')}</SelectableText>
    </View>
  );

  if (sentTo !== null && !linkFailed) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.sent, { backgroundColor: colors.surface }]}>
          <Ionicons name="mail-unread-outline" size={28} color={colors.accent} />
          <SelectableText style={[styles.sentTitle, { color: colors.text }]} accessibilityRole="header">
            {t('account.linkSentTitle')}
          </SelectableText>
          <SelectableText style={[styles.sentText, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
            {t('account.linkSentText', { email: sentTo })}
          </SelectableText>
        </View>
        <TouchableOpacity style={styles.plainBtn} onPress={handleOtherEmail} activeOpacity={0.7} accessibilityRole="button">
          <Text style={[styles.plainText, { color: colors.accent }]}>{t('account.useOtherEmail')}</Text>
        </TouchableOpacity>
        {privacy}
      </View>
    );
  }

  const message = error ? t(error) : linkFailed ? t('account.linkFailed') : null;

  return (
    <View style={styles.wrap}>
      {appleAvailable && (
        <View style={busy !== null && styles.disabled} pointerEvents={busy !== null ? 'none' : 'auto'}>
          {/* Apple's own button: its label follows the language of the device. */}
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={BUTTON_RADIUS}
            style={styles.appleBtn}
            onPress={() => run('apple', signInWithApple)}
          />
        </View>
      )}

      {GOOGLE_SIGN_IN_AVAILABLE && (
        <TouchableOpacity
          style={[styles.btn, styles.outlineBtn, { backgroundColor: colors.card, borderColor: colors.border }, busy !== null && styles.disabled]}
          onPress={() => run('google', signInWithGoogle)}
          disabled={busy !== null}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy !== null, busy: busy === 'google' }}
        >
          {busy === 'google' ? <ActivityIndicator size="small" color={colors.accent} /> : <GoogleMark />}
          <Text style={[styles.btnText, { color: colors.text }]}>{t('account.google')}</Text>
        </TouchableOpacity>
      )}

      {(appleAvailable || GOOGLE_SIGN_IN_AVAILABLE) && (
        <View style={styles.orRow}>
          <View style={[styles.orLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.orText, { color: colors.textSecondary }]}>{t('account.or')}</Text>
          <View style={[styles.orLine, { backgroundColor: colors.border }]} />
        </View>
      )}

      <TextInput
        style={[styles.input, { backgroundColor: colors.field, color: colors.text }]}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (error) setError(null);
        }}
        placeholder={t('account.emailPlaceholder')}
        placeholderTextColor={colors.textSecondary}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        editable={busy === null}
        onSubmitEditing={() => run('email', () => signInWithEmail(email))}
        accessibilityLabel={t('account.emailLabel')}
      />
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.accent }, busy !== null && styles.disabled]}
        onPress={() => run('email', () => signInWithEmail(email))}
        disabled={busy !== null}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy !== null, busy: busy === 'email' }}
      >
        {busy === 'email' && <ActivityIndicator size="small" color="#FFFFFF" />}
        <Text style={[styles.btnText, styles.primaryText]}>{t('account.sendLink')}</Text>
      </TouchableOpacity>

      {message !== null && (
        <SelectableText style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {message}
        </SelectableText>
      )}
      {privacy}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 10 },
  appleBtn: { height: BUTTON_HEIGHT, alignSelf: 'stretch' },
  btn: {
    flexDirection: 'row',
    gap: 10,
    minHeight: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  outlineBtn: { borderWidth: 1 },
  btnText: { flexShrink: 1, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  primaryText: { color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS, paddingHorizontal: 16, fontSize: 16 },
  error: { color: '#FF3B30', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  privacy: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingHorizontal: 8, marginTop: 4 },
  privacyText: { flexShrink: 1, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  sent: { alignItems: 'center', gap: 6, borderRadius: 16, padding: 20 },
  sentTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  sentText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  plainBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  plainText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
