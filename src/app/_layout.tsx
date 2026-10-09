import { PasscodeLockHost } from '@/components/passcode/PasscodeLockHost';
import { PdfTextHost } from '@/components/PdfTextHost';
import { SharedImportHost } from '@/components/SharedImportHost';
import { EntitlementProvider } from '@/contexts/EntitlementContext';
import { ImportResultProvider } from '@/contexts/ImportResultContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PasscodeProvider } from '@/contexts/PasscodeContext';
import { PeriodProvider } from '@/contexts/PeriodContext';
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { initDatabase } from '@/db/database';
import { requestAndScheduleImportReminders } from '@/utils/notifications';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { Suspense, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Welcome normally shows within a frame; the cover never stays longer than this.
const ROUTE_TIMEOUT_MS = 1000;

SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore error if called multiple times in fast-refresh */
});

function AppInitializer() {
  const db = useSQLiteContext();
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const { loadingProfiles, hasData, isDemoMode } = useProfile();
  // Decided once per launch: 'welcome' lasts from the redirect until that screen is the one on top.
  const [launch, setLaunch] = useState<'pending' | 'welcome' | 'ready'>('pending');
  if (launch === 'pending' && !loadingProfiles) setLaunch(hasData ? 'ready' : 'welcome');
  if (launch === 'welcome' && pathname === '/welcome') setLaunch('ready');
  const isReady = launch === 'ready';

  useEffect(() => {
    // Not in the demo workspace: nothing can be imported there.
    if (!db || loadingProfiles || isDemoMode) return;
    requestAndScheduleImportReminders().catch((err) =>
      console.warn('Background notifications schedule warning:', err)
    );
  }, [db, loadingProfiles, isDemoMode]);

  useEffect(() => {
    if (launch !== 'welcome') return;
    // Home is mounted underneath and would show its empty state until Welcome is on top.
    router.replace('/welcome');
    const timer = setTimeout(() => setLaunch('ready'), ROUTE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [launch, router]);

  useEffect(() => {
    if (!isReady) return;
    const frame = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [isReady]);

  return (
    <>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="welcome"
        options={{
          headerShown: false,
          gestureEnabled: false,
          // The launch redirect swaps in place; later visits (Reset, Exit Demo) animate.
          animation: isReady ? 'default' : 'none',
        }}
      />
      <Stack.Screen name="transactions" options={{ headerShown: false }} />
      <Stack.Screen name="debt-plan" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="export-guide"
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
      <Stack.Screen
        name="health-report"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="data-privacy"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="legal"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="faq"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="paywall"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="licenses"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack>
    {/* A reload has no splash screen: hide Home until the first route is decided. */}
    {!isReady && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />}
    <SharedImportHost />
    <PdfTextHost />
    <PasscodeLockHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <Suspense fallback={null}>
        <SQLiteProvider databaseName="financial_aid.db" onInit={initDatabase} useSuspense>
          <LanguageProvider>
            <ThemeProvider>
              <PasscodeProvider>
                <ProfileProvider>
                  <EntitlementProvider>
                    <PeriodProvider>
                      <ImportResultProvider>
                        <AppInitializer />
                      </ImportResultProvider>
                    </PeriodProvider>
                  </EntitlementProvider>
                </ProfileProvider>
              </PasscodeProvider>
            </ThemeProvider>
          </LanguageProvider>
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
