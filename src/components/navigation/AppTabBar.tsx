import { AddActionSheet, type AddAction } from '@/components/navigation/AddActionSheet';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Routes drawn left of the add button; the rest go to its right.
const TABS_BEFORE_ADD = 2;
const ADD_SIZE = 52;
const ADD_RAISE = 14;
// A sheet has to be gone before a screen or the file picker can present.
const SHEET_CLOSE_MS = 300;

/**
 * The tab bar: Home, Trends, [+], Plan, You. The center button is not a route (so the tab swipe
 * never stops on it); it opens the add sheet.
 */
export function AppTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { guardWrite } = useProfileAccess();
  const { importStatement } = useStatementImporter();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Android resizes the window for the keyboard, which would lift the bar on top of it.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handlePick = (action: AddAction) => {
    setSheetVisible(false);
    setTimeout(() => {
      if (action === 'import') {
        importStatement();
        return;
      }
      // A profile beyond the free limit takes no new transactions.
      guardWrite(() => router.push({ pathname: '/add-transaction', params: { type: action } }));
    }, SHEET_CLOSE_MS);
  };

  if (keyboardVisible) return null;

  const bottomInset = Math.max(insets.bottom, 0);

  const tabs = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const color = focused ? colors.accent : colors.textSecondary;
    const label = options.title ?? route.name;

    const handlePress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };

    return (
      <TouchableOpacity
        key={route.key}
        style={styles.tab}
        activeOpacity={0.7}
        onPress={handlePress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
      >
        {options.tabBarIcon?.({ focused, color, size: 22 })}
        <Text style={[styles.label, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  });

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: (Platform.OS === 'ios' ? 50 : 56) + bottomInset,
          paddingBottom: Platform.OS === 'ios' ? bottomInset : bottomInset + 8,
        },
      ]}
      accessibilityRole="tablist"
    >
      {tabs.slice(0, TABS_BEFORE_ADD)}

      <View style={styles.tab}>
        <TouchableOpacity
          style={[styles.addShadow, { shadowColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setSheetVisible(true);
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('add.open')}
        >
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.addButton, { borderColor: colors.card }]}
          >
            <Ionicons name="add" size={30} color={colors.onGradient} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {tabs.slice(TABS_BEFORE_ADD)}

      <AddActionSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} onPick={handlePick} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
  },
  label: { fontSize: 11, fontWeight: '600' },
  addShadow: {
    marginTop: -ADD_RAISE,
    borderRadius: ADD_SIZE / 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButton: {
    width: ADD_SIZE,
    height: ADD_SIZE,
    borderRadius: ADD_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
});
