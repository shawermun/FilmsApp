/**
 * Экран "Мои отзывы" — список всех фильмов, на которые пользователь
 * поставил оценку или написал отзыв. Отсюда можно открыть карточку
 * и отредактировать свою оценку/мнение.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MovieDetailsModal } from '../components/MovieDetailsModal';
import { deleteMovie, getMoviesWithReviews, updateMovieRatingAndReview } from '../database/db';
import { getPosterUrl } from '../api/tmdb';
import type { Movie } from '../types';
import { SPACING, FONT_SIZES, RADIUS } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';

export default function ReviewsScreen() {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();

    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

    const loadReviews = useCallback(async () => {
        try {
            setError(null);
            const data = await getMoviesWithReviews();
            setMovies(data);
        } catch (e) {
            console.error('Ошибка загрузки отзывов:', e);
            setError(e instanceof Error ? e.message : 'Не удалось загрузить отзывы');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadReviews();
        }, [loadReviews]),
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadReviews();
    };

    const handleMovieLongPress = useCallback(
        (movie: Movie) => {
            if (!movie.id) return;

            Alert.alert(
                movie.title,
                'Что сделать с этой записью?',
                [
                    { text: 'Отмена', style: 'cancel' },
                    {
                        text: 'Удалить только оценку и отзыв',
                        onPress: () => {
                            Alert.alert(
                                'Удалить оценку и отзыв?',
                                'Фильм останется в библиотеке, но твоя оценка и текст отзыва будут стёрты.',
                                [
                                    { text: 'Отмена', style: 'cancel' },
                                    {
                                        text: 'Удалить',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                await updateMovieRatingAndReview(movie.id!, 0, null);
                                                loadReviews();
                                            } catch (e) {
                                                Alert.alert(
                                                    'Ошибка',
                                                    e instanceof Error ? e.message : 'Не удалось удалить отзыв',
                                                );
                                            }
                                        },
                                    },
                                ],
                            );
                        },
                    },
                    {
                        text: 'Удалить из библиотеки',
                        style: 'destructive',
                        onPress: () => {
                            Alert.alert(
                                'Удалить запись?',
                                `«${movie.title}» будет полностью удалена из библиотеки.`,
                                [
                                    { text: 'Отмена', style: 'cancel' },
                                    {
                                        text: 'Удалить',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                await deleteMovie(movie.id!);
                                                loadReviews();
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
        [loadReviews],
    );

    const renderItem = ({ item }: { item: Movie }) => {
        const posterUrl = getPosterUrl(item.poster_path);
        const year = item.release_date?.split('-')[0];
        const reviewText = item.review?.trim() ?? '';

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => setSelectedMovie(item)}
                onLongPress={() => handleMovieLongPress(item)}
                delayLongPress={400}
                activeOpacity={0.9}
            >
                {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
                ) : (
                    <View style={[styles.poster, styles.posterFallback]}>
                        <Ionicons name="film-outline" size={22} color={colors.textMuted} />
                    </View>
                )}

                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.cardMeta}>
                        {item.media_type === 'tv' ? 'Сериал' : 'Фильм'}{year ? ` • ${year}` : ''}
                    </Text>

                    {item.rating > 0 ? (
                        <View style={styles.ratingRow}>
                            <Text style={styles.star}>★</Text>
                            <Text style={styles.ratingText}>{item.rating}/10</Text>
                        </View>
                    ) : (
                        <Text style={styles.noRatingText}>Без оценки</Text>
                    )}

                    {reviewText ? (
                        <Text style={styles.reviewText} numberOfLines={3}>{reviewText}</Text>
                    ) : (
                        <Text style={styles.noReviewText}>Отзыв не написан — открой карточку, чтобы добавить.</Text>
                    )}
                </View>

                <View style={styles.chevronWrap}>
                    <Text style={styles.chevron}>›</Text>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Загружаю отзывы…</Text>
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
                        loadReviews();
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
                <FlatList
                    data={movies}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={
                        movies.length === 0 ? styles.emptyListContainer : styles.listContainer
                    }
                    ListHeaderComponent={
                        movies.length > 0 ? (
                            <Text style={styles.summaryText}>
                                Здесь собраны все фильмы и сериалы, которым ты поставил оценку или написал отзыв.
                            </Text>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Ionicons name="chatbox-ellipses-outline" size={44} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>Отзывов пока нет</Text>
                            <Text style={styles.emptySubtitle}>
                                Открой карточку фильма в библиотеке или поиске и поставь оценку — фильм появится здесь.
                            </Text>
                        </View>
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    initialNumToRender={10}
                    windowSize={7}
                    removeClippedSubviews
                />
            </View>

            <MovieDetailsModal
                visible={!!selectedMovie}
                item={selectedMovie}
                onClose={() => setSelectedMovie(null)}
                onLibraryChanged={loadReviews}
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
        listContainer: {
            padding: SPACING.md,
        },
        emptyListContainer: {
            flexGrow: 1,
            padding: SPACING.xl,
            alignItems: 'center',
            justifyContent: 'center',
        },
        summaryText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
            marginBottom: SPACING.md,
        },
        card: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            marginBottom: SPACING.md,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
        },
        poster: {
            width: 80,
            height: 120,
            backgroundColor: colors.surfaceLight,
        },
        posterFallback: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardInfo: {
            flex: 1,
            padding: SPACING.md,
            justifyContent: 'center',
        },
        cardTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.md,
            fontWeight: '700',
            marginBottom: 2,
        },
        cardMeta: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.xs,
            marginBottom: SPACING.sm,
        },
        ratingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: SPACING.xs,
        },
        star: {
            color: colors.star,
            fontSize: FONT_SIZES.md,
            marginRight: SPACING.xs,
        },
        ratingText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
        },
        noRatingText: {
            color: colors.textMuted,
            fontSize: FONT_SIZES.xs,
            marginBottom: SPACING.xs,
        },
        reviewText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
        },
        noReviewText: {
            color: colors.textMuted,
            fontSize: FONT_SIZES.xs,
            lineHeight: 18,
        },
        chevronWrap: {
            justifyContent: 'center',
            paddingRight: SPACING.md,
        },
        chevron: {
            color: colors.textMuted,
            fontSize: 28,
            lineHeight: 28,
        },
        emptyBox: {
            alignItems: 'center',
            maxWidth: 280,
        },
        emptyTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.xl,
            fontWeight: 'bold',
            marginTop: SPACING.md,
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