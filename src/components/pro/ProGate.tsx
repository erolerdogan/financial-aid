import { ProBadge } from '@/components/pro/ProBadge';
import type { FeatureFlag, PaywallFeature } from '@/constants/features';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { usePaywall } from '@/hooks/usePaywall';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface ProGateProps {
  /** The flag that opens the children. */
  feature: FeatureFlag;
  /** Why the paywall opens from here. */
  paywall: PaywallFeature;
  /** What the gated area is, for VoiceOver. */
  label: string;
  /** For a short row: the badge sits in the corner instead of inside a card's padding. */
  compact?: boolean;
  children: React.ReactNode;
}

/**
 * Shows a Pro feature to everyone. With Pro the children are untouched; without it they are
 * dimmed under a "Pro" badge and one tap anywhere opens the paywall.
 */
export function ProGate({ feature, paywall, label, compact = false, children }: ProGateProps) {
  const { can, source } = useEntitlement();
  const { t } = useI18n();
  const { openPaywall } = usePaywall();

  if (can(feature)) {
    if (source !== 'free') return <>{children}</>;
    // The demo workspace: usable, and still marked as part of Pro.
    return (
      <View>
        {children}
        <View style={compact ? styles.badgeCompact : styles.badge} pointerEvents="none">
          <ProBadge />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => openPaywall(paywall)}
      accessibilityRole="button"
      accessibilityLabel={t('pro.gateA11y', { label })}
    >
      <View style={styles.dimmed} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {children}
      </View>
      <ProBadge locked style={compact ? styles.badgeCompact : styles.badge} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dimmed: { opacity: 0.45 },
  badge: { position: 'absolute', top: 12, right: 12 },
  badgeCompact: { position: 'absolute', top: 0, right: 0 },
});
