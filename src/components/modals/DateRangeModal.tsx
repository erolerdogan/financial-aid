import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

interface DateRangeModalProps {
  visible: boolean;
  minDate: string | null;
  maxDate: string | null;
  initialFrom: string | null;
  initialTo: string | null;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatKey = (key: string): string =>
  parseKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const monthKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function DateRangeModal({
  visible,
  minDate,
  maxDate,
  initialFrom,
  initialTo,
  onApply,
  onClose,
}: DateRangeModalProps) {
  const { colors } = useTheme();

  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Date>(new Date());

  useEffect(() => {
    if (!visible) return;
    setStart(initialFrom);
    setEnd(initialTo);
    const anchor = initialFrom ?? maxDate ?? toKey(new Date());
    const parsed = parseKey(anchor);
    setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [visible, initialFrom, initialTo, maxDate]);

  const cells = useMemo<(string | null)[]>(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: (string | null)[] = Array(offset).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      result.push(toKey(new Date(year, month, day)));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [cursor]);

  const cursorMonthKey = monthKeyOf(cursor);
  const canGoPrev = !minDate || cursorMonthKey > minDate.slice(0, 7);
  const canGoNext = !maxDate || cursorMonthKey < maxDate.slice(0, 7);

  const shiftCursor = (direction: 1 | -1) => {
    if (direction === -1 && !canGoPrev) return;
    if (direction === 1 && !canGoNext) return;
    Haptics.selectionAsync().catch(() => {});
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
  };

  const isDisabledDay = (key: string): boolean =>
    (!!minDate && key < minDate) || (!!maxDate && key > maxDate);

  const handleDayPress = (key: string) => {
    if (isDisabledDay(key)) return;
    Haptics.selectionAsync().catch(() => {});

    if (!start || (start && end)) {
      setStart(key);
      setEnd(null);
    } else if (key < start) {
      setStart(key);
    } else {
      setEnd(key);
    }
  };

  const clamp = (key: string): string => {
    if (minDate && key < minDate) return minDate;
    if (maxDate && key > maxDate) return maxDate;
    return key;
  };

  const applyPreset = (from: Date, to: Date) => {
    Haptics.selectionAsync().catch(() => {});
    const fromKey = clamp(toKey(from));
    const toKeyVal = clamp(toKey(to));
    setStart(fromKey <= toKeyVal ? fromKey : toKeyVal);
    setEnd(toKeyVal);
    const target = parseKey(toKeyVal);
    setCursor(new Date(target.getFullYear(), target.getMonth(), 1));
  };

  const presets = [
    {
      label: 'Last 7 days',
      run: () => {
        const today = new Date();
        applyPreset(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6), today);
      },
    },
    {
      label: 'Last 30 days',
      run: () => {
        const today = new Date();
        applyPreset(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29), today);
      },
    },
    {
      label: 'Year to date',
      run: () => {
        const today = new Date();
        applyPreset(new Date(today.getFullYear(), 0, 1), today);
      },
    },
  ];

  const handleApply = () => {
    if (!start) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onApply(start, end ?? start);
  };

  const summaryText = !start
    ? 'Select a start date'
    : !end
    ? `${formatKey(start)} – select an end date`
    : `${formatKey(start)} – ${formatKey(end)}`;

  const monthTitle = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const chipBg = colors.surface;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.header}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <Text style={[styles.title, { color: colors.text }]}>Custom Range</Text>
              <Text style={[styles.summary, { color: start ? colors.accent : colors.textSecondary }]}>
                {summaryText}
              </Text>
            </View>

            <View style={styles.presetRow}>
              {presets.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  activeOpacity={0.7}
                  style={[styles.presetChip, { backgroundColor: chipBg }]}
                  onPress={preset.run}
                >
                  <Text style={[styles.presetText, { color: colors.text }]}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.monthNav}>
              <TouchableOpacity
                onPress={() => shiftCursor(-1)}
                disabled={!canGoPrev}
                hitSlop={10}
                style={[styles.navBtn, { backgroundColor: chipBg }, !canGoPrev && styles.navBtnDisabled]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.accent} />
              </TouchableOpacity>
              <Text style={[styles.monthTitle, { color: colors.text }]}>{monthTitle}</Text>
              <TouchableOpacity
                onPress={() => shiftCursor(1)}
                disabled={!canGoNext}
                hitSlop={10}
                style={[styles.navBtn, { backgroundColor: chipBg }, !canGoNext && styles.navBtnDisabled]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={[styles.weekday, { color: colors.textSecondary }]}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((key, index) => {
                if (!key) return <View key={`empty-${index}`} style={styles.cell} />;

                const disabled = isDisabledDay(key);
                const isEdge = key === start || key === end;
                const inRange = !!start && !!end && key > start && key < end;
                const dayNumber = Number(key.slice(8));

                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.7}
                    disabled={disabled}
                    onPress={() => handleDayPress(key)}
                    style={[
                      styles.cell,
                      inRange && { backgroundColor: colors.tintBackground },
                      disabled && styles.cellDisabled,
                    ]}
                  >
                    <View style={[styles.dayCircle, isEdge && { backgroundColor: colors.accent }]}>
                      <Text
                        style={[
                          styles.dayText,
                          { color: colors.text },
                          isEdge && styles.dayTextEdge,
                        ]}
                      >
                        {dayNumber}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.footerBtn, { backgroundColor: chipBg }]}
                onPress={onClose}
              >
                <Text style={[styles.footerBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={!start}
                style={[
                  styles.footerBtn,
                  { backgroundColor: colors.accent },
                  !start && styles.footerBtnDisabled,
                ]}
                onPress={handleApply}
              >
                <Text style={[styles.footerBtnText, { color: '#FFFFFF' }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  header: { alignItems: 'center', marginBottom: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  summary: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  presetText: { fontSize: 12, fontWeight: '600' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.35 },
  monthTitle: { fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDisabled: { opacity: 0.25 },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15, fontWeight: '500' },
  dayTextEdge: { color: '#FFFFFF', fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 12, marginTop: 16 },
  footerBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footerBtnDisabled: { opacity: 0.4 },
  footerBtnText: { fontSize: 16, fontWeight: '700' },
});