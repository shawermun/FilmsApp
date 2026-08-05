import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
    buildNavigationTheme,
    getColorsForTheme,
    resolveThemeMode,
    type ResolvedTheme,
    type ThemeColors,
    type ThemeMode,
} from '../constants/theme';
import { getThemeModeSetting, setThemeModeSetting } from '../database/appSettings';

interface ThemeContextValue {
    themeMode: ThemeMode;
    resolvedTheme: ResolvedTheme;
    colors: ThemeColors;
    setThemeMode: (mode: ThemeMode) => Promise<void>;
    isThemeReady: boolean;
    navigationTheme: ReturnType<typeof buildNavigationTheme>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [isThemeReady, setIsThemeReady] = useState(false);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const storedMode = await getThemeModeSetting();
                if (mounted) {
                    setThemeModeState(storedMode);
                }
            } catch (error) {
                console.error('Ошибка загрузки темы:', error);
            } finally {
                if (mounted) {
                    setIsThemeReady(true);
                }
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const resolvedTheme = useMemo(
        () => resolveThemeMode(themeMode, systemScheme),
        [themeMode, systemScheme],
    );

    const colors = useMemo(() => getColorsForTheme(resolvedTheme), [resolvedTheme]);
    const navigationTheme = useMemo(
        () => buildNavigationTheme(colors, resolvedTheme),
        [colors, resolvedTheme],
    );

    const setThemeMode = useCallback(async (mode: ThemeMode) => {
        setThemeModeState(mode);
        await setThemeModeSetting(mode);
    }, []);

    const value = useMemo<ThemeContextValue>(
        () => ({
            themeMode,
            resolvedTheme,
            colors,
            setThemeMode,
            isThemeReady,
            navigationTheme,
        }),
        [themeMode, resolvedTheme, colors, setThemeMode, isThemeReady, navigationTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useAppTheme must be used within AppThemeProvider');
    }

    return context;
}
