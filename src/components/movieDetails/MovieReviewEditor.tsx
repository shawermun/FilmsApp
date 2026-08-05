import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZES, RADIUS, SPACING } from '../../constants/theme';
import { useAppTheme } from '../../context/ThemeContext';

interface MovieReviewEditorProps {
    ratingDraft: number;
    reviewDraft: string;
    savingReview: boolean;
    onRatingChange: (score: number) => void;
    onReviewChange: (value: string) => void;
    onSave: () => void;
}

export function MovieReviewEditor({
    ratingDraft,
    reviewDraft,
    savingReview,
    onRatingChange,
    onReviewChange,
    onSave,
}: MovieReviewEditorProps) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Твоя оценка и отзыв</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratingRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <TouchableOpacity
                        key={score}
                        style={[styles.ratingChip, ratingDraft === score && styles.ratingChipActive]}
                        onPress={() => onRatingChange(score)}
                    >
                        <Text style={[styles.ratingChipText, ratingDraft === score && styles.ratingChipTextActive]}>{score}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <TextInput
                style={styles.reviewInput}
                multiline
                value={reviewDraft}
                onChangeText={onReviewChange}
                placeholder="Что понравилось или не понравилось? Этот отзыв сохранится локально и будет использоваться в рекомендациях."
                placeholderTextColor={colors.textMuted}
                textAlignVertical="top"
            />

            <TouchableOpacity style={styles.saveReviewButton} onPress={onSave} disabled={savingReview}>
                {savingReview ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                    <Ionicons name="save-outline" size={18} color={colors.textPrimary} />
                )}
                <Text style={styles.saveReviewButtonText}>{savingReview ? 'Сохраняю...' : 'Сохранить оценку и отзыв'}</Text>
            </TouchableOpacity>
        </View>
    );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
    return StyleSheet.create({
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
        ratingRow: {
            paddingBottom: SPACING.sm,
        },
        ratingChip: {
            width: 42,
            height: 42,
            borderRadius: 21,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: SPACING.sm,
        },
        ratingChipActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        ratingChipText: {
            color: colors.textPrimary,
            fontWeight: '700',
        },
        ratingChipTextActive: {
            color: colors.textPrimary,
        },
        reviewInput: {
            minHeight: 120,
            marginTop: SPACING.sm,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: RADIUS.md,
            padding: SPACING.md,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceLight,
            fontSize: FONT_SIZES.sm,
        },
        saveReviewButton: {
            marginTop: SPACING.md,
            backgroundColor: colors.primary,
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        saveReviewButtonText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginLeft: SPACING.xs,
        },
    });
}
