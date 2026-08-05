import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZES, RADIUS, SPACING } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';

interface StatusMeta {
    label: string;
    color: string;
}

interface MovieHeroSectionProps {
    title: string;
    mediaType: 'movie' | 'tv';
    year?: string;
    tagline?: string;
    posterUrl: string | null;
    isSparseLibraryEntry: boolean;
    statusMeta: StatusMeta | null;
}

function translateMediaType(mediaType: 'movie' | 'tv'): string {
    return mediaType === 'tv' ? 'Сериал' : 'Фильм';
}

export function MovieHeroSection({
    title,
    mediaType,
    year,
    tagline,
    posterUrl,
    isSparseLibraryEntry,
    statusMeta,
}: MovieHeroSectionProps) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    if (isSparseLibraryEntry) {
        return (
            <View style={styles.localEntryHero}>
                <View style={styles.localEntryIconWrap}>
                    <Ionicons name="document-text-outline" size={32} color={colors.primary} />
                </View>
                <View style={styles.localEntryContent}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.metaText}>Локальная запись без карточки TMDB</Text>
                    {statusMeta ? (
                        <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}22` }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
                            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                        </View>
                    ) : (
                        <View style={styles.statusHintRow}>
                            <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
                            <Text style={styles.statusHintText}>Запись ещё не добавлена в библиотеку</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.heroCard}>
            {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.poster} />
            ) : (
                <View style={[styles.poster, styles.posterFallback]}>
                    <Ionicons name="film-outline" size={36} color={colors.textMuted} />
                </View>
            )}

            <View style={styles.heroInfo}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.metaText}>
                    {translateMediaType(mediaType)}{year ? ` • ${year}` : ''}
                </Text>

                {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}

                {statusMeta ? (
                    <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}22` }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
                        <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                    </View>
                ) : (
                    <View style={styles.statusHintRow}>
                        <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
                        <Text style={styles.statusHintText}>Фильм ещё не добавлен в библиотеку</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
    return StyleSheet.create({
        heroCard: {
            flexDirection: 'row',
            marginBottom: SPACING.md,
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
        },
        poster: {
            width: 130,
            height: 195,
            backgroundColor: colors.surfaceLight,
        },
        posterFallback: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        heroInfo: {
            flex: 1,
            padding: SPACING.md,
            justifyContent: 'center',
        },
        localEntryHero: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: SPACING.md,
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            padding: SPACING.md,
        },
        localEntryIconWrap: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: `${colors.primary}14`,
            alignItems: 'center',
            justifyContent: 'center',
        },
        localEntryContent: {
            flex: 1,
            marginLeft: SPACING.md,
        },
        title: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.xl,
            fontWeight: '700',
            marginBottom: SPACING.xs,
        },
        metaText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            marginBottom: SPACING.sm,
        },
        tagline: {
            color: colors.primaryLight,
            fontSize: FONT_SIZES.sm,
            fontStyle: 'italic',
            marginBottom: SPACING.md,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
            borderRadius: RADIUS.xl,
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
        statusHintRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        statusHintText: {
            color: colors.primary,
            fontSize: FONT_SIZES.sm,
            marginLeft: SPACING.xs,
        },
    });
}
