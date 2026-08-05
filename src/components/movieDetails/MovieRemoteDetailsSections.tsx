import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TMDBCastMember, TMDBCrewMember } from '../../types';
import { FONT_SIZES, RADIUS, SPACING } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { getPosterUrl, getProfileUrl } from '../../api/tmdb';

interface MovieRemoteDetailsSectionsProps {
    isSparseLibraryEntry: boolean;
    overview: string | null;
    genresLabel: string;
    runtimeLabel: string;
    audienceRating: string;
    voteCount?: number;
    reviewSummary: string;
    directors: TMDBCrewMember[];
    writers: TMDBCrewMember[];
    extraCrew: TMDBCrewMember[];
    showAllCrew: boolean;
    onToggleCrew: () => void;
    topCast: TMDBCastMember[];
    interestingFacts: string[];
    onPressPerson: (person: TMDBCastMember | TMDBCrewMember) => void;
}

export function MovieRemoteDetailsSections({
    isSparseLibraryEntry,
    overview,
    genresLabel,
    runtimeLabel,
    audienceRating,
    voteCount,
    reviewSummary,
    directors,
    writers,
    extraCrew,
    showAllCrew,
    onToggleCrew,
    topCast,
    interestingFacts,
    onPressPerson,
}: MovieRemoteDetailsSectionsProps) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const renderPersonCard = (person: TMDBCastMember | TMDBCrewMember, subtitle?: string) => {
        const imageUrl = getProfileUrl(person.profile_path);

        return (
            <TouchableOpacity
                key={`${person.id}-${subtitle || person.name}`}
                style={styles.personCard}
                activeOpacity={0.85}
                onPress={() => onPressPerson(person)}
            >
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.personAvatar} />
                ) : (
                    <View style={[styles.personAvatar, styles.personAvatarFallback]}>
                        <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                    </View>
                )}
                <View style={styles.personInfo}>
                    <Text style={styles.personName} numberOfLines={1}>{person.name}</Text>
                    {subtitle ? <Text style={styles.personSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
                </View>
            </TouchableOpacity>
        );
    };

    if (isSparseLibraryEntry) {
        return (
            <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Локальная запись</Text>
                <Text style={styles.infoText}>
                    Эта запись была добавлена без карточки TMDB, поэтому здесь нет постера, актёров и расширенных фактов.
                    Всё ещё можно удобно менять статус, поставить личную оценку и написать свой отзыв.
                    Если нужна полная карточка — найди фильм через экран «Поиск» и открой его оттуда.
                </Text>
            </View>
        );
    }

    return (
        <>
            <View style={styles.metadataGrid}>
                <View style={styles.metadataCard}>
                    <Text style={styles.metadataLabel}>Жанры</Text>
                    <Text style={styles.metadataValue}>{genresLabel}</Text>
                </View>
                <View style={styles.metadataCard}>
                    <Text style={styles.metadataLabel}>Длительность</Text>
                    <Text style={styles.metadataValue}>{runtimeLabel}</Text>
                </View>
            </View>

            <View style={styles.reviewInsightsSection}>
                <View style={styles.tmdbScoreCard}>
                    <Text style={styles.scoreLabel}>Рейтинг TMDB</Text>
                    <Text style={styles.scoreValue}>{audienceRating}</Text>
                    <Text style={styles.scoreSubtext}>
                        {voteCount ? `${voteCount.toLocaleString('ru-RU')} оценок пользователей` : 'Пока недостаточно оценок'}
                    </Text>
                </View>

                <View style={styles.summaryCard}>
                    <Text style={styles.scoreLabel}>Краткая сводка отзывов</Text>
                    <Text style={styles.summaryText} numberOfLines={4} ellipsizeMode="tail">{reviewSummary}</Text>
                </View>
            </View>

            {overview ? (
                <View style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>О чём фильм</Text>
                    <Text style={styles.infoText}>{overview}</Text>
                </View>
            ) : null}

            <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Режиссёр и сценарий</Text>
                {directors.length ? (
                    <>
                        <Text style={styles.groupLabel}>Режиссёр</Text>
                        {directors.map((person) => renderPersonCard(person, person.job))}
                    </>
                ) : null}

                {writers.length ? (
                    <>
                        <Text style={[styles.groupLabel, directors.length ? styles.groupLabelSpacing : null]}>Сценарий</Text>
                        {writers.map((person) => renderPersonCard(person, person.job))}
                    </>
                ) : null}

                {!directors.length && !writers.length ? (
                    <Text style={styles.infoText}>Состав команды появится, когда будут доступны подробности TMDB.</Text>
                ) : null}

                {extraCrew.length ? (
                    <>
                        <TouchableOpacity style={styles.moreButton} onPress={onToggleCrew}>
                            <Text style={styles.moreButtonText}>{showAllCrew ? 'Скрыть остальную команду' : 'Ещё команда'}</Text>
                            <Ionicons name={showAllCrew ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
                        </TouchableOpacity>
                        {showAllCrew ? extraCrew.map((person) => renderPersonCard(person, person.job)) : null}
                    </>
                ) : null}
            </View>

            <View style={styles.infoCard}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Актёры</Text>
                    <Text style={styles.sectionHelper}>Нажми, чтобы открыть фильмографию</Text>
                </View>
                {topCast.length > 0 ? (
                    topCast.map((castMember) => renderPersonCard(castMember, castMember.character))
                ) : (
                    <Text style={styles.infoText}>Список актёров загрузится, когда будет доступен TMDB API.</Text>
                )}
            </View>

            <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Интересные факты без спойлеров</Text>
                {interestingFacts.length > 0 ? (
                    interestingFacts.map((fact) => (
                        <View key={fact} style={styles.factRow}>
                            <Ionicons name="sparkles-outline" size={16} color={colors.primaryLight} />
                            <Text style={styles.factText}>{fact}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.infoText}>
                        Здесь появятся факты о языке, производстве и статусе релиза, когда загрузятся детали фильма.
                    </Text>
                )}
            </View>
        </>
    );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
    return StyleSheet.create({
        metadataGrid: {
            flexDirection: 'row',
            gap: SPACING.md,
            marginBottom: SPACING.md,
        },
        metadataCard: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.md,
        },
        metadataLabel: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            marginBottom: SPACING.xs,
        },
        metadataValue: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.md,
            fontWeight: '600',
            lineHeight: 22,
        },
        reviewInsightsSection: {
            marginBottom: SPACING.md,
            gap: SPACING.sm,
        },
        tmdbScoreCard: {
            alignSelf: 'flex-start',
            minWidth: 148,
            maxWidth: 190,
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: SPACING.sm,
            paddingHorizontal: SPACING.md,
        },
        summaryCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.md,
        },
        scoreLabel: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            marginBottom: SPACING.xs,
        },
        scoreValue: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.xl,
            fontWeight: '700',
            marginBottom: 2,
        },
        scoreSubtext: {
            color: colors.textMuted,
            fontSize: FONT_SIZES.xs,
            lineHeight: 16,
        },
        summaryText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 19,
        },
        infoCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.md,
            marginBottom: SPACING.md,
        },
        sectionHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: SPACING.sm,
        },
        sectionTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.md,
            fontWeight: '700',
            marginBottom: SPACING.sm,
        },
        sectionHelper: {
            color: colors.textMuted,
            fontSize: FONT_SIZES.xs,
            marginBottom: SPACING.sm,
        },
        infoText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 22,
        },
        groupLabel: {
            color: colors.primaryLight,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginBottom: SPACING.sm,
        },
        groupLabelSpacing: {
            marginTop: SPACING.md,
        },
        personCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceLight,
            borderRadius: RADIUS.md,
            padding: SPACING.sm,
            marginBottom: SPACING.sm,
        },
        personAvatar: {
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.inputBg,
        },
        personAvatarFallback: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        personInfo: {
            flex: 1,
            marginLeft: SPACING.sm,
        },
        personName: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '600',
        },
        personSubtitle: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.xs,
            marginTop: 2,
        },
        moreButton: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            marginTop: SPACING.xs,
            marginBottom: SPACING.sm,
        },
        moreButtonText: {
            color: colors.primary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginRight: SPACING.xs,
        },
        factRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginBottom: SPACING.sm,
        },
        factText: {
            flex: 1,
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
            marginLeft: SPACING.sm,
        },
    });
}
