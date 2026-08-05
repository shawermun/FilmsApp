/**
 * Экран "Библиотека".
 * Вкладки переключаются и по тапу, и свайпом, а активный фильтр
 * синхронно подсвечивается и подскролливается в верхней ленте.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    ScrollView,
    Alert,
    useWindowDimensions,
    NativeSyntheticEvent,
    NativeScrollEvent,
    LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MovieCard } from '../components/MovieCard';
import { MovieDetailsModal } from '../components/MovieDetailsModal';
import { deleteMovie, getAllMovies } from '../database/db';
import type { Movie, WatchStatus } from '../types';
import { SPACING, FONT_SIZES, RADIUS } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';

type LibraryFilterValue = WatchStatus | 'all';

type ChipLayout = {
    x: number;
    width: number;
};

const STATUS_FILTERS: { label: string; value: LibraryFilterValue }[] = [
    { label: 'Все', value: 'all' },
    { label: 'Запланировано', value: 'planned' },
    { label: 'Смотрю', value: 'watching' },
    { label: 'Просмотрено', value: 'completed' },
    { label: 'Брошено', value: 'dropped' },
];

export default function LibraryScreen() {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const pageWidth = Math.max(screenWidth, 1);

    const [movies, setMovies] = useState<Movie[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

    const pagerRef = useRef<FlatList<(typeof STATUS_FILTERS)[number]> | null>(null);
    const chipsScrollRef = useRef<ScrollView | null>(null);
    const chipsLayoutRef = useRef<ChipLayout[]>([]);

    const activeFilter = STATUS_FILTERS[activeIndex]?.value ?? 'all';

    const loadMovies = useCallback(async () => {
        try {
            setError(null);
            const data = await getAllMovies();
            setMovies(data);
        } catch (e) {
            console.error('Ошибка загрузки фильмов:', e);
            setError(e instanceof Error ? e.message : 'Не удалось загрузить библиотеку');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadMovies();
        }, [loadMovies]),
    );

    const moviesByFilter = useMemo(
        () =>
            STATUS_FILTERS.map(({ value }) =>
                value === 'all' ? movies : movies.filter((movie) => movie.status === value),
            ),
        [movies],
    );

    const scrollChipIntoView = useCallback((index: number) => {
        const layout = chipsLayoutRef.current[index];
        if (!layout) return;

        const targetX = Math.max(0, layout.x - 16);
        chipsScrollRef.current?.scrollTo({ x: targetX, animated: true });
    }, []);

    const setIndexAndSync = useCallback(
        (index: number) => {
            if (index < 0 || index >= STATUS_FILTERS.length) return;
            setActiveIndex((prev) => {
                if (prev === index) return prev;
                scrollChipIntoView(index);
                return index;
            });
        },
        [scrollChipIntoView],
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadMovies();
    };

    const handleMovieLongPress = useCallback(
        (movie: Movie) => {
            Alert.alert(
                movie.title,
                'Что сделать с этой записью?',
                [
                    { text: 'Отмена', style: 'cancel' },
                    {
                        text: 'Удалить из библиотеки',
                        style: 'destructive',
                        onPress: () => {
                            if (!movie.id) return;
                            Alert.alert(
                                'Удалить запись?',
                                `«${movie.title}» будет удалена из библиотеки вместе с оценкой и отзывом.`,
                                [
                                    { text: 'Отмена', style: 'cancel' },
                                    {
                                        text: 'Удалить',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                await deleteMovie(movie.id!);
                                                loadMovies();
                                            } catch (e) {
                                                Alert.alert(
                                                    'Ошибка',
                                                    e instanceof Error ? e.message : 'Не удалось удалить запись',
                                                );
                                            }
                                        },
                                    },
                                ],
                            );
                        },
                    },
                ],
            );
        },
        [loadMovies],
    );

    const handleTabPress = useCallback(
        (index: number) => {
            setIndexAndSync(index);
            pagerRef.current?.scrollToIndex({ index, animated: true });
        },
        [setIndexAndSync],
    );

    const handlePagerScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
            if (nextIndex !== activeIndex) {
                setIndexAndSync(nextIndex);
            }
        },
        [activeIndex, pageWidth, setIndexAndSync],
    );

    const handleChipLayout = useCallback((index: number, event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        chipsLayoutRef.current[index] = { x, width };
    }, []);

    const renderEmptyState = () => (
        <View style={styles.emptyBox}>
            <Ionicons name="film-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Здесь пока пусто</Text>
            <Text style={styles.emptySubtitle}>
                Перейдите на вкладку «Поиск», чтобы добавить фильмы
            </Text>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Загрузка библиотеки…</Text>
            </View>
        );
    }

    if (error && movies.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => {
                        setLoading(true);
                        loadMovies();
                    }}
                >
                    <Text style={styles.retryText}>Повторить</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <>
            <View style={[styles.container, { paddingBottom: insets.bottom }]}>
                <ScrollView
                    ref={chipsScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterContainer}
                >
                    {STATUS_FILTERS.map((item, index) => {
                        const active = activeFilter === item.value;
                        return (
                            <TouchableOpacity
                                key={item.value}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                                onPress={() => handleTabPress(index)}
                                onLayout={(event) => handleChipLayout(index, event)}
                                activeOpacity={0.85}
                            >
                                <Text
                                    style={[styles.filterText, active && styles.filterTextActive]}
                                    numberOfLines={1}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <FlatList
                    ref={pagerRef}
                    data={STATUS_FILTERS}
                    horizontal
                    pagingEnabled
                    bounces={false}
                    decelerationRate="fast"
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.value}
                    onScroll={handlePagerScroll}
                    scrollEventThrottle={16}
                    getItemLayout={(_, index) => ({
                        length: pageWidth,
                        offset: pageWidth * index,
                        index,
                    })}
                    removeClippedSubviews={false}
                    renderItem={({ index }) => {
                        const pageMovies = moviesByFilter[index] ?? [];

                        return (
                            <View style={[styles.page, { width: pageWidth }]}>
                                <FlatList
                                    data={pageMovies}
                                    keyExtractor={(item) => String(item.id)}
                                    renderItem={({ item }) => (
                                        <MovieCard
                                            movie={item}
                                            onPress={setSelectedMovie}
                                            onLongPress={handleMovieLongPress}
                                        />
                                    )}
                                    contentContainerStyle={
                                        pageMovies.length === 0
                                            ? styles.emptyListContainer
                                            : styles.listContainer
                                    }
                                    ListEmptyComponent={renderEmptyState()}
                                    refreshControl={
                                        <RefreshControl
                                            refreshing={refreshing}
                                            onRefresh={handleRefresh}
                                            tintColor={colors.primary}
                                        />
                                    }
                                    initialNumToRender={8}
                                    windowSize={7}
                                    removeClippedSubviews
                                    nestedScrollEnabled
                                />
                            </View>
                        );
                    }}
                />
            </View>

            <MovieDetailsModal
                visible={!!selectedMovie}
                item={selectedMovie}
                onClose={() => setSelectedMovie(null)}
                onLibraryChanged={loadMovies}
            />
        </>
    );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        page: {
            flex: 1,
        },
        centerContainer: {
            flex: 1,
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
            padding: SPACING.xl,
        },
        loadingText: {
            color: colors.textSecondary,
            marginTop: SPACING.md,
            fontSize: FONT_SIZES.md,
        },
        errorText: {
            color: colors.danger,
            marginTop: SPACING.md,
            fontSize: FONT_SIZES.md,
            textAlign: 'center',
        },
        retryBtn: {
            marginTop: SPACING.lg,
            paddingHorizontal: SPACING.lg,
            paddingVertical: SPACING.sm,
            borderRadius: RADIUS.sm,
            backgroundColor: colors.primary,
        },
        retryText: {
            color: colors.textPrimary,
            fontWeight: 'bold',
        },
        filterContainer: {
            paddingHorizontal: SPACING.md,
            paddingTop: SPACING.sm,
            paddingBottom: SPACING.xs,
            gap: SPACING.sm,
        },
        filterChip: {
            minHeight: 42,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: RADIUS.xl,
            backgroundColor: colors.surface,
            marginRight: SPACING.sm,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
        },
        filterChipActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        filterText: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: '600',
            textAlign: 'center',
            lineHeight: 18,
            includeFontPadding: false,
            textAlignVertical: 'center',
        },
        filterTextActive: {
            color: colors.textPrimary,
        },
        listContainer: {
            padding: SPACING.md,
        },
        emptyListContainer: {
            flexGrow: 1,
            padding: SPACING.xl,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyBox: {
            alignItems: 'center',
            maxWidth: 260,
        },
        emptyTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.xl,
            fontWeight: 'bold',
            marginBottom: SPACING.sm,
            textAlign: 'center',
        },
        emptySubtitle: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.md,
            textAlign: 'center',
            lineHeight: 22,
        },
    });
}
