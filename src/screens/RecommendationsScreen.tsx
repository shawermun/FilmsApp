/**
 * Экран "Рекомендации" — ИИ-рекомендации на основе библиотеки пользователя
 * и его явных предпочтений, плюс режим "Угадать фильм по описанию".
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    ScrollView,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchCard } from '../components/SearchCard';
import { MovieDetailsModal } from '../components/MovieDetailsModal';
import {
    getRecommendations,
    getRecommendationProviderStatus,
    guessMoviesByDescription,
} from '../api/recommendations';
import { searchMulti } from '../api/tmdb';
import { getAllMovies } from '../database/db';
import {
    getRecommendationPreferences,
    saveRecommendationPreferences,
} from '../database/recommendationPreferences';
import type {
    AIRecommendation,
    RecommendationPreferences,
    RecommendationPromptInput,
    TMDBSearchResult,
} from '../types';
import { SPACING, FONT_SIZES, RADIUS } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';

function parseCommaSeparated(value: string): string[] {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function stringifyList(items: string[]): string {
    return items.join(', ');
}

/** Извлекает из строки рекомендации название для поиска и год, если он указан */
function parseTitleAndYear(title: string): { query: string; year: string | null } {
    const yearMatch = title.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : null;
    const query = title.replace(/\s*\(\d{4}\)\s*/g, ' ').replace(/\*\*/g, '').trim();
    return { query, year };
}

/** Подбирает для рекомендации лучший результат TMDB с учётом года, если он указан */
function pickBestMatch(results: TMDBSearchResult[], year: string | null): TMDBSearchResult | null {
    if (results.length === 0) return null;

    if (year) {
        const byYear = results.find((item) => {
            const rawDate = item.release_date || item.first_air_date || '';
            return rawDate.slice(0, 4) === year;
        });
        if (byYear) return byYear;
    }

    return results[0];
}

/** Строит множество ключей "media_type-tmdb_id" для всех фильмов локальной библиотеки */
async function buildExistingLibraryKeys(): Promise<Set<string>> {
    try {
        const movies = await getAllMovies();
        const keys = new Set<string>();
        for (const movie of movies) {
            if (movie.tmdb_id > 0) {
                keys.add(`${movie.media_type}-${movie.tmdb_id}`);
            }
        }
        return keys;
    } catch (error) {
        console.warn('Не удалось загрузить библиотеку для исключения:', error);
        return new Set();
    }
}

/** Ищет каждую рекомендацию в TMDB и возвращает только найденные карточки.
 *  Фильмы, уже присутствующие в локальной библиотеке (любой статус), исключаются. */
