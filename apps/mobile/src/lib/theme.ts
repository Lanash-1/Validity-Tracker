import { useColorScheme } from 'react-native';
import type { ExpiryBucket } from '@vt/shared';

export const palette = {
  teal: '#0F766E',
  tealDark: '#115E59',
  tealLight: '#CCFBF1',
  red: '#DC2626',
  amber: '#D97706',
  green: '#16A34A',
  slate900: '#0F172A',
  slate700: '#334155',
  slate500: '#64748B',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  white: '#FFFFFF',
  dark900: '#0B1120',
  dark800: '#111827',
  dark700: '#1F2937',
  dark600: '#374151',
};

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primarySoft: string;
  danger: string;
  warn: string;
  ok: string;
  inputBg: string;
}

const light: Theme = {
  dark: false,
  bg: palette.slate50,
  card: palette.white,
  border: palette.slate200,
  text: palette.slate900,
  muted: palette.slate500,
  primary: palette.teal,
  primarySoft: palette.tealLight,
  danger: palette.red,
  warn: palette.amber,
  ok: palette.green,
  inputBg: palette.white,
};

const dark: Theme = {
  dark: true,
  bg: palette.dark900,
  card: palette.dark800,
  border: palette.dark600,
  text: '#F3F4F6',
  muted: '#9CA3AF',
  primary: '#2DD4BF',
  primarySoft: '#134E4A',
  danger: '#F87171',
  warn: '#FBBF24',
  ok: '#4ADE80',
  inputBg: palette.dark700,
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function bucketColor(bucket: ExpiryBucket, t: Theme): string {
  switch (bucket) {
    case 'expired':
      return t.danger;
    case 'today':
      return t.danger;
    case 'week':
      return t.warn;
    case 'month':
      return t.primary;
    default:
      return t.muted;
  }
}

export const spacing = (n: number) => n * 4;
