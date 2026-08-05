/**
 * Карточка фильма — компактнее и аккуратнее показывает локальные записи,
 * у которых пока нет постера и полной карточки TMDB.
 */

import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import type { Movie } from '../types';
import { SPACING, FONT_SIZES, RADIUS } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { getPosterUrl } from '../api/tmdb';
import { WATCH_STATUS_META } from '../constants/movieStatus';

interface MovieCardProps {
    movie: Movie;
    onPress?: (movie: Movie) => void;
    onLongPress?: (movie: Movie) => void;
}

export function MovieCard({ movie, onPress, onLongPress }: MovieCardProps) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const posterUrl = getPosterUrl(movie.poster_path);
    const statusInfo = WATCH_STATUS_META[movie.status];
    const year = movie.release_date?.split('-')[0];
    const isSparseCard = !posterUrl && !movie.overview && !movie.release_date;

    return (
        <TouchableOpacity
            style={[styles.card, isSparseCard && styles.cardSparse]}
            onPress={() => onPress?.(movie)}
            onLongPress={onLongPress ? () => onLongPress(movie) : undefined}
            delayLongPress={400}
            activeOpacity={0.9}
        >
            <View style={[styles.posterContainer, isSparseCard && styles.posterContainerSparse]}>
                {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
                ) : (
                    <View style={[styles.posterPlaceholder, isSparseCard && styles.posterPlaceholderSparse]}>
                        <View style={styles.posterIconWrap}>
                            <Text style={styles.posterEmoji}>🎬</Text>
                        </View>
                        <Text style={styles.posterPlaceholderTitle}>{isSparseCard ? 'Локальная запись' : 'Карточка без постера'}</Text>
                        <Text style={styles.posterPlaceholderText}>{isSparseCard ? 'Добавлена вручную или из заметок' : 'TMDB не вернул изображение'}</Text>
                    </View>
                )}
            </View>

            <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>{movie.title}</Text>
                <Text style={styles.yearLine}>
                    {isSparseCard
                        ? 'Можно позже уточнить через поиск'
                        : [year, movie.media_type === 'tv' ? 'Сериал' : 'Фильм'].filter(Boolean).join(' • ')}
                </Text>

                <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}22` }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                </View>

                {movie.rating > 0 ? (
                    <View style={styles.ratingContainer}>
                        <Text style={styles.star}>★</Text>
                        <Text style={styles.ratingText}>{movie.rating}/10</Text>
                    </View>
                ) : movie.overview ? (
                    <Text style={styles.helperText} numberOfLines={2}>{movie.overview}</Text>
                ) : (
                    <Text style={styles.helperText}>
                        Открой карточку, чтобы сменить статус, поставить оценку или оставить свой отзыв.
                    </Text>
                )}
            </View>

            <View style={styles.chevronWrap}>
                <Text style={styles.chevron}>›</Text>
            </View>
        </TouchableOpacity>
    );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
    return StyleSheet.create({
        card: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            marginBottom: SPACING.md,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.18,
            shadowRadius: 6,
            elevation: 4,
            borderWidth: 1,
            borderColor: colors.border,
        },
        cardSparse: {
            borderStyle: 'dashed',
        },
        posterContainer: {
            width: 104,
            height: 156,
        },
        posterContainerSparse: {
            width: 116,
        },
        poster: {
            width: '100%',
            height: '100%',
        },
        posterPlaceholder: {
            width: '100%',
            height: '100%',
            backgroundColor: colors.surfaceLight,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.md,
        },
        posterPlaceholderSparse: {
            backgroundColor: `${colors.primary}14`,
        },
        posterIconWrap: {
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: SPACING.sm,
        },
        posterEmoji: {
            fontSize: 22,
        },
        posterPlaceholderTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.xs,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: 4,
        },
        posterPlaceholderText: {
            color: colors.textMuted,
            fontSize: 11,
            lineHeight: 14,
            textAlign: 'center',
        },
        info: {
            flex: 1,
            padding: SPACING.md,
            justifyContent: 'center',
        },
        title: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.lg,
            fontWeight: 'bold',
            marginBottom: SPACING.xs,
        },
        yearLine: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            marginBottom: SPACING.sm,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
            borderRadius: RADIUS.xl,
            alignSelf: 'flex-start',
            marginBottom: SPACING.sm,
        },
        statusDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: SPACING.xs,
        },
        statusText: {
            fontSize: FONT_SIZES.xs,
            fontWeight: '700',
        },
        ratingContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        star: {
            color: colors.star,
            fontSize: FONT_SIZES.md,
            marginRight: SPACING.xs,
        },
        ratingText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '600',
        },
        helperText: {
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
    });
}
