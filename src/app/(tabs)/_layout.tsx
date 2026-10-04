import { ImportSummaryHost } from '@/contexts/ImportResultContext';
import { InboxHost, InboxProvider } from '@/contexts/InboxContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const bottomInset = Math.max(insets.bottom, 0);
  const baseTabBarHeight = 50;
  const tabBarHeight =
    Platform.OS === 'ios'
      ? baseTabBarHeight + bottomInset
      : 56 + bottomInset;

  return (
    <InboxProvider>
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: false,
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
          title: 'Home',
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
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'receipt' : 'receipt-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Trends',
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
          title: 'Plan',
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
    <ImportSummaryHost />
    <InboxHost />
    </InboxProvider>
  );
}