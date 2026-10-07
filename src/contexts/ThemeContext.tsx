import { setAppMeta } from '@/db/database';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark';
export type ThemeName = 'aurora' | 'midnightGold' | 'sunset' | 'forestMint' | 'orchid' | 'classic';
/** How the spending allocation card on Home draws its categories. */
export type AllocationChartType = 'donut' | 'bars' | 'stacked' | 'treemap';

export const ALLOCATION_CHART_TYPES: AllocationChartType[] = ['donut', 'bars', 'stacked', 'treemap'];

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  tintBackground: string;
  /** Inset fill on a card: chips, close buttons, grouped sections. */
  surface: string;
  /** Progress tracks and segmented control troughs. */
  track: string;
  /** Text inputs and pills. */
  field: string;
  /** Selected segment sitting on a track. */
  raised: string;
  /** Two-colour blend for hero surfaces. */
  gradient: readonly [string, string];
  /** Text and icons drawn on top of the gradient. */
  onGradient: string;
}

export interface ThemeDefinition {
  name: ThemeName;
  label: string;
  light: ThemeColors;
  dark: ThemeColors;
}

export const THEMES: ThemeDefinition[] = [
  {
    name: 'aurora',
    label: 'Aurora',
    light: {
      background: '#F4F6FB',
      card: '#FFFFFF',
      text: '#14172B',
      textSecondary: '#6B7088',
      border: '#E3E6F0',
      accent: '#5B5FEF',
      tintBackground: '#ECEDFE',
      surface: '#EEF0F8',
      track: '#E3E6F0',
      field: '#FFFFFF',
      raised: '#FFFFFF',
      gradient: ['#5B5FEF', '#14A89A'],
      onGradient: '#FFFFFF',
    },
    dark: {
      background: '#0B0D1A',
      card: '#161A2E',
      text: '#F3F4FA',
      textSecondary: '#8D92AB',
      border: '#262B45',
      accent: '#7C80FF',
      tintBackground: '#1E2247',
      surface: '#1F2440',
      track: '#2A3050',
      field: '#1F2440',
      raised: '#363D63',
      gradient: ['#5B5FEF', '#14A89A'],
      onGradient: '#FFFFFF',
    },
  },
  {
    name: 'midnightGold',
    label: 'Midnight Gold',
    light: {
      background: '#F7F5F0',
      card: '#FFFFFF',
      text: '#1B2A4E',
      textSecondary: '#7A7F8C',
      border: '#E8E3D8',
      accent: '#B8862B',
      tintBackground: '#F6EEDC',
      surface: '#F3EFE6',
      track: '#E8E3D8',
      field: '#FFFFFF',
      raised: '#FFFFFF',
      gradient: ['#1B2A4E', '#B8862B'],
      onGradient: '#FFFFFF',
    },
    dark: {
      background: '#0A1020',
      card: '#131C33',
      text: '#F5F1E6',
      textSecondary: '#8A93A8',
      border: '#24304D',
      accent: '#D9A441',
      tintBackground: '#2A2414',
      surface: '#1C2742',
      track: '#24304D',
      field: '#1C2742',
      raised: '#31405F',
      gradient: ['#26386A', '#B8862B'],
      onGradient: '#FFFFFF',
    },
  },
  {
    name: 'sunset',
    label: 'Sunset',
    light: {
      background: '#FFF7F2',
      card: '#FFFFFF',
      text: '#2A1A17',
      textSecondary: '#8C746E',
      border: '#F3E2DA',
      accent: '#F2545B',
      tintBackground: '#FFE9E4',
      surface: '#FBEFE9',
      track: '#F3E2DA',
      field: '#FFFFFF',
      raised: '#FFFFFF',
      gradient: ['#FF6B6B', '#FFB347'],
      onGradient: '#3A1410',
    },
    dark: {
      background: '#140C0B',
      card: '#211513',
      text: '#FFF3EE',
      textSecondary: '#A38B85',
      border: '#3A2622',
      accent: '#FF7A70',
      tintBackground: '#3A1C1A',
      surface: '#2D1D1A',
      track: '#3A2622',
      field: '#2D1D1A',
      raised: '#4A322D',
      gradient: ['#FF6B6B', '#FFB347'],
      onGradient: '#3A1410',
    },
  },
  {
    name: 'forestMint',
    label: 'Forest Mint',
    light: {
      background: '#F2F8F4',
      card: '#FFFFFF',
      text: '#0F241B',
      textSecondary: '#6A7F75',
      border: '#DDEBE3',
      accent: '#0E9F6E',
      tintBackground: '#E0F5EB',
      surface: '#EAF3EE',
      track: '#DDEBE3',
      field: '#FFFFFF',
      raised: '#FFFFFF',
      gradient: ['#10B981', '#A3E635'],
      onGradient: '#06281C',
    },
    dark: {
      background: '#07120D',
      card: '#10201A',
      text: '#EEF8F2',
      textSecondary: '#84998F',
      border: '#1E3329',
      accent: '#34D399',
      tintBackground: '#12301F',
      surface: '#182B23',
      track: '#1E3329',
      field: '#182B23',
      raised: '#2B4539',
      gradient: ['#10B981', '#A3E635'],
      onGradient: '#06281C',
    },
  },
  {
    name: 'orchid',
    label: 'Orchid',
    light: {
      background: '#F9F5FE',
      card: '#FFFFFF',
      text: '#1F1432',
      textSecondary: '#7B6E90',
      border: '#EBE1F7',
      accent: '#7C3AED',
      tintBackground: '#F1E7FE',
      surface: '#F3ECFB',
      track: '#EBE1F7',
      field: '#FFFFFF',
      raised: '#FFFFFF',
      gradient: ['#7C3AED', '#EC4899'],
      onGradient: '#FFFFFF',
    },
    dark: {
      background: '#0E0817',
      card: '#1A1128',
      text: '#F7F1FF',
      textSecondary: '#9A8CB0',
      border: '#2E2142',
      accent: '#A78BFA',
      tintBackground: '#2A1A4A',
      surface: '#251838',
      track: '#2E2142',
      field: '#251838',
      raised: '#3F2E5A',
      gradient: ['#7C3AED', '#EC4899'],
      onGradient: '#FFFFFF',
    },
  },
  {
    name: 'classic',
    label: 'Classic',
    light: {
      background: '#F2F2F7',
      card: '#FFFFFF',
      text: '#1C1C1E',
      textSecondary: '#8E8E93',
      border: '#E5E5EA',
      accent: '#007AFF',
      tintBackground: '#E6F0FF',
      surface: '#F2F2F7',
      track: '#E5E5EA',
      field: '#FFFFFF',
      raised: '#FFFFFF',
      gradient: ['#007AFF', '#5856D6'],
      onGradient: '#FFFFFF',
    },
    dark: {
      background: '#000000',
      card: '#1C1C1E',
      text: '#FFFFFF',
      textSecondary: '#8E8E93',
      border: '#38383A',
      accent: '#0A84FF',
      tintBackground: '#1A2942',
      surface: '#2C2C2E',
      track: '#38383A',
      field: '#2C2C2E',
      raised: '#3A3A3C',
      gradient: ['#0A84FF', '#5E5CE6'],
      onGradient: '#FFFFFF',
    },
  },
];

