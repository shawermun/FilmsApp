import type { Theme as NavigationTheme } from '@react-navigation/native';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from '@react-navigation/native';

export interface ThemeColors {
    background: string;
    surface: string;
    surfaceLight: string;
    inputBg: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    primary: string;
    primaryLight: string;
    accent: string;
    statusPlanned: string;
    statusWatching: string;
    statusCompleted: string;
    statusDropped: string;
    star: string;
    danger: string;
    border: string;
    overlay: string;
}

export type ThemeMode = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

export const DARK_COLORS: ThemeColors = {
    background: '#0F0F1A',
    surface: '#1A1A2E',
    surfaceLight: '#252540',
    inputBg: '#2A2A40',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0B8',
    textMuted: '#6B6B85',
    primary: '#6C63FF',
    primaryLight: '#8B83FF',
    accent: '#E94560',
    statusPlanned: '#4FC3F7',
    statusWatching: '#FFB74D',
    statusCompleted: '#81C784',
    statusDropped: '#E57373',
    star: '#FFD700',
    danger: '#E94560',
    border: '#2A2A40',
    overlay: 'rgba(0, 0, 0, 0.7)',
};

export const LIGHT_COLORS: ThemeColors = {
    background: '#F5F7FB',
    surface: '#FFFFFF',
    surfaceLight: '#EEF2FF',
    inputBg: '#FFFFFF',
    textPrimary: '#151826',
    textSecondary: '#5B647A',
    textMuted: '#8A93A8',
    primary: '#5B57F7',
    primaryLight: '#7C79FA',
    accent: '#D94B66',
    statusPlanned: '#1E88E5',
    statusWatching: '#FB8C00',
    statusCompleted: '#43A047',
    statusDropped: '#E53935',
    star: '#F6B300',
    danger: '#D94B66',
    border: '#DCE2F0',
    overlay: 'rgba(15, 23, 42, 0.35)',
};

// Legacy fallback for files that still import COLORS statically.
export const COLORS: ThemeColors = DARK_COLORS;

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};

export const RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
};

export const FONT_SIZES = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
};

export function resolveThemeMode(mode: ThemeMode, systemScheme: 'dark' | 'light' | 'unspecified' | null | undefined): ResolvedTheme {
    if (mode === 'system') {
        return systemScheme === 'light' ? 'light' : 'dark';
    }

    return mode;
}

export function getColorsForTheme(resolvedTheme: ResolvedTheme): ThemeColors {
    return resolvedTheme === 'light' ? LIGHT_COLORS : DARK_COLORS;
}

export function buildNavigationTheme(colors: ThemeColors, resolvedTheme: ResolvedTheme): NavigationTheme {
    const base = resolvedTheme === 'light' ? NavigationLightTheme : NavigationDarkTheme;

    return {
        ...base,
        colors: {
            ...base.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.surface,
            text: colors.textPrimary,
            border: colors.border,
            notification: colors.accent,
        },
    };
}
