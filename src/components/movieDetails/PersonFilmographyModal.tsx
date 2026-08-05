import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TMDBCastMember, TMDBCrewMember, TMDBPersonCredit, TMDBPersonDetails } from '../../types';
import { FONT_SIZES, RADIUS, SPACING } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';
import { getPosterUrl, getProfileUrl } from '../../api/tmdb';

interface PersonFilmographyModalProps {
    visible: boolean;
    selectedPerson: TMDBCastMember | TMDBCrewMember | null;
    personDetails: TMDBPersonDetails | null;
    personCredits: TMDBPersonCredit[];
    personLoading: boolean;
    personError: string | null;
    onClose: () => void;
}

export function PersonFilmographyModal({
    visible,
    selectedPerson,
    personDetails,
    personCredits,
    personLoading,
    personError,
    onClose,
}: PersonFilmographyModalProps) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.headerIconBtn}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>Фильмография</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {personLoading ? (
                        <View style={styles.centeredCard}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Загружаю фильмографию…</Text>
                        </View>
                    ) : personError ? (
                        <View style={styles.infoCard}>
                            <Text style={styles.sectionTitle}>Не удалось загрузить данные</Text>
                            <Text style={styles.infoText}>{personError}</Text>
                        </View>
                    ) : (
                        <>
                            {selectedPerson ? (
                                <View style={styles.infoCard}>
                                    <View style={styles.personHeroRow}>
                                        {getProfileUrl(personDetails?.profile_path || selectedPerson.profile_path) ? (
                                            <Image
                                                source={{ uri: getProfileUrl(personDetails?.profile_path || selectedPerson.profile_path)! }}
                                                style={styles.personHeroAvatar}
                                            />
                                        ) : (
                                            <View style={[styles.personHeroAvatar, styles.personAvatarFallback]}>
                                                <Ionicons name="person-outline" size={28} color={colors.textMuted} />
                                            </View>
                                        )}
                                        <View style={styles.personHeroText}>
                                            <Text style={styles.personHeroName}>{personDetails?.name || selectedPerson.name}</Text>
                                            <Text style={styles.personHeroSubtitle}>
                                                {personDetails?.known_for_department || ('job' in selectedPerson ? selectedPerson.job : 'Актёр')}
                                            </Text>
                                            {personDetails?.birthday ? <Text style={styles.personHeroMeta}>Дата рождения: {personDetails.birthday}</Text> : null}
                                            {personDetails?.place_of_birth ? <Text style={styles.personHeroMeta}>Место рождения: {personDetails.place_of_birth}</Text> : null}
                                        </View>
                                    </View>
                                    {personDetails?.biography ? <Text style={styles.personBio} numberOfLines={6}>{personDetails.biography}</Text> : null}
                                </View>
                            ) : null}

                            <View style={styles.infoCard}>
                                <Text style={styles.sectionTitle}>Фильмы и сериалы</Text>
                                {personCredits.length ? (
                                    personCredits.map((credit) => (
                                        <View key={`${credit.media_type}-${credit.id}`} style={styles.creditRow}>
                                            {getPosterUrl(credit.poster_path) ? (
                                                <Image source={{ uri: getPosterUrl(credit.poster_path)! }} style={styles.creditPoster} />
                                            ) : (
                                                <View style={[styles.creditPoster, styles.posterFallback]}>
                                                    <Ionicons name="film-outline" size={18} color={colors.textMuted} />
                                                </View>
                                            )}
                                            <View style={styles.creditInfo}>
                                                <Text style={styles.creditTitle}>{credit.title || credit.name || 'Без названия'}</Text>
                                                <Text style={styles.creditMeta}>
                                                    {credit.media_type === 'tv' ? 'Сериал' : 'Фильм'}
                                                    {(credit.release_date || credit.first_air_date)
                                                        ? ` • ${(credit.release_date || credit.first_air_date || '').split('-')[0]}`
                                                        : ''}
                                                </Text>
                                                <Text style={styles.creditMeta} numberOfLines={2}>{credit.character || credit.job || 'Участие в проекте'}</Text>
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={styles.infoText}>TMDB не вернул фильмографию для этого человека.</Text>
                                )}
                            </View>
                        </>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: SPACING.md,
            paddingTop: SPACING.lg,
            paddingBottom: SPACING.md,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        headerIconBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceLight,
        },
        headerSpacer: {
            width: 40,
            height: 40,
        },
        headerTitle: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: FONT_SIZES.lg,
            fontWeight: '700',
            textAlign: 'center',
            marginHorizontal: SPACING.md,
        },
        content: {
            padding: SPACING.md,
            paddingBottom: SPACING.xl,
        },
        centeredCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.lg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        loadingText: {
            color: colors.textSecondary,
            marginTop: SPACING.sm,
        },
        infoCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.md,
            marginBottom: SPACING.md,
        },
        sectionTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.md,
            fontWeight: '700',
            marginBottom: SPACING.sm,
        },
        infoText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 22,
        },
        personHeroRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        personHeroAvatar: {
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: colors.surfaceLight,
        },
        personAvatarFallback: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        personHeroText: {
            flex: 1,
            marginLeft: SPACING.md,
        },
        personHeroName: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.lg,
            fontWeight: '700',
        },
        personHeroSubtitle: {
            color: colors.primaryLight,
            fontSize: FONT_SIZES.sm,
            marginTop: 4,
        },
        personHeroMeta: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.xs,
            marginTop: 4,
        },
        personBio: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
            marginTop: SPACING.md,
        },
        creditRow: {
            flexDirection: 'row',
            backgroundColor: colors.surfaceLight,
            borderRadius: RADIUS.md,
            padding: SPACING.sm,
            marginBottom: SPACING.sm,
        },
        creditPoster: {
            width: 54,
            height: 78,
            borderRadius: RADIUS.sm,
            backgroundColor: colors.inputBg,
        },
        posterFallback: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        creditInfo: {
            flex: 1,
            marginLeft: SPACING.sm,
            justifyContent: 'center',
        },
        creditTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
        },
        creditMeta: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.xs,
            marginTop: 4,
            lineHeight: 18,
        },
    });
}
