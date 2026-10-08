import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { InboxItem } from '@/services/inboxService';
import { getDebtTypeIcon } from '@/utils/debt';
import { alertText } from '@/utils/healthAlertText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';

/** Where the bell sits in the window; the panel grows out of it. */
export interface InboxAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SCREEN_MARGIN = 16;
const MAX_PANEL_WIDTH = 400;
const ANCHOR_GAP = 8;

interface InboxModalProps {
  visible: boolean;
  anchor: InboxAnchor | null;
  items: InboxItem[];
  onClose: () => void;
  onAction: (item: InboxItem) => void;
  onDismissItem: (item: InboxItem) => void;
}

interface RowContent {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  action: string;
  /** Lines the subtitle may take; alert sentences are longer than the other rows' hints. */
  subtitleLines?: number;
}

const dayOfMonth = (date: string) => String(parseInt(date.slice(8, 10), 10));

export function InboxModal({ visible, anchor, items, onClose, onAction, onDismissItem }: InboxModalProps) {
  const { colors, isDark } = useTheme();
  const { currencySymbol } = useProfile();
  const { t, format } = useI18n();

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // 0 = collapsed into the bell, 1 = open.
  const [progress] = useState(() => new Animated.Value(0));

  const handleDismiss = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => onClose());
  }, [progress, onClose]);

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 240, mass: 0.8 }).start();
  }, [visible, progress]);

  // Without a measured bell, fall back to the top right corner where the header puts it.
  const bell = anchor ?? { x: screenWidth - SCREEN_MARGIN - 80, y: 56, width: 34, height: 34 };
  const panelWidth = Math.min(screenWidth - SCREEN_MARGIN * 2, MAX_PANEL_WIDTH);
  const panelLeft = screenWidth - SCREEN_MARGIN - panelWidth;
  const panelTop = bell.y + bell.height + ANCHOR_GAP;
  const originX = Math.min(Math.max(bell.x + bell.width / 2 - panelLeft, 0), panelWidth);

  const describe = (item: InboxItem): RowContent => {
    switch (item.kind) {
      case 'HEALTH_ALERT':
        return {
          icon:
            item.alert.severity >= 3
              ? 'alert-circle-outline'
              : item.alert.severity === 2
                ? 'information-circle-outline'
                : 'happy-outline',
          title: t(`health.alertType.${item.alert.type}`),
          subtitle: alertText(item.alert.message, t, format, currencySymbol),
          action: t('common.view'),
          subtitleLines: 4,
        };
      case 'DEBT_SUGGESTIONS': {
        const [first, ...rest] = item.suggestions;
        if (rest.length === 0) {
          return {
            icon: getDebtTypeIcon(first.type),
            title: t('inbox.possibleDebt', { name: first.name }),
            subtitle: t('inbox.debtSub', {
              payment: format.money(first.payment, currencySymbol, { maximumFractionDigits: 0 }),
              count: first.count,
            }),
            action: t('common.add'),
          };
        }
        return {
          icon: 'trending-down-outline',
          title: t('inbox.possibleDebts', { count: item.suggestions.length }),
          subtitle:
            rest.length === 1
              ? t('inbox.twoNames', { first: first.name, second: rest[0].name })
              : t('inbox.moreNames', { first: first.name, second: rest[0].name, count: rest.length - 1 }),
          action: t('common.view'),
        };
      }
      case 'UNCATEGORISED':
        return {
          icon: 'pricetag-outline',
          title: t('transactions.uncategorised', { count: item.count }),
          subtitle: t('inbox.uncategorisedSub'),
          action: t('transactions.review'),
        };
      case 'DEBT_MATCHES':
        return {
          icon: 'link-outline',
          title: t('inbox.debtMatches', { count: item.count, name: item.debtName }),
          subtitle: t('inbox.debtMatchesSub'),
          action: t('inbox.check'),
        };
      case 'PARTIAL_MONTH':
        return {
          icon: 'download-outline',
          title: t('inbox.partialTitle', { month: format.monthYear(item.month, 'short') }),
          subtitle: t('inbox.partialSub', { from: dayOfMonth(item.minDate), to: dayOfMonth(item.maxDate) }),
          action: t('inbox.import'),
        };
      case 'BACKUP':
        return {
          icon: 'shield-checkmark-outline',
          title: item.daysSince === null ? t('inbox.noBackup') : t('inbox.lastBackup', { count: item.daysSince }),
          subtitle: t('inbox.backupSub'),
          action: t('inbox.backUp'),
        };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', opacity: progress }]} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.panel,
            {
              top: panelTop,
              left: panelLeft,
              width: panelWidth,
              maxHeight: screenHeight - panelTop - 48,
              backgroundColor: isDark ? colors.card : colors.background,
              borderColor: colors.border,
              opacity: progress,
              transformOrigin: [originX, 0, 0],
              transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('inbox.title')}</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
              {items.length === 0 ? t('inbox.nothing') : t('inbox.found')}
            </Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="checkmark" size={28} color={colors.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('review.doneTitle')}</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                {t('inbox.emptySub')}
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {items.map((item) => {
                const row = describe(item);
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.row, { backgroundColor: colors.surface }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      onAction(item);
                    }}
                    accessibilityLabel={`${row.title}. ${row.action}`}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: colors.tintBackground }]}>
                      <Ionicons name={row.icon} size={18} color={colors.accent} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                        {row.title}
                      </Text>
                      <Text
                        style={[styles.rowSubtitle, { color: colors.textSecondary }]}
                        numberOfLines={row.subtitleLines ?? 2}
                      >
                        {row.subtitle}
                      </Text>
                    </View>
                    <Text style={[styles.rowAction, { color: colors.accent }]}>{row.action}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        onDismissItem(item);
                      }}
                      hitSlop={10}
                      accessibilityLabel={t('inbox.dismissA11y', { title: row.title })}
                    >
                      <Ionicons name="close" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  panel: {
    position: 'absolute',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  headerRow: {
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12, marginTop: 2 },
  rowAction: { fontSize: 14, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
