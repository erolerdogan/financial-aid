import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    View,
    ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ScreenContainer({ children, style }: ScreenContainerProps) {
  const { colors } = useTheme();
  const { isDemoMode } = useProfile();

  const ContainerWrapper = isDemoMode ? View : SafeAreaView;
  const containerProps = isDemoMode ? {} : { edges: ['top', 'bottom'] as const };

  return (
    <ContainerWrapper style={[styles.safeArea, { backgroundColor: colors.background }, style]} {...containerProps}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </ContainerWrapper>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});