const DEFAULT_THEME: ThemeName = 'classic';
const THEME_NAME_KEY = 'theme_name';
const THEME_MODE_KEY = 'theme_mode';
const DEFAULT_ALLOCATION_CHART: AllocationChartType = 'donut';
const ALLOCATION_CHART_KEY = 'allocation_chart';

const findTheme = (name: ThemeName): ThemeDefinition =>
  THEMES.find((theme) => theme.name === name) ?? THEMES[0];

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  colors: ThemeColors;
  isDark: boolean;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  allocationChart: AllocationChartType;
  setAllocationChart: (type: AllocationChartType) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleTheme: () => {},
  colors: findTheme(DEFAULT_THEME).light,
  isDark: false,
  themeName: DEFAULT_THEME,
  setThemeName: () => {},
  allocationChart: DEFAULT_ALLOCATION_CHART,
  setAllocationChart: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const systemScheme = useColorScheme();

  // Read synchronously so the first frame already has the saved theme.
  const readMeta = (key: string): string | null => {
    try {
      return db.getFirstSync<{ value: string }>(`SELECT value FROM app_meta WHERE key = ?;`, [key])?.value ?? null;
    } catch {
      return null;
    }
  };

  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    const stored = readMeta(THEME_NAME_KEY);
    return THEMES.some((theme) => theme.name === stored) ? (stored as ThemeName) : DEFAULT_THEME;
  });
  // null = follow the system scheme until the user picks a mode.
  const [storedMode, setStoredMode] = useState<ThemeMode | null>(() => {
    const stored = readMeta(THEME_MODE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  });
  const [allocationChart, setAllocationChartState] = useState<AllocationChartType>(() => {
    const stored = readMeta(ALLOCATION_CHART_KEY);
    return ALLOCATION_CHART_TYPES.some((type) => type === stored)
      ? (stored as AllocationChartType)
      : DEFAULT_ALLOCATION_CHART;
  });

  const mode: ThemeMode = storedMode ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const isDark = mode === 'dark';

  const persist = useCallback(
    (key: string, value: string) => {
      setAppMeta(db, key, value).catch((err) => console.warn('Theme save warning:', err));
    },
    [db]
  );

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setStoredMode(next);
    persist(THEME_MODE_KEY, next);
  }, [mode, persist]);

  const setThemeName = useCallback(
    (name: ThemeName) => {
      setThemeNameState(name);
      persist(THEME_NAME_KEY, name);
    },
    [persist]
  );

  const setAllocationChart = useCallback(
    (type: AllocationChartType) => {
      setAllocationChartState(type);
      persist(ALLOCATION_CHART_KEY, type);
    },
    [persist]
  );

  const value = useMemo<ThemeContextType>(() => {
    const theme = findTheme(themeName);
    return {
      mode,
      toggleTheme,
      colors: isDark ? theme.dark : theme.light,
      isDark,
      themeName,
      setThemeName,
      allocationChart,
      setAllocationChart,
    };
  }, [mode, isDark, themeName, toggleTheme, setThemeName, allocationChart, setAllocationChart]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
