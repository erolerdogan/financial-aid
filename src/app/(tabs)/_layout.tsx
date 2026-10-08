import { ImportSummaryHost } from '@/contexts/ImportResultContext';
import { InboxHost, InboxProvider } from '@/contexts/InboxContext';
import { useI18n } from '@/contexts/LanguageContext';
import { TabSwipeProvider } from '@/contexts/TabSwipeContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Easing, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const bottomInset = Math.max(insets.bottom, 0);
  const baseTabBarHeight = 50;
  const tabBarHeight =
    Platform.OS === 'ios'
      ? baseTabBarHeight + bottomInset
      : 56 + bottomInset;

  return (
    <InboxProvider>
    <TabSwipeProvider>
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: false,
        // Pages slide a full width side by side; the stock 'shift' fades both screens out and shows the backdrop.
        animation: 'shift',
        transitionSpec: { animation: 'timing', config: { duration: 300, easing: Easing.out(Easing.cubic) } },
        sceneStyleInterpolator: ({ current }) => ({
          sceneStyle: {
            transform: [
              {
                translateX: current.progress.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [-width, 0, width],
                }),
              },
            ],
          },
        }),
        tabBarHideOnKeyboard: Platform.OS === 'android',
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          display: 'flex',
          backgroundColor: colors.card,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? bottomInset : bottomInset + 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="trends"
        options={{
          title: t('tabs.trends'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: t('tabs.plan'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'trending-up' : 'trending-up-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
    </TabSwipeProvider>
    <ImportSummaryHost />
    <InboxHost />
    </InboxProvider>
  );
}