import { ProfileProvider } from '@/contexts/ProfileContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { initDatabase } from '@/db/database';
import { requestAndScheduleImportReminders } from '@/utils/notifications';
import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

function AppInitializer() {
  const db = useSQLiteContext();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      if (db) {
        try {
          // 1. Create tables
          await initDatabase(db);
          
          // 2. Schedule 3x/month import notifications (1st, 15th, 28th)
          await requestAndScheduleImportReminders();
        } catch (error) {
          console.error('Initialization failed:', error);
        } finally {
          setIsReady(true);
        }
      }
    }
    init();
  }, [db]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="goals"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="financial_aid.db" onInit={initDatabase}>
      <ThemeProvider>
        <ProfileProvider>
          <AppInitializer />
        </ProfileProvider>
      </ThemeProvider>
    </SQLiteProvider>
  );
}