import { useProfile } from '@/contexts/ProfileContext';
import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import DashboardScreen from './(tabs)/index';

export default function Index() {
  const { loadingProfiles, hasData } = useProfile();

  // 1. Show a clean loading indicator while initial SQLite initialization runs
  if (loadingProfiles) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // 2. Fresh installation or empty database -> Redirect to Welcome screen
  if (!hasData) {
    return <Redirect href="/welcome" />;
  }

  // 3. Returning user with existing data -> Render main tab dashboard
  return <DashboardScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});