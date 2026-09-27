import { DemoBanner } from '@/components/DemoBanner';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { colors } = useTheme();
  const { isDemoMode } = useProfile();
  const insets = useSafeAreaInsets();

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: colors.background,
          // Only add safe area top padding when the demo banner is active
          paddingTop: isDemoMode ? insets.top : 0 
        }
      ]}
    >
      {/* Global Demo Banner rendered once for all tab screens */}
      <DemoBanner />

      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopWidth: 0.5,
            borderTopColor: colors.border,
            elevation: 0,
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
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
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
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});