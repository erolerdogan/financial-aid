import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { usePathname, useRouter } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

// Imports a statement shared into the app ("Share → Financial Aid" in a bank app).
// Mounted once at the root, next to the Stack. The progress overlay is a plain View: a Modal
// here would still be up when the import summary sheet or an alert tries to present.
export function SharedImportHost() {
  // Expo Go has no share extension or app group, so there is nothing to listen for.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;

  return (
    <ShareUnavailableBoundary>
      <SharedImportListener />
    </ShareUnavailableBoundary>
  );
}

// `useIncomingShare` throws while rendering in a native build made before the share extension
// was added (no app group). The rest of the app has to keep working there, without share import.
class ShareUnavailableBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('Share import unavailable in this build:', error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function SharedImportListener() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { loadingProfiles } = useProfile();
  const { resolvedSharedPayloads, isResolving, error, clearSharedPayloads, refreshSharePayloads } =
    useIncomingShare();
  const pathnameRef = useRef(pathname);
  const handlingRef = useRef(false);

  const { importSharedFile, importing } = useStatementImporter({
    onSuccess: () => {
      // First launch through a share: leave the welcome screen so the summary sheet can show.
      if (pathnameRef.current === '/welcome') router.replace('/(tabs)');
    },
  });

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!error) return;
    clearSharedPayloads();
    refreshSharePayloads();
    Alert.alert(t('import.failedTitle'), t('import.failedMessage'));
  }, [error, clearSharedPayloads, refreshSharePayloads, t]);

  useEffect(() => {
    if (loadingProfiles || isResolving || handlingRef.current) return;
    if (resolvedSharedPayloads.length === 0) return;

    const file = resolvedSharedPayloads.find(
      (payload) => payload.contentType === 'file' && !!payload.contentUri
    );

    handlingRef.current = true;
    clearSharedPayloads();
    refreshSharePayloads();

    const run = async () => {
      try {
        if (!file?.contentUri) return;
        // Modal routes (Settings, Budgets, ...) have no summary host of their own to rely on here.
        if (router.canDismiss()) router.dismissAll();
        await importSharedFile(file.contentUri, file.originalName ?? '');
      } finally {
        handlingRef.current = false;
      }
    };
    run();
  }, [
    loadingProfiles,
    isResolving,
    resolvedSharedPayloads,
    clearSharedPayloads,
    refreshSharePayloads,
    importSharedFile,
    router,
  ]);

  if (!importing) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background + 'CC' }]}>
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.label, { color: colors.text }]}>{t('welcome.processing')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 15, fontWeight: '600' },
});
