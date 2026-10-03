import { ImportResultProvider } from '@/contexts/ImportResultContext';
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { initDatabase } from '@/db/database';
import { requestAndScheduleImportReminders } from '@/utils/notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { Suspense, useEffect, useRef, useState } from 'react';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore error if called multiple times in fast-refresh */
});

function AppInitializer() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { loadingProfiles, hasData } = useProfile();
  const [isReady, setIsReady] = useState(false);
  const routedRef = useRef(false);

  useEffect(() => {
    if (!db) return;
    requestAndScheduleImportReminders().catch((err) =>
      console.warn('Background notifications schedule warning:', err)
    );
  }, [db]);

  useEffect(() => {
    if (loadingProfiles || routedRef.current) return;
    routedRef.current = true;

    if (!hasData) {
      router.replace('/welcome');
    }
    setIsReady(true);
  }, [loadingProfiles, hasData, router]);

  useEffect(() => {
    if (!isReady) return;
    const frame = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [isReady]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
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
      <Stack.Screen
        name="categories"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="review"
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
    <Suspense fallback={null}>
      <SQLiteProvider databaseName="financial_aid.db" onInit={initDatabase} useSuspense>
        <ThemeProvider>
          <ProfileProvider>
            <ImportResultProvider>
              <AppInitializer />
            </ImportResultProvider>
          </ProfileProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </Suspense>
  );
}