async function resolveRecommendationsToTmdb(
    items: AIRecommendation[],
    excludeKeys: Set<string>,
): Promise<TMDBSearchResult[]> {
    console.log(`Рекомендации: ИИ вернул ${items.length} блок(ов) для резолва в TMDB`);

    const resolved = await Promise.all(
        items.map(async (item) => {
            const { query, year } = parseTitleAndYear(item.title);
            if (!query) return null;

            try {
                const results = await searchMulti(query, 1);
                return pickBestMatch(results, year);
            } catch (error) {
                console.warn(`Не удалось найти в TMDB "${query}":`, error);
                return null;
            }
        }),
    );

    const seen = new Set<string>();
    let skippedInLibrary = 0;
    const filtered = resolved.filter((item): item is TMDBSearchResult => {
        if (!item) return false;
        const key = `${item.media_type || 'movie'}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        if (excludeKeys.has(key)) {
            skippedInLibrary += 1;
            return false;
        }
        return true;
    });

    console.log(
        `Рекомендации: после резолва найдено ${filtered.length} уникальных карточек ` +
        `(исключено ${skippedInLibrary} — уже в библиотеке)`,
    );
    return filtered;
}

export default function RecommendationsScreen() {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [recommendations, setRecommendations] = useState<TMDBSearchResult[]>([]);
    const [guessResults, setGuessResults] = useState<TMDBSearchResult[]>([]);
    const [selectedItem, setSelectedItem] = useState<TMDBSearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [guessLoading, setGuessLoading] = useState(false);
    const [savingPreferences, setSavingPreferences] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [hasGuessed, setHasGuessed] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [configured, setConfigured] = useState<boolean | null>(null);
    const [providerLabel, setProviderLabel] = useState('Gemini');
    const [providerHint, setProviderHint] = useState<string | null>(null);

    const [freeformPrompt, setFreeformPrompt] = useState('');
    const [favoriteGenres, setFavoriteGenres] = useState('');
    const [dislikedGenres, setDislikedGenres] = useState('');
    const [favoriteTitles, setFavoriteTitles] = useState('');
    const [moodKeywords, setMoodKeywords] = useState('');
    const [avoidKeywords, setAvoidKeywords] = useState('');
    const [guessPrompt, setGuessPrompt] = useState('');

    const loadPreferences = useCallback(async () => {
        try {
            const preferences = await getRecommendationPreferences();
            setFreeformPrompt(preferences.freeform_prompt || '');
            setFavoriteGenres(stringifyList(preferences.favorite_genres));
            setDislikedGenres(stringifyList(preferences.disliked_genres));
            setFavoriteTitles(stringifyList(preferences.favorite_titles));
            setMoodKeywords(stringifyList(preferences.mood_keywords));
            setAvoidKeywords(stringifyList(preferences.avoid_keywords));
        } catch (error) {
            console.error('Ошибка загрузки предпочтений:', error);
        }
    }, []);

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                const status = await getRecommendationProviderStatus();
                if (active) {
                    setConfigured(status.configured);
                    setProviderLabel(status.providerLabel);
                    setProviderHint(status.reason || null);
                }
                await loadPreferences();
            } catch (error) {
                console.error('Ошибка инициализации рекомендаций:', error);
                if (active) {
                    setConfigured(false);
                    setProviderHint('Не удалось прочитать настройки AI-провайдера.');
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [loadPreferences]);

    const buildPreferencesPayload = (): Omit<RecommendationPreferences, 'id' | 'updated_at'> => ({
        freeform_prompt: freeformPrompt.trim(),
        favorite_genres: parseCommaSeparated(favoriteGenres),
        disliked_genres: parseCommaSeparated(dislikedGenres),
        favorite_titles: parseCommaSeparated(favoriteTitles),
        mood_keywords: parseCommaSeparated(moodKeywords),
        avoid_keywords: parseCommaSeparated(avoidKeywords),
        preferred_provider: null,
    });

    const savePreferences = useCallback(async () => {
        setSavingPreferences(true);
        try {
            await saveRecommendationPreferences(buildPreferencesPayload());
            Alert.alert('Сохранено', 'Предпочтения для рекомендаций обновлены.');
        } catch (error) {
            console.error('Ошибка сохранения предпочтений:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить предпочтения.');
        } finally {
            setSavingPreferences(false);
        }
    }, [
        freeformPrompt,
        favoriteGenres,
        dislikedGenres,
        favoriteTitles,
        moodKeywords,
        avoidKeywords,
    ]);

    const syncProviderStatus = useCallback(async () => {
        const status = await getRecommendationProviderStatus();
        setConfigured(status.configured);
        setProviderLabel(status.providerLabel);
        setProviderHint(status.reason || null);
        return status;
    }, []);

    /** Загружает рекомендации от ИИ только по явным предпочтениям пользователя */
    const loadRecommendations = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);

        try {
            const status = await syncProviderStatus();

            if (!status.configured) {
                setRecommendations([]);
                setHasLoaded(false);
                throw new Error(status.reason || 'AI-провайдер не настроен.');
            }

            const preferences = buildPreferencesPayload();
            await saveRecommendationPreferences(preferences);

            const promptInput: RecommendationPromptInput = {
                watchedMovies: [],
                freeformPrompt: preferences.freeform_prompt,
                favoriteGenres: preferences.favorite_genres,
                dislikedGenres: preferences.disliked_genres,
                favoriteTitles: preferences.favorite_titles,
                moodKeywords: preferences.mood_keywords,
                avoidKeywords: preferences.avoid_keywords,
            };

            if (
                !promptInput.freeformPrompt.trim() &&
                promptInput.favoriteGenres.length === 0 &&
                promptInput.favoriteTitles.length === 0 &&
                promptInput.moodKeywords.length === 0
            ) {
                setRecommendations([]);
                setHasLoaded(true);
                return;
            }

            const data = await getRecommendations(promptInput);
            const excludeKeys = await buildExistingLibraryKeys();
            const resolved = await resolveRecommendationsToTmdb(data, excludeKeys);

            if (data.length > 0 && resolved.length === 0) {
                setHasLoaded(false);
                setErrorMsg('ИИ вернул рекомендации, но все либо не нашлись в TMDB, либо уже есть в вашей библиотеке. Попробуйте добавить больше предпочтений.');
                return;
            }

            setRecommendations(resolved);
            setHasLoaded(true);
        } catch (e) {
            console.error('Ошибка получения рекомендаций:', e);
            setRecommendations([]);
            setHasLoaded(false);
            setErrorMsg(e instanceof Error ? e.message : 'Не удалось получить рекомендации');
        } finally {
            setLoading(false);
        }
    }, [
        syncProviderStatus,
        freeformPrompt,
        favoriteGenres,
        dislikedGenres,
        favoriteTitles,
        moodKeywords,
        avoidKeywords,
    ]);

    const handleGuessMovie = useCallback(async () => {
        if (!guessPrompt.trim()) {
            Alert.alert('Нужно описание', 'Опиши фильм хотя бы в 1–2 предложениях.');
            return;
        }

        setGuessLoading(true);
        setErrorMsg(null);

        try {
            const status = await syncProviderStatus();

            if (!status.configured) {
                setGuessResults([]);
                setHasGuessed(false);
                throw new Error(status.reason || 'AI-провайдер не настроен.');
            }

            const data = await guessMoviesByDescription(guessPrompt);
            const excludeKeys = await buildExistingLibraryKeys();
            const resolved = await resolveRecommendationsToTmdb(data, excludeKeys);

            if (data.length > 0 && resolved.length === 0) {
                setHasGuessed(false);
                setErrorMsg('ИИ предложил варианты, но все либо не нашлись в TMDB, либо уже есть в вашей библиотеке.');
                return;
            }

            setGuessResults(resolved);
            setHasGuessed(true);
        } catch (e) {
            console.error('Ошибка угадывания фильма:', e);
            setGuessResults([]);
            setHasGuessed(false);
            setErrorMsg(e instanceof Error ? e.message : 'Не удалось обработать описание фильма');
        } finally {
            setGuessLoading(false);
        }
    }, [guessPrompt, syncProviderStatus]);

    if (configured === null) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Проверяю настройки AI-провайдера...</Text>
            </View>
        );
    }

    if (!configured) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="sparkles-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>AI-провайдер не настроен</Text>
                <Text style={styles.emptyText}>
                    {providerHint || 'Откройте Настройки → Провайдеры и включите AI-провайдер с API-ключом.'}
                </Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.title}>ИИ-рекомендации</Text>
                    <Text style={styles.providerBadge}>Активный провайдер: {providerLabel}</Text>
                </View>
                <TouchableOpacity style={styles.refreshButton} onPress={loadRecommendations}>
                    <Ionicons name="refresh" size={22} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.preferencesCard}>
                <Text style={styles.sectionTitle}>Подбор по твоим вкусам</Text>
                <Text style={styles.cardIntro}>
                    Опиши, что нравится — ИИ подберёт фильмы и сериалы и покажет их карточками.
                </Text>

                <Text style={styles.label}>Опиши, что тебе нравится</Text>
                <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="Например: люблю мрачную фантастику, сильную драму, умные сюжеты, без глупой комедии"
                    placeholderTextColor={colors.textMuted}
                    value={freeformPrompt}
                    onChangeText={setFreeformPrompt}
                    multiline
                    textAlignVertical="top"
                />

                <Text style={styles.label}>Любимые жанры</Text>
                <TextInput
                    style={styles.input}
                    placeholder="фантастика, триллер, драма"
                    placeholderTextColor={colors.textMuted}
                    value={favoriteGenres}
                    onChangeText={setFavoriteGenres}
                />

                <Text style={styles.label}>Жанры, которые не нравятся</Text>
                <TextInput
                    style={styles.input}
                    placeholder="ужасы, подростковая комедия"
                    placeholderTextColor={colors.textMuted}
                    value={dislikedGenres}
                    onChangeText={setDislikedGenres}
                />

                <Text style={styles.label}>Любимые фильмы / сериалы</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Interstellar, Dark, Blade Runner 2049"
                    placeholderTextColor={colors.textMuted}
                    value={favoriteTitles}
                    onChangeText={setFavoriteTitles}
                />

                <Text style={styles.label}>Нужное настроение / атмосфера</Text>
                <TextInput
                    style={styles.input}
                    placeholder="напряжённо, атмосферно, умно, медленно"
                    placeholderTextColor={colors.textMuted}
                    value={moodKeywords}
                    onChangeText={setMoodKeywords}
                />

                <Text style={styles.label}>Чего избегать</Text>
                <TextInput
                    style={styles.input}
                    placeholder="скучно, слишком детское, банальный сюжет"
                    placeholderTextColor={colors.textMuted}
                    value={avoidKeywords}
                    onChangeText={setAvoidKeywords}
                />

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={savePreferences}
                        disabled={savingPreferences}
                    >
                        <Ionicons name="save-outline" size={18} color={colors.textPrimary} />
                        <Text style={styles.actionButtonText}>
                            {savingPreferences ? 'Сохраняю...' : 'Сохранить'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.primaryButton]}
                        onPress={loadRecommendations}
                        disabled={loading}
                    >
                        <Ionicons name="sparkles-outline" size={18} color={colors.textPrimary} />
                        <Text style={styles.actionButtonText}>
                            {loading ? 'Генерирую...' : 'Подобрать'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.preferencesCard}>
                <Text style={styles.sectionTitle}>Угадать фильм по описанию</Text>
                <Text style={styles.cardIntro}>
                    Опиши сюжет, героев, атмосферу или отдельные сцены — ИИ предложит наиболее вероятные варианты.
                </Text>
                <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="Например: там команда супергероев, один зелёный огромный, другой с молотом..."
                    placeholderTextColor={colors.textMuted}
                    value={guessPrompt}
                    onChangeText={setGuessPrompt}
                    multiline
                    textAlignVertical="top"
                />
                <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton, styles.singleActionButton]}
                    onPress={handleGuessMovie}
                    disabled={guessLoading}
                >
                    <Ionicons name="help-circle-outline" size={18} color={colors.textPrimary} />
                    <Text style={styles.actionButtonText}>
                        {guessLoading ? 'Думаю...' : 'Угадать фильм'}
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerContainerInline}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>ИИ подбирает фильмы по твоим предпочтениям...</Text>
                </View>
            ) : !hasLoaded ? (
                <View style={styles.infoCard}>
                    <Ionicons name="sparkles" size={28} color={colors.primary} />
                    <Text style={styles.infoTitle}>Готово к подбору</Text>
                    <Text style={styles.infoText}>
                        Введи свои предпочтения и нажми «Подобрать». Результаты будут показаны карточками с постерами.
                    </Text>
                </View>
            ) : recommendations.length === 0 ? (
                <View style={styles.infoCard}>
                    <Ionicons name="help-circle-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.infoTitle}>Недостаточно данных</Text>
                    <Text style={styles.infoText}>
                        Заполни предпочтения выше (что нравится, любимые жанры или фильмы) и нажми «Подобрать».
                    </Text>
                </View>
            ) : (
                <View style={styles.resultsSection}>
                    <Text style={styles.resultsTitle}>Что посмотреть дальше</Text>
                    {recommendations.map((item) => (
                        <SearchCard
                            key={`${item.media_type || 'movie'}-${item.id}`}
                            item={item}
                            onPress={(selected) => setSelectedItem(selected)}
                        />
                    ))}
                </View>
            )}

            {guessLoading ? (
                <View style={styles.centerContainerInline}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>ИИ пытается угадать фильм по описанию...</Text>
                </View>
            ) : hasGuessed ? (
                guessResults.length > 0 ? (
                    <View style={styles.resultsSection}>
                        <Text style={styles.resultsTitle}>Похожие варианты</Text>
                        {guessResults.map((item) => (
                            <SearchCard
                                key={`guess-${item.media_type || 'movie'}-${item.id}`}
                                item={item}
                                onPress={(selected) => setSelectedItem(selected)}
                            />
                        ))}
                    </View>
                ) : (
                    <View style={styles.infoCard}>
                        <Ionicons name="search-outline" size={28} color={colors.textMuted} />
                        <Text style={styles.infoTitle}>Пока нет догадок</Text>
                        <Text style={styles.infoText}>
                            Попробуй добавить больше деталей: жанр, актёров, эпоху, отдельные сцены или концовку.
                        </Text>
                    </View>
                )
            ) : null}

            {errorMsg ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
            ) : null}

            <MovieDetailsModal
                visible={!!selectedItem}
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
            />
        </ScrollView>
    );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        content: {
            paddingBottom: SPACING.xl,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.sm,
        },
        headerTextWrap: {
            flex: 1,
            paddingRight: SPACING.md,
        },
        title: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.xl,
            fontWeight: 'bold',
        },
        providerBadge: {
            color: colors.primaryLight,
            fontSize: FONT_SIZES.xs,
            marginTop: 4,
        },
        refreshButton: {
            padding: SPACING.sm,
        },
        preferencesCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            marginHorizontal: SPACING.md,
            marginBottom: SPACING.md,
            padding: SPACING.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        sectionTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.lg,
            fontWeight: '700',
            marginBottom: SPACING.sm,
        },
        cardIntro: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
            marginBottom: SPACING.sm,
        },
        label: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            marginBottom: SPACING.xs,
            marginTop: SPACING.sm,
        },
        input: {
            backgroundColor: colors.surfaceLight,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: RADIUS.md,
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.md,
        },
        multilineInput: {
            minHeight: 110,
        },
        actionRow: {
            flexDirection: 'row',
            gap: SPACING.sm,
            marginTop: SPACING.lg,
        },
        actionButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.sm,
            minHeight: 48,
        },
        singleActionButton: {
            marginTop: SPACING.md,
        },
        primaryButton: {
            backgroundColor: colors.primary,
        },
        secondaryButton: {
            backgroundColor: colors.surfaceLight,
        },
        actionButtonText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginLeft: SPACING.xs,
            textAlign: 'center',
        },
        centerContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: SPACING.xl,
            backgroundColor: colors.background,
        },
        centerContainerInline: {
            justifyContent: 'center',
            alignItems: 'center',
            padding: SPACING.xl,
        },
        loadingText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.md,
            marginTop: SPACING.md,
            textAlign: 'center',
        },
        emptyTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.xl,
            fontWeight: 'bold',
            marginTop: SPACING.md,
            marginBottom: SPACING.sm,
            textAlign: 'center',
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.md,
            textAlign: 'center',
            lineHeight: 22,
        },
        infoCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            marginHorizontal: SPACING.md,
            marginBottom: SPACING.md,
            padding: SPACING.lg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
        },
        infoTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.lg,
            fontWeight: '700',
            marginTop: SPACING.sm,
            marginBottom: SPACING.sm,
            textAlign: 'center',
        },
        infoText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
            textAlign: 'center',
        },
        resultsSection: {
            marginHorizontal: SPACING.md,
            marginBottom: SPACING.md,
        },
        resultsTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.lg,
            fontWeight: '700',
            marginBottom: SPACING.sm,
        },
        errorBox: {
            marginHorizontal: SPACING.md,
            marginBottom: SPACING.md,
            padding: SPACING.md,
            borderRadius: RADIUS.md,
            backgroundColor: `${colors.danger}22`,
            borderWidth: 1,
            borderColor: `${colors.danger}55`,
        },
        errorText: {
            color: colors.danger,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
            textAlign: 'center',
        },
    });
}
