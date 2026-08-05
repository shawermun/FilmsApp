/**
 * Карточка результата поиска — показывает рейтинг TMDB
 * и позволяет сразу добавить фильм/сериал в библиотеку.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TMDBSearchResult, WatchStatus } from '../types';
import { COLORS, SPACING, FONT_SIZES, RADIUS } from '../constants/theme';
import { getPosterUrl } from '../api/tmdb';
import { addOrUpdateMovie, findMovieByTmdbId, updateMovieStatus } from '../database/db';
import { WATCH_STATUS_META } from '../constants/movieStatus';
import { StatusPickerModal } from './StatusPickerModal';

interface SearchCardProps {
    item: TMDBSearchResult;
    onPress?: (item: TMDBSearchResult) => void;
}

export function SearchCard({ item, onPress }: SearchCardProps) {
    const [libraryStatus, setLibraryStatus] = useState<WatchStatus | null>(null);
    const [statusPickerVisible, setStatusPickerVisible] = useState(false);
    const posterUrl = getPosterUrl(item.poster_path);
    const title = item.title || item.name || 'Без названия';
    const year = (item.release_date || item.first_air_date || '').split('-')[0];
    const mediaLabel = item.media_type === 'tv' ? 'Сериал' : 'Фильм';
    const statusMeta = libraryStatus ? WATCH_STATUS_META[libraryStatus] : null;
    const rating = typeof item.vote_average === 'number' ? item.vote_average : 0;

    useEffect(() => {
        let active = true;

        async function syncStatus() {
            const existing = await findMovieByTmdbId(item.id);
            if (active) {
                setLibraryStatus(existing?.status ?? null);
            }
        }

        syncStatus();

        return () => {
            active = false;
        };
    }, [item.id]);

    const handleSelectStatus = async (status: WatchStatus) => {
        try {
            const existing = await findMovieByTmdbId(item.id);
            const now = new Date().toISOString();

            if (existing?.id) {
                await updateMovieStatus(existing.id, status);
                setLibraryStatus(status);
                return;
            }

            await addOrUpdateMovie({
                tmdb_id: item.id,
                media_type: item.media_type ?? 'movie',
                title,
                poster_path: item.poster_path,
                release_date: item.release_date || item.first_air_date || null,
                overview: item.overview || null,
                status,
                rating: 0,
                review: null,
                created_at: now,
                updated_at: now,
            });

            setLibraryStatus(status);
        } catch (error) {
            console.error('Ошибка сохранения фильма:', error);
        }
    };

    return (
        <>
            <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={() => onPress?.(item)}>
                <View style={styles.posterContainer}>
                    {posterUrl ? (
                        <Image source={{ uri: posterUrl }} style={styles.poster} />
                    ) : (
                        <View style={styles.posterPlaceholder}>
                            <Text style={styles.posterPlaceholderText}>Нет фото</Text>
                        </View>
                    )}
                </View>

                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={2}>
                        {title}
                    </Text>

                    <View style={styles.metaRow}>
                        <Text style={styles.subtitle}>
                            {mediaLabel}
                            {year ? ` • ${year}` : ''}
                        </Text>

                        {rating > 0 ? (
                            <View style={styles.ratingBadge}>
                                <Ionicons name="star" size={12} color={COLORS.star} />
                                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                            </View>
                        ) : (
                            <View style={styles.ratingBadgeMuted}>
                                <Text style={styles.ratingTextMuted}>Без рейтинга</Text>
                            </View>
                        )}
                    </View>

                    {item.overview ? (
                        <Text style={styles.overview} numberOfLines={3}>
                            {item.overview}
                        </Text>
                    ) : null}

                    {statusMeta ? (
                        <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}22` }]}> 
                            <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
                            <Text style={[styles.statusText, { color: statusMeta.color }]}> 
                                {statusMeta.label}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <TouchableOpacity
                    style={[styles.addButton, statusMeta && { backgroundColor: statusMeta.color }]}
                    onPress={() => setStatusPickerVisible(true)}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name={statusMeta ? 'swap-horizontal' : 'add'}
                        size={20}
                        color={COLORS.textPrimary}
                    />
                    <Text style={styles.addButtonText}>
                        {statusMeta ? 'Статус' : 'Добавить'}
                    </Text>
                </TouchableOpacity>
            </TouchableOpacity>

            <StatusPickerModal
                visible={statusPickerVisible}
                currentStatus={libraryStatus}
                title={libraryStatus ? 'Изменить статус фильма' : 'Куда добавить фильм?'}
                onClose={() => setStatusPickerVisible(false)}
                onSelect={handleSelectStatus}
            />
        </>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        marginBottom: SPACING.md,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    posterContainer: {
        width: 92,
        height: 140,
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    posterPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    posterPlaceholderText: {
        color: COLORS.textMuted,
        fontSize: FONT_SIZES.xs,
    },
    info: {
        flex: 1,
        padding: SPACING.md,
        justifyContent: 'center',
    },
    title: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: 'bold',
        marginBottom: SPACING.xs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.xs,
        gap: SPACING.sm,
    },
    subtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        flex: 1,
    },
    overview: {
        color: COLORS.textMuted,
        fontSize: FONT_SIZES.xs,
        lineHeight: 16,
    },
    addButton: {
        width: 72,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xs,
    },
    addButtonText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        marginTop: 4,
        textAlign: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: RADIUS.xl,
        marginTop: SPACING.sm,
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
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.12)',
        borderRadius: RADIUS.xl,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    ratingBadgeMuted: {
        borderRadius: RADIUS.xl,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 5,
        backgroundColor: COLORS.surfaceLight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    ratingText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        marginLeft: 4,
    },
    ratingTextMuted: {
        color: COLORS.textMuted,
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
    },
});
