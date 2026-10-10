import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  clampMonth,
  isMonthDisabled,
  isYearDisabled,
  monthKey,
  monthTouchesRange,
  yearOptions,
  yearTouchesRange,
} from '@/utils/calendarNav';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

interface DateRangeModalProps {
  visible: boolean;
  minDate: string | null;
  maxDate: string | null;
  initialFrom: string | null;
  initialTo: string | null;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
  /** Picks one day instead of a range: a tap selects it, and `onApply` gets it as both ends. */
  single?: boolean;
}

const toKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const monthKeyOf = (d: Date): string => monthKey(d.getFullYear(), d.getMonth());

/** The sheet zooms out from days to the months of a year, then to the list of years. */
type CalendarView = 'days' | 'months' | 'years';

export function DateRangeModal({
  visible,
  minDate,
  maxDate,
  initialFrom,
  initialTo,
  onApply,
  onClose,
  single = false,
}: DateRangeModalProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const formatKey = format.day;
  // 1 January 2024 is a Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) => format.date(new Date(2024, 0, 1 + i), { weekday: 'short' }));

  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarView>('days');

  // Opening the calendar, or a new range while it is open, starts it from that range.
  const [shown, setShown] = useState({ visible: false, initialFrom, initialTo, maxDate });
  if (
    shown.visible !== visible ||
    shown.initialFrom !== initialFrom ||
    shown.initialTo !== initialTo ||
    shown.maxDate !== maxDate
  ) {
    setShown({ visible, initialFrom, initialTo, maxDate });
    if (visible) {
      setView('days');
      setStart(initialFrom);
      setEnd(initialTo);
      const anchor = initialFrom ?? maxDate ?? toKey(new Date());
      const parsed = parseKey(anchor);
      setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  }

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
  const cursorYear = cursor.getFullYear();
  const years = useMemo(() => yearOptions(minDate, maxDate, new Date()), [minDate, maxDate]);

  // The arrows step one month on the day grid and one year on the month grid.
  const canGoPrev =
    view === 'days'
      ? !minDate || cursorMonthKey > minDate.slice(0, 7)
      : !isYearDisabled(cursorYear - 1, minDate, maxDate) && cursorYear > years[0];
  const canGoNext =
    view === 'days'
      ? !maxDate || cursorMonthKey < maxDate.slice(0, 7)
      : !isYearDisabled(cursorYear + 1, minDate, maxDate) && cursorYear < years[years.length - 1];

  const moveCursor = (year: number, monthIndex: number) => {
    setCursor(parseKey(`${clampMonth(year, monthIndex, minDate, maxDate)}-01`));
  };

  const shiftCursor = (direction: 1 | -1) => {
    if (direction === -1 && !canGoPrev) return;
    if (direction === 1 && !canGoNext) return;
    Haptics.selectionAsync().catch(() => {});
    if (view === 'days') {
      setCursor(new Date(cursorYear, cursor.getMonth() + direction, 1));
    } else {
      moveCursor(cursorYear + direction, cursor.getMonth());
    }
  };

  const handleTitlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'months');
  };

  const handleMonthPress = (monthIndex: number) => {
    Haptics.selectionAsync().catch(() => {});
    moveCursor(cursorYear, monthIndex);
    setView('days');
  };

  const handleYearPress = (year: number) => {
    Haptics.selectionAsync().catch(() => {});
    moveCursor(year, cursor.getMonth());
    setView('months');
  };

  const isDisabledDay = (key: string): boolean =>
    (!!minDate && key < minDate) || (!!maxDate && key > maxDate);

  const handleDayPress = (key: string) => {
    if (isDisabledDay(key)) return;
    Haptics.selectionAsync().catch(() => {});

    if (single) {
      setStart(key);
      setEnd(key);
    } else if (!start || (start && end)) {
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
    setView('days');
  };

  const presets = [
    {
      label: t('range.last7'),
      run: () => {
        const today = new Date();
        applyPreset(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6), today);
      },
    },
    {
      label: t('range.last30'),
      run: () => {
        const today = new Date();
        applyPreset(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29), today);
      },
    },
    {
      label: t('range.ytd'),
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
    ? t('range.selectStart')
    : single
    ? formatKey(start)
    : !end
    ? t('range.selectEnd', { start: formatKey(start) })
    : `${formatKey(start)} – ${formatKey(end)}`;

  const yearLabel = (year: number): string => format.date(new Date(year, 0, 1), { year: 'numeric' });
  const navTitle = view === 'days' ? format.date(cursor, { month: 'long', year: 'numeric' }) : yearLabel(cursorYear);
  const showArrows = view !== 'years';
  const chipBg = colors.surface;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} accessible={false} onPress={onClose}>
        <TouchableWithoutFeedback accessible={false}>
          <View
            style={[styles.sheet, { backgroundColor: colors.card }]}
            onAccessibilityEscape={onClose}
          >
            <View style={styles.header}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <SelectableText style={[styles.title, { color: colors.text }]}>{t(single ? 'manual.date' : 'range.title')}</SelectableText>
              <SelectableText style={[styles.summary, { color: start ? colors.accent : colors.textSecondary }]}>
                {summaryText}
              </SelectableText>
            </View>

            {!single && <View style={styles.presetRow}>
              {presets.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  activeOpacity={0.7}
                  style={[styles.presetChip, { backgroundColor: chipBg }]}
                  onPress={preset.run}
                  accessibilityRole="button"
                >
                  <Text style={[styles.presetText, { color: colors.text }]}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>}

            <View style={styles.monthNav}>
              <TouchableOpacity
                onPress={() => shiftCursor(-1)}
                disabled={!showArrows || !canGoPrev}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.previous')}
                accessibilityState={{ disabled: !showArrows || !canGoPrev }}
                accessibilityElementsHidden={!showArrows}
                importantForAccessibility={showArrows ? 'auto' : 'no-hide-descendants'}
                hitSlop={10}
                style={[
                  styles.navBtn,
                  { backgroundColor: chipBg },
                  !canGoPrev && styles.navBtnDisabled,
                  !showArrows && styles.navBtnHidden,
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                hitSlop={10}
                style={styles.titleBtn}
                onPress={handleTitlePress}
              >
                <Text style={[styles.monthTitle, { color: colors.text }]}>{navTitle}</Text>
                <Ionicons name={view === 'years' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => shiftCursor(1)}
                disabled={!showArrows || !canGoNext}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.next')}
                accessibilityState={{ disabled: !showArrows || !canGoNext }}
                accessibilityElementsHidden={!showArrows}
                importantForAccessibility={showArrows ? 'auto' : 'no-hide-descendants'}
                hitSlop={10}
                style={[
                  styles.navBtn,
                  { backgroundColor: chipBg },
                  !canGoNext && styles.navBtnDisabled,
                  !showArrows && styles.navBtnHidden,
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              {view === 'days' && (
                <>
                <View style={styles.weekRow}>
                  {weekdays.map((day) => (
                    <SelectableText key={day} style={[styles.weekday, { color: colors.textSecondary }]}>
                      {day}
                    </SelectableText>
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
                        accessibilityRole="button"
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
                </>
              )}

              {view === 'months' && (
                <View style={styles.wideGrid}>
                  {Array.from({ length: 12 }, (_, monthIndex) => {
                    const key = monthKey(cursorYear, monthIndex);
                    const disabled = isMonthDisabled(key, minDate, maxDate);
                    const isCurrent = key === cursorMonthKey;
                    const inSelection = monthTouchesRange(key, start, end);

                    return (
                      <TouchableOpacity
                        key={key}
                        accessibilityRole="button"
                        activeOpacity={0.7}
                        disabled={disabled}
                        onPress={() => handleMonthPress(monthIndex)}
                        style={[styles.wideCell, styles.monthCell, disabled && styles.cellDisabled]}
                      >
                        <View
                          style={[
                            styles.pill,
                            inSelection && { backgroundColor: colors.tintBackground },
                            isCurrent && { backgroundColor: colors.accent },
                          ]}
                        >
                          <Text style={[styles.pillText, { color: colors.text }, isCurrent && styles.dayTextEdge]}>
                            {format.shortMonth(monthIndex)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {view === 'years' && (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wideGrid}>
                  {years.map((year) => {
                    const disabled = isYearDisabled(year, minDate, maxDate);
                    const isCurrent = year === cursorYear;
                    const inSelection = yearTouchesRange(year, start, end);

                    return (
                      <TouchableOpacity
                        key={year}
                        accessibilityRole="button"
                        activeOpacity={0.7}
                        disabled={disabled}
                        onPress={() => handleYearPress(year)}
                        style={[styles.wideCell, styles.yearCell, disabled && styles.cellDisabled]}
                      >
                        <View
                          style={[
                            styles.pill,
                            inSelection && { backgroundColor: colors.tintBackground },
                            isCurrent && { backgroundColor: colors.accent },
                          ]}
                        >
                          <Text style={[styles.pillText, { color: colors.text }, isCurrent && styles.dayTextEdge]}>
                            {yearLabel(year)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.footerBtn, { backgroundColor: chipBg }]}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={[styles.footerBtnText, { color: colors.text }]}>{t('common.cancel')}</Text>
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
                accessibilityRole="button"
              >
                <Text style={[styles.footerBtnText, { color: '#FFFFFF' }]}>{t('common.apply')}</Text>
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
  navBtnHidden: { opacity: 0 },
  titleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthTitle: { fontSize: 16, fontWeight: '700' },
  // Weekday row plus six day rows, so the sheet keeps its height on every level.
  body: { height: 272 },
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
  wideGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  wideCell: { width: `${100 / 3}%`, alignItems: 'center', justifyContent: 'center' },
  monthCell: { height: 68 },
  yearCell: { height: 56 },
  pill: { minWidth: 76, height: 38, borderRadius: 19, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 12, marginTop: 16 },
  footerBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footerBtnDisabled: { opacity: 0.4 },
  footerBtnText: { fontSize: 16, fontWeight: '700' },
});