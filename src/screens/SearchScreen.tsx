/**
* Экран "Поиск" — простой поиск фильмов и сериалов через TMDB API.
* На главной показывает новинки за год, а по скроллу догружает ещё.
* Панель поиска плавно скрывается при скролле вниз и появляется при скролле вверх.
*/

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SearchCard } from '../components/SearchCard';
import { MovieDetailsModal } from '../components/MovieDetailsModal';
import { fetchSearchSuggestions, searchMulti, getPopularMoviesThisYear, getTopRatedForPeriod, isTmdbConfigured } from '../api/tmdb';
import type { TMDBSearchResult } from '../types';
import { COLORS, SPACING, FONT_SIZES, RADIUS } from '../constants/theme';
import {
    applySearchFilters,
    buildFilterSummary,
    parsePositiveInt,
    parseRating,
    type SearchSortMode,
} from '../utils/searchFilters';

const SUGGESTIONS_DEBOUNCE_MS = 250;
const SCROLL_DIRECTION_THRESHOLD = 4;
const SUGGESTIONS_MAX_HEIGHT = 220;
const SEARCH_HIDE_ANIMATION_MS = 200;

function dedupeResults(items: TMDBSearchResult[]): TMDBSearchResult[] {
    const seen = new Set<string>();

    return items.filter((item) => {
        const key = `${item.media_type || 'movie'}-${item.id}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

export default function SearchScreen() {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TMDBSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<TMDBSearchResult | null>(null);
    const [configured, setConfigured] = useState<boolean | null>(null);
    const [suggestions, setSuggestions] = useState<TMDBSearchResult[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [nextHomePage, setNextHomePage] = useState(1);
    const [hasMoreHome, setHasMoreHome] = useState(true);
    const suggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nextHomePageRef = useRef(1);

    // Состояния фильтров поиска
    const currentYear = new Date().getFullYear();
    const [sortMode, setSortMode] = useState<SearchSortMode>('default');
    const [minRatingInput, setMinRatingInput] = useState('7');
    const [recentWindowInput, setRecentWindowInput] = useState('4');
    const [periodStartInput, setPeriodStartInput] = useState(String(currentYear - 3));
    const [periodEndInput, setPeriodEndInput] = useState(String(currentYear));

    // Анимация скрытия/появления панели поиска
    const searchTranslateY = useRef(new Animated.Value(0)).current;
    const searchPanelHeightRef = useRef(0);
    const isSearchHiddenRef = useRef(false);
    const lastScrollYRef = useRef(0);
    const [searchPanelHeight, setSearchPanelHeight] = useState(0);

    const loadLatest = useCallback(async (reset = false) => {
        const page = reset ? 1 : nextHomePageRef.current;

        if (reset) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        setError(null);

        try {
            const data = await getPopularMoviesThisYear(page);
            const uniqueData = dedupeResults(data);

            if (reset) {
                setResults(uniqueData);
            } else {
                setResults((prev) => dedupeResults([...prev, ...uniqueData]));
            }

            setSearched(false);
            const nextPage = page + 1;
            nextHomePageRef.current = nextPage;
            setNextHomePage(nextPage);
            // TMDB /discover/movie отдаёт максимум 500 страниц
            setHasMoreHome(uniqueData.length > 0 && page < 500);
        } catch (e) {
            console.error('Ошибка загрузки популярных фильмов:', e);
            setError(e instanceof Error ? e.message : 'Ошибка загрузки');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                const ready = await isTmdbConfigured();
                if (!active) return;

                setConfigured(ready);

                if (ready) {
                    nextHomePageRef.current = 1;
                    setNextHomePage(1);
                    await loadLatest(true);
                }
            } catch (e) {
                console.error('Ошибка проверки TMDB:', e);
                if (active) {
                    setConfigured(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [loadLatest]);

    const handleSearch = useCallback(async (nextQuery?: string) => {
        const trimmedQuery = (nextQuery ?? query).trim();
        if (!trimmedQuery) return;

        setLoading(true);
        setError(null);
        setSearched(true);
        setSuggestions([]);

        try {
            const data = await searchMulti(trimmedQuery);
            setResults(data);
        } catch (e) {
            console.error('Ошибка поиска:', e);
            setError(e instanceof Error ? e.message : 'Ошибка поиска');
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        if (suggestionsDebounceRef.current) {
            clearTimeout(suggestionsDebounceRef.current);
        }

        if (configured !== true) {
            setSuggestions([]);
            setSuggestionsLoading(false);
            return;
        }

        const normalized = query.trim();

        if (normalized.length < 2) {
            setSuggestions([]);
            setSuggestionsLoading(false);
            return;
        }

        suggestionsDebounceRef.current = setTimeout(async () => {
            try {
                setSuggestionsLoading(true);
                const items = await fetchSearchSuggestions(normalized);
                setSuggestions(items);
            } catch (suggestionsError) {
                console.error('Ошибка загрузки подсказок:', suggestionsError);
                setSuggestions([]);
            } finally {
                setSuggestionsLoading(false);
            }
        }, SUGGESTIONS_DEBOUNCE_MS);

        return () => {
            if (suggestionsDebounceRef.current) clearTimeout(suggestionsDebounceRef.current);
        };
    }, [configured, query]);

    const handleClearQuery = () => {
        setQuery('');
        setSuggestions([]);
        setSuggestionsLoading(false);
        nextHomePageRef.current = 1;
        setNextHomePage(1);
        setHasMoreHome(true);
        loadLatest(true);
    };

    const handleSuggestionPress = (item: TMDBSearchResult) => {
        const nextValue = item.title || item.name || '';
        if (!nextValue) return;

        setQuery(nextValue);
        setSuggestions([]);
        handleSearch(nextValue);
    };

    // «Топ за период» грузится отдельным серверным запросом — не зависит от «новинок за год»
    const [periodResults, setPeriodResults] = useState<TMDBSearchResult[] | null>(null);
    const [periodLoading, setPeriodLoading] = useState(false);
    const [periodError, setPeriodError] = useState<string | null>(null);
    const periodRequestIdRef = useRef(0);

    useEffect(() => {
        if (sortMode !== 'top_rated_period' || searched) {
            setPeriodResults(null);
            setPeriodError(null);
            setPeriodLoading(false);
            return;
        }

        const startYear = parsePositiveInt(periodStartInput, currentYear - 3);
        const endYear = parsePositiveInt(periodEndInput, currentYear);
        const requestId = ++periodRequestIdRef.current;

        setPeriodLoading(true);
        setPeriodError(null);

        getTopRatedForPeriod(startYear, endYear)
            .then((data) => {
                if (periodRequestIdRef.current !== requestId) return;
                setPeriodResults(data);
            })
            .catch((e) => {
                if (periodRequestIdRef.current !== requestId) return;
                console.error('Ошибка загрузки топа за период:', e);
                setPeriodError(e instanceof Error ? e.message : 'Ошибка загрузки');
                setPeriodResults([]);
            })
            .finally(() => {
                if (periodRequestIdRef.current !== requestId) return;
                setPeriodLoading(false);
            });
    }, [sortMode, searched, periodStartInput, periodEndInput, currentYear]);

    const handleLoadMore = () => {
        // Блокируем догрузку при активном фильтре: сервер отдаёт только последний год,
        // а фильтрованные результаты короче экрана — onEndReached стреляет бесконечно.
        if (searched || loading || loadingMore || !hasMoreHome || sortMode !== 'default') {
            return;
        }

        loadLatest(false);
    };

    const showSearchPanel = useCallback(() => {
        if (!isSearchHiddenRef.current) return;
        isSearchHiddenRef.current = false;
        Animated.timing(searchTranslateY, {
            toValue: 0,
            duration: SEARCH_HIDE_ANIMATION_MS,
            useNativeDriver: true,
        }).start();
    }, [searchTranslateY]);

    const hideSearchPanel = useCallback(() => {
        if (isSearchHiddenRef.current) return;
        isSearchHiddenRef.current = true;
        Animated.timing(searchTranslateY, {
            toValue: -searchPanelHeightRef.current,
            duration: SEARCH_HIDE_ANIMATION_MS,
            useNativeDriver: true,
        }).start();
    }, [searchTranslateY]);

    const sourceResults = sortMode === 'top_rated_period' && !searched && periodResults !== null
        ? periodResults
        : results;

    const filteredResults = useMemo(
        () =>
            applySearchFilters(sourceResults, {
                mediaFilter: 'all',
                sortMode,
                minRating: parseRating(minRatingInput),
                recentWindowYears: parsePositiveInt(recentWindowInput, 4),
                periodStartYear: parsePositiveInt(periodStartInput, currentYear - 3),
                periodEndYear: parsePositiveInt(periodEndInput, currentYear),
            }),
        [sourceResults, sortMode, minRatingInput, recentWindowInput, periodStartInput, periodEndInput, currentYear],
    );

    const filterSummary = useMemo(
        () => buildFilterSummary({
            mediaFilter: 'all',
            sortMode,
            minRating: parseRating(minRatingInput),
            recentWindowYears: parsePositiveInt(recentWindowInput, 4),
            periodStartYear: parsePositiveInt(periodStartInput, currentYear - 3),
            periodEndYear: parsePositiveInt(periodEndInput, currentYear),
        }, searched),
        [sortMode, minRatingInput, recentWindowInput, periodStartInput, periodEndInput, currentYear, searched],
    );

    const SORT_MODES: { value: SearchSortMode; label: string }[] = [
        { value: 'default', label: 'Обычный' },
        { value: 'newest', label: 'Сначала новые' },
        { value: 'rating', label: 'По отзывам' },
        { value: 'hybrid', label: 'Свежий + топ' },
        { value: 'top_rated_period', label: 'Топ за период' },
    ];

    const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
        const currentY = event.nativeEvent.contentOffset.y;
        const dy = currentY - lastScrollYRef.current;
        lastScrollYRef.current = currentY;

        if (currentY <= 0) {
            showSearchPanel();
            return;
        }

        if (dy > SCROLL_DIRECTION_THRESHOLD) {
            hideSearchPanel();
        } else if (dy < -SCROLL_DIRECTION_THRESHOLD) {
            showSearchPanel();
        }
    }, [hideSearchPanel, showSearchPanel]);

    if (configured === null) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Проверяю настройки TMDB...</Text>
            </View>
        );
    }

    if (!configured) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="key-outline" size={48} color={COLORS.statusWatching} />
                <Text style={styles.errorText}>Не задан TMDB API-ключ</Text>
                <Text style={styles.hintText}>
                    Откройте Настройки → Провайдеры и добавьте ваш TMDB API-ключ.
                </Text>
            </View>
        );
    }

    const showSuggestions = query.trim().length >= 2 && (suggestionsLoading || suggestions.length > 0);

    const listHeader = (
        <View>
            <View style={styles.toolbar}>
                <Text style={styles.sectionTitle}>
                    {searched ? `Результаты поиска: ${filteredResults.length}` : `Популярные фильмы ${currentYear}: ${filteredResults.length}`}
                </Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsRow}
            >
                {SORT_MODES.map((mode) => {
                    const active = sortMode === mode.value;
                    return (
                        <TouchableOpacity
                            key={mode.value}
                            style={[styles.filterChip, active && styles.filterChipActive]}
                            onPress={() => setSortMode(mode.value)}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                                {mode.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {sortMode === 'hybrid' ? (
                <View style={styles.filterParamsCard}>
                    <View style={styles.filterParamRow}>
                        <Text style={styles.filterParamLabel}>Оценка от</Text>
                        <TextInput
                            style={styles.filterParamInput}
                            value={minRatingInput}
                            onChangeText={setMinRatingInput}
                            keyboardType="decimal-pad"
                            placeholder="7"
                            placeholderTextColor={COLORS.textMuted}
                        />
                        <Text style={styles.filterParamLabel}>Окно новизны, лет</Text>
                        <TextInput
                            style={styles.filterParamInput}
                            value={recentWindowInput}
                            onChangeText={setRecentWindowInput}
                            keyboardType="number-pad"
                            placeholder="4"
                            placeholderTextColor={COLORS.textMuted}
                        />
                    </View>
                </View>
            ) : null}

            {sortMode === 'top_rated_period' ? (
                <View style={styles.filterParamsCard}>
                    <View style={styles.filterParamRow}>
                        <Text style={styles.filterParamLabel}>Период с</Text>
                        <TextInput
                            style={styles.filterParamInput}
                            value={periodStartInput}
                            onChangeText={setPeriodStartInput}
                            keyboardType="number-pad"
                            placeholder={String(currentYear - 3)}
                            placeholderTextColor={COLORS.textMuted}
                        />
                        <Text style={styles.filterParamLabel}>по</Text>
                        <TextInput
                            style={styles.filterParamInput}
                            value={periodEndInput}
                            onChangeText={setPeriodEndInput}
                            keyboardType="number-pad"
                            placeholder={String(currentYear)}
                            placeholderTextColor={COLORS.textMuted}
                        />
                    </View>
                    <View style={styles.periodQuickRow}>
                        {[
                            { label: 'Последние 4 года', start: currentYear - 3, end: currentYear },
                            { label: '2020-е', start: 2020, end: currentYear },
                            { label: '2010–2015', start: 2010, end: 2015 },
                            { label: '2000-е', start: 2000, end: 2009 },
                        ].map((preset) => {
                            const activePreset =
                                parsePositiveInt(periodStartInput, 0) === preset.start &&
                                parsePositiveInt(periodEndInput, 0) === preset.end;
                            return (
                                <TouchableOpacity
                                    key={preset.label}
                                    style={[styles.periodChip, activePreset && styles.filterChipActive]}
                                    onPress={() => {
                                        setPeriodStartInput(String(preset.start));
                                        setPeriodEndInput(String(preset.end));
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.filterChipText, activePreset && styles.filterChipTextActive]}>
                                        {preset.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            ) : null}

            <Text style={styles.summaryText}>{filterSummary}</Text>
        </View>
    );

    return (
        <>
            <View style={[styles.container, { paddingBottom: insets.bottom }]}>
                <Animated.View
                    style={[styles.searchPanel, { transform: [{ translateY: searchTranslateY }] }]}
                    onLayout={(e) => {
                        const height = e.nativeEvent.layout.height;
                        searchPanelHeightRef.current = height;
                        setSearchPanelHeight(height);
                    }}
                >
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Фильмы, сериалы..."
                            placeholderTextColor={COLORS.textMuted}
                            value={query}
                            onChangeText={setQuery}
                            onSubmitEditing={() => handleSearch()}
                            returnKeyType="search"
                        />
                        {query.length > 0 ? (
                            <TouchableOpacity onPress={handleClearQuery}>
                                <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {showSuggestions ? (
                        <ScrollView
                            style={[styles.suggestionsCard, { maxHeight: SUGGESTIONS_MAX_HEIGHT }]}
                            keyboardShouldPersistTaps="always"
                            nestedScrollEnabled
                            bounces={false}
                        >
                            {suggestionsLoading ? (
                                <Text style={styles.suggestionsHint}>Подбираю варианты…</Text>
                            ) : (
                                suggestions.map((item) => {
                                    const title = item.title || item.name || 'Без названия';
                                    const year = (item.release_date || item.first_air_date || '').split('-')[0];
                                    const mediaLabel = item.media_type === 'tv' ? 'Сериал' : 'Фильм';

                                    return (
                                        <TouchableOpacity
                                            key={`${item.media_type || 'movie'}-${item.id}`}
                                            style={styles.suggestionRow}
                                            onPress={() => handleSuggestionPress(item)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.suggestionTitle} numberOfLines={1}>{title}</Text>
                                            <Text style={styles.suggestionMeta} numberOfLines={1}>
                                                {mediaLabel}{year ? ` • ${year}` : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    ) : null}
                </Animated.View>

                {sortMode === 'top_rated_period' && !searched && periodLoading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Подбираю топ за период…</Text>
                    </View>
                ) : sortMode === 'top_rated_period' && !searched && periodError ? (
                    <View style={styles.centerContainer}>
                        <Ionicons name="cloud-offline-outline" size={48} color={COLORS.danger} />
                        <Text style={styles.errorText}>{periodError}</Text>
                        <TouchableOpacity
                            style={styles.retryBtn}
                            onPress={() => {
                                const requestId = ++periodRequestIdRef.current;
                                setPeriodLoading(true);
                                setPeriodError(null);
                                getTopRatedForPeriod(
                                    parsePositiveInt(periodStartInput, currentYear - 3),
                                    parsePositiveInt(periodEndInput, currentYear),
                                )
                                    .then((data) => {
                                        if (periodRequestIdRef.current !== requestId) return;
                                        setPeriodResults(data);
                                    })
                                    .catch((e) => {
                                        if (periodRequestIdRef.current !== requestId) return;
                                        setPeriodError(e instanceof Error ? e.message : 'Ошибка загрузки');
                                        setPeriodResults([]);
                                    })
                                    .finally(() => {
                                        if (periodRequestIdRef.current !== requestId) return;
                                        setPeriodLoading(false);
                                    });
                            }}
                        >
                            <Text style={styles.retryText}>Повторить</Text>
                        </TouchableOpacity>
                    </View>
                ) : loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>{searched ? 'Ищем фильмы…' : 'Загрузка популярных фильмов…'}</Text>
                    </View>
                ) : error ? (
                    <View style={styles.centerContainer}>
                        <Ionicons name="cloud-offline-outline" size={48} color={COLORS.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity
                            style={styles.retryBtn}
                            onPress={() => (searched && query.trim() ? handleSearch() : loadLatest(true))}
                        >
                            <Text style={styles.retryText}>Повторить</Text>
                        </TouchableOpacity>
                    </View>
                ) : results.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>
                            {searched ? 'Ничего не найдено' : 'Нет популярных фильмов'}
                        </Text>
                        <Text style={styles.hintText}>
                            {searched
                                ? 'Попробуй изменить запрос или написать точнее название.'
                                : 'Попробуй обновить позже или изменить запрос.'}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        style={styles.resultsList}
                        data={filteredResults}
                        keyExtractor={(item) => `${item.media_type || 'movie'}-${item.id}`}
                        renderItem={({ item }) => (
                            <SearchCard item={item} onPress={(selected) => setSelectedItem(selected)} />
                        )}
                        contentContainerStyle={[
                            styles.listContainer,
                            { paddingTop: searchPanelHeight + SPACING.md },
                        ]}
                        keyboardShouldPersistTaps="always"
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        ListHeaderComponent={listHeader}
                        ListFooterComponent={
                            !searched && loadingMore ? (
                                <View style={styles.footerLoader}>
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                    <Text style={styles.footerLoaderText}>Подгружаю ещё…</Text>
                                </View>
                            ) : <View style={styles.footerSpacer} />
                        }
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        initialNumToRender={12}
                        windowSize={9}
                        removeClippedSubviews
                    />
                )}
            </View>

            <MovieDetailsModal
                visible={!!selectedItem}
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    loadingText: {
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
        fontSize: FONT_SIZES.md,
        textAlign: 'center',
    },
    errorText: {
        color: COLORS.danger,
        marginTop: SPACING.md,
        fontSize: FONT_SIZES.md,
        textAlign: 'center',
    },
    hintText: {
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
        fontSize: FONT_SIZES.sm,
        textAlign: 'center',
        paddingHorizontal: SPACING.xl,
        lineHeight: 20,
    },
    retryBtn: {
        marginTop: SPACING.lg,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.primary,
    },
    retryText: {
        color: COLORS.textPrimary,
        fontWeight: 'bold',
    },
    searchPanel: {
        backgroundColor: COLORS.background,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        marginHorizontal: SPACING.md,
        marginTop: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchIcon: {
        marginRight: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        paddingVertical: SPACING.md,
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        marginTop: SPACING.md,
        gap: SPACING.sm,
    },
    sectionTitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        textTransform: 'uppercase',
        flex: 1,
    },
    summaryText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
        paddingHorizontal: SPACING.md,
        marginTop: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    suggestionsCard: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginHorizontal: SPACING.md,
        marginTop: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    suggestionsHint: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: 12,
    },
    suggestionRow: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    suggestionTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
    suggestionMeta: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
        marginTop: 2,
    },
    resultsList: {
        flex: 1,
    },
    listContainer: {
        padding: SPACING.md,
        paddingBottom: SPACING.xl,
    },
    footerLoader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
    },
    footerLoaderText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        marginLeft: SPACING.sm,
    },
    footerSpacer: {
        height: SPACING.xl,
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.lg,
        textAlign: 'center',
    },
    filterChipsRow: {
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.sm,
        gap: SPACING.sm,
    },
    filterChip: {
        minHeight: 36,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: RADIUS.xl,
        backgroundColor: COLORS.surface,
        marginRight: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterChipText: {
        color: COLORS.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: COLORS.textPrimary,
    },
    filterParamsCard: {
        marginHorizontal: SPACING.md,
        marginTop: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.md,
    },
    filterParamRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    filterParamLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
    },
    filterParamInput: {
        minWidth: 64,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.inputBg,
        fontSize: FONT_SIZES.sm,
        textAlign: 'center',
    },
    periodQuickRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.sm,
    },
    periodChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: RADIUS.xl,
        backgroundColor: COLORS.surfaceLight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
});
