import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';

import { getDatabase } from './src/database/db';
import { AppThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { FONT_SIZES } from './src/constants/theme';

import LibraryScreen from './src/screens/LibraryScreen';
import SearchScreen from './src/screens/SearchScreen';
import RecommendationsScreen from './src/screens/RecommendationsScreen';
import NotesScreen from './src/screens/NotesScreen';
import ReviewsScreen from './src/screens/ReviewsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

type TabParamList = {
  Library: undefined;
  Search: undefined;
  Recommendations: undefined;
  Notes: undefined;
  Reviews: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function AppShell() {
  const { colors, navigationTheme, resolvedTheme, isThemeReady } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!isThemeReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Применяю тему…</Text>
      </View>
    );
  }

  return (
    <>
      <NavigationContainer theme={navigationTheme}>
        <Tab.Navigator
          screenOptions={{
            headerShown: true,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              paddingBottom: 4,
              height: 60,
            },
            headerStyle: {
              backgroundColor: colors.surface,
            },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Tab.Screen
            name="Library"
            component={LibraryScreen}
            options={{
              title: 'Библиотека',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="film-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Search"
            component={SearchScreen}
            options={{
              title: 'Поиск',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="search-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Recommendations"
            component={RecommendationsScreen}
            options={{
              title: 'ИИ-подбор',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="sparkles-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Notes"
            component={NotesScreen}
            options={{
              title: 'Заметки',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="book-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Reviews"
            component={ReviewsScreen}
            options={{
              title: 'Мои отзывы',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="star-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: 'Настройки',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="settings-outline" color={color} size={size} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await getDatabase();
        if (mounted) setIsReady(true);
      } catch (e) {
        if (mounted) {
          setInitError(
            e instanceof Error
              ? e.message
              : 'Не удалось инициализировать базу данных',
          );
          setIsReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!isReady) {
    return (
      <View style={baseStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={baseStyles.loadingText}>Загрузка…</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={baseStyles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color="#E94560" />
        <Text style={baseStyles.errorText}>{initError}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AppShell />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    loadingText: {
      color: colors.textSecondary,
      marginTop: 16,
      fontSize: FONT_SIZES.md,
    },
  });
}

const baseStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#A0A0B8',
    marginTop: 16,
    fontSize: FONT_SIZES.md,
  },
  errorText: {
    color: '#E94560',
    marginTop: 16,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
});
