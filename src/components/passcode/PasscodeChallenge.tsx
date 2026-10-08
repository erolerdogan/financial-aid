import { PasscodePad } from '@/components/passcode/PasscodePad';
import { useI18n } from '@/contexts/LanguageContext';
import { usePasscode } from '@/contexts/PasscodeContext';
import { PASSCODE_LENGTH } from '@/utils/passcode';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';

interface PasscodeChallengeProps {
  title: string;
  onSuccess: () => void;
}

/** Asks for the current passcode: wrong tries, the wait after too many of them, and the countdown. */
export function PasscodeChallenge({ title, onSuccess }: PasscodeChallengeProps) {
  const { t } = useI18n();
  const { attempt, waitSeconds } = usePasscode();

  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [wait, setWait] = useState(waitSeconds);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(waitSeconds()), 1000);
    return () => clearTimeout(timer);
  }, [wait, waitSeconds]);

  const handleChangeCode = async (next: string) => {
    setCode(next);
    if (next.length < PASSCODE_LENGTH) return;

    setChecking(true);
    const result = await attempt(next);
    setChecking(false);
    setCode('');

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setWrong(true);
    setWait(result.waitSeconds);
  };

  const message =
    wait > 0 ? t('passcode.tryAgain', { count: Math.ceil(wait / 60) }) : wrong ? t('passcode.wrong') : null;

  return (
    <PasscodePad
      title={title}
      message={message}
      messageIsError
      code={code}
      onChangeCode={handleChangeCode}
      disabled={checking || wait > 0}
    />
  );
}
