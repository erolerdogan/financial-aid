import { PasscodeChallenge } from '@/components/passcode/PasscodeChallenge';
import { useI18n } from '@/contexts/LanguageContext';
import { usePasscode } from '@/contexts/PasscodeContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { BackHandler, Modal, Platform, StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

const noop = () => {};

// The lock has to sit above modal routes and open sheets, not only above the Stack. On iOS a second
// Modal cannot present while one is up, so the lock is a window-level overlay there; on Android a
// Modal is a dialog and a later one stacks on top.
function AboveEverything({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return <FullWindowOverlay unstable_accessibilityContainerViewIsModal>{children}</FullWindowOverlay>;
  }
  return (
    <Modal visible animationType="none" statusBarTranslucent onRequestClose={() => BackHandler.exitApp()}>
      {children}
    </Modal>
  );
}

/**
 * The passcode screen while the app is locked, and a blank cover while it is not in front.
 * Mounted once at the root, next to the Stack.
 */
export function PasscodeLockHost() {
  const { enabled, locked, covered } = usePasscode();
  const { colors } = useTheme();
  const { t } = useI18n();

  if (!enabled || (!locked && !covered)) return null;

  return (
    <AboveEverything>
      <View style={[styles.screen, { backgroundColor: colors.background }]} accessibilityViewIsModal>
        {locked ? (
          <PasscodeChallenge title={t('passcode.enterTitle')} onSuccess={noop} />
        ) : (
          <View style={[styles.coverIcon, { backgroundColor: colors.tintBackground }]}>
            <Ionicons name="lock-closed" size={24} color={colors.accent} />
          </View>
        )}
      </View>
    </AboveEverything>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  coverIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
});
