import { DemoBanner } from '@/components/DemoBanner';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    View,
    ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  showDemoBanner?: boolean;
}

export function ScreenContainer({ children, style, showDemoBanner = true }: ScreenContainerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top, // Strictly handle top inset only
        },
        style,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.flexOne}
      >
        <View style={[styles.flexOne, { backgroundColor: colors.background }]}>
          {showDemoBanner && <DemoBanner />}
          {children}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flexOne: { flex: 1 },
});