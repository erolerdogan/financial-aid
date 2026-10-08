import { PasscodeChallenge } from '@/components/passcode/PasscodeChallenge';
import { PasscodePad } from '@/components/passcode/PasscodePad';
import { useI18n } from '@/contexts/LanguageContext';
import { usePasscode } from '@/contexts/PasscodeContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PASSCODE_LENGTH } from '@/utils/passcode';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** `set`: no passcode yet. `change` and `remove` ask for the current one first. */
export type PasscodeModalMode = 'set' | 'change' | 'remove';

type Step = 'current' | 'new' | 'confirm';

interface PasscodeModalProps {
  visible: boolean;
  mode: PasscodeModalMode;
  onClose: () => void;
}

const firstStep = (mode: PasscodeModalMode): Step => (mode === 'set' ? 'new' : 'current');

export function PasscodeModal({ visible, mode, onClose }: PasscodeModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.cancel, { color: colors.accent }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
        {/* Remounts on every opening, so each one starts at its first step with nothing typed. */}
        {visible && <PasscodeFlow key={mode} mode={mode} onClose={onClose} />}
      </View>
    </Modal>
  );
}

function PasscodeFlow({ mode, onClose }: { mode: PasscodeModalMode; onClose: () => void }) {
  const { t } = useI18n();
  const { setPasscode, removePasscode } = usePasscode();

  const [step, setStep] = useState<Step>(firstStep(mode));
  const [code, setCode] = useState('');
  const [firstEntry, setFirstEntry] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCurrentConfirmed = () => {
    if (mode !== 'remove') {
      setStep('new');
      return;
    }
    try {
      removePasscode();
      onClose();
    } catch (error) {
      console.error('Passcode remove error:', error);
      Alert.alert(t('common.error'), t('passcode.saveFailed'));
    }
  };

  const handleChangeCode = async (next: string) => {
    setCode(next);
    if (next.length < PASSCODE_LENGTH) return;

    if (step === 'new') {
      setFirstEntry(next);
      setMismatch(false);
      setCode('');
      setStep('confirm');
      return;
    }

    if (next !== firstEntry) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMismatch(true);
      setFirstEntry('');
      setCode('');
      setStep('new');
      return;
    }

    setSaving(true);
    try {
      await setPasscode(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      console.error('Passcode save error:', error);
      setSaving(false);
      setFirstEntry('');
      setCode('');
      setStep('new');
      Alert.alert(t('common.error'), t('passcode.saveFailed'));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} bounces={false}>
      {step === 'current' ? (
        <PasscodeChallenge title={t('passcode.currentTitle')} onSuccess={handleCurrentConfirmed} />
      ) : (
        <PasscodePad
          title={t(step === 'new' ? 'passcode.newTitle' : 'passcode.confirmTitle')}
          message={mismatch && step === 'new' ? t('passcode.mismatch') : t('passcode.hint')}
          messageIsError={mismatch && step === 'new'}
          code={code}
          onChangeCode={handleChangeCode}
          disabled={saving}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  cancel: { fontSize: 16, fontWeight: '600' },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
});
