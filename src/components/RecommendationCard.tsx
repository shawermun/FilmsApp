/**
 * Карточка ИИ-рекомендации — показывает название фильма и причину рекомендации.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AIRecommendation } from '../types';
import { COLORS, SPACING, FONT_SIZES, RADIUS } from '../constants/theme';

interface RecommendationCardProps {
    item: AIRecommendation;
}

export function RecommendationCard({ item }: RecommendationCardProps) {
    return (
        <View style={styles.card}>
            <View style={styles.iconContainer}>
                <Ionicons name="sparkles" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.content}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.reason}>{item.reason}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        marginBottom: SPACING.md,
        padding: SPACING.md,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    content: {
        flex: 1,
    },
    title: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: 'bold',
        marginBottom: SPACING.xs,
    },
    reason: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
    },
});