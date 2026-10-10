import { AppTabBar } from '@/components/navigation/AppTabBar';
import { ReadOnlySheetHost } from '@/components/pro/ReadOnlySheet';
import { ImportSummaryHost } from '@/contexts/ImportResultContext';
import { InboxHost, InboxProvider } from '@/contexts/InboxContext';
import { useI18n } from '@/contexts/LanguageContext';
import { TabSwipeProvider } from '@/contexts/TabSwipeContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Easing, useWindowDimensions } from 'react-native';

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();

  return (
    <InboxProvider>
    <TabSwipeProvider>
    <Tabs
      initialRouteName="index"
      // Home, Trends, [+], Plan, You: the bar draws the add button between the routes.
      tabBar={(props) => <AppTabBar {...props} />}
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
        sceneStyle: { backgroundColor: colors.background },
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
      <Tabs.Screen
        name="you"
        options={{
          title: t('tabs.you'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
    </TabSwipeProvider>
    <ImportSummaryHost />
    <ReadOnlySheetHost />
    <InboxHost />
    </InboxProvider>
  );
}