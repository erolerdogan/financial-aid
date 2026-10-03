import { getCategoryColor } from '@/constants/colors';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FixedOverrideState, Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TransactionDetailModalProps {
  visible: boolean;
  transaction: Transaction | null;
  fixedState: FixedOverrideState;
  autoIsFixed?: boolean;
  autoReason?: string;
  parentTitle?: string;
  onClose: () => void;
  onDismiss?: () => void;
  onSelectFixedState: (newState: FixedOverrideState) => void;
}

export function TransactionDetailModal({
  visible,
  transaction,
  fixedState,
  autoIsFixed = false,
  autoReason,
  parentTitle = 'Back',
  onClose,
  onDismiss,
  onSelectFixedState,
}: TransactionDetailModalProps) {
  const handleDismissAction = onDismiss ?? onClose;
  const { colors, isDark } = useTheme();
  const { currencySymbol } = useProfile();

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const handleDismissAnimation = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleDismissAnimation(handleDismissAction);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 2,
            speed: 16,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_HEIGHT);
      overlayOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 3,
          speed: 14,
        }),
      ]).start();
    }
  }, [visible]);

  if (!transaction) return null;

  const isIncome = transaction.amount > 0;
  const isAuto = fixedState === 'AUTO';
  const effectiveState = isAuto ? (autoIsFixed ? 'FIXED' : 'FLEXIBLE') : fixedState;
  const formattedAmount = `${isIncome ? '+' : '-'}${currencySymbol}${Math.abs(transaction.amount).toFixed(2)}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => handleDismissAnimation(handleDismissAction)}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={() => handleDismissAnimation(handleDismissAction)}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(0,0,0,0.5)',
                opacity: overlayOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? colors.card : colors.background,
              borderColor: colors.border,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Swipe Drag Handle Area */}
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          </View>

          {/* Top Bar Navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => handleDismissAnimation(onClose)}>
              <Ionicons name="chevron-back" size={20} color={colors.accent} />
              <Text style={[styles.backBtnText, { color: colors.accent }]}>{parentTitle}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleDismissAnimation(handleDismissAction)}>
              <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Amount & Merchant Banner */}
          <View style={styles.merchantHeader}>
            <Text style={[styles.merchantName, { color: colors.text }]} numberOfLines={2}>
              {transaction.merchant !== 'Unknown' ? transaction.merchant : transaction.rawDescription}
            </Text>

            <Text style={[styles.amountText, { color: isIncome ? '#34C759' : colors.text }]}>
              {formattedAmount}
            </Text>

            <View style={styles.metaRow}>
              <View style={[styles.categoryPill, { backgroundColor: getCategoryColor(transaction.category) + '20' }]}>
                <View style={[styles.dot, { backgroundColor: getCategoryColor(transaction.category) }]} />
                <Text style={[styles.categoryText, { color: getCategoryColor(transaction.category) }]}>
                  {transaction.category}
                </Text>
              </View>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>{transaction.date}</Text>
            </View>
          </View>

          {/* Classification Selection */}
          <View style={[styles.sectionContainer, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>COST CLASSIFICATION</Text>

            <View style={styles.overrideOptionsRow}>
              <TouchableOpacity
                style={[
                  styles.overrideOption,
                  effectiveState === 'FIXED' && [styles.overrideOptionActive, { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }],
                ]}
                onPress={() => onSelectFixedState('FIXED')}
              >
                <Text style={[styles.optionText, { color: colors.textSecondary }, effectiveState === 'FIXED' && { color: '#5856D6', fontWeight: '700' }]}>
                  Fixed
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.overrideOption,
                  effectiveState === 'FLEXIBLE' && [styles.overrideOptionActive, { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }],
                ]}
                onPress={() => onSelectFixedState('FLEXIBLE')}
              >
                <Text style={[styles.optionText, { color: colors.textSecondary }, effectiveState === 'FLEXIBLE' && { color: '#FF9500', fontWeight: '700' }]}>
                  Flexible
                </Text>
              </TouchableOpacity>
            </View>

            {isAuto ? (
              <Text style={[styles.autoHint, { color: colors.textSecondary }]}>
                {autoReason ? `Detected automatically · ${autoReason}` : 'Detected automatically'}
              </Text>
            ) : (
              <TouchableOpacity onPress={() => onSelectFixedState('AUTO')} hitSlop={8}>
                <Text style={[styles.autoHint, { color: colors.textSecondary }]}>
                  Set by you · <Text style={{ color: colors.accent }}>Reset to automatic</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Raw Description Info */}
          <View style={styles.rawDescContainer}>
            <Text style={[styles.rawDescLabel, { color: colors.textSecondary }]}>RAW DESCRIPTION</Text>
            <Text style={[styles.rawDescValue, { color: colors.text }]}>{transaction.rawDescription}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  autoHint: {
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 34,
    borderWidth: StyleSheet.hairlineWidth,
  },
  handleContainer: {
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 2,
  },
  merchantHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  merchantName: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  amountText: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 12,
  },
  sectionContainer: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  overrideOptionsRow: {
    flexDirection: 'row',
    borderRadius: 10,
    gap: 4,
  },
  overrideOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  overrideOptionActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  rawDescContainer: {
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  rawDescLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rawDescValue: {
    fontSize: 13,
    lineHeight: 18,
  },
});