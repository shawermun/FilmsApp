import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WatchStatus } from '../types';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '../constants/theme';
import { WATCH_STATUS_OPTIONS } from '../constants/movieStatus';

interface StatusPickerModalProps {
    visible: boolean;
    title?: string;
    currentStatus?: WatchStatus | null;
    onClose: () => void;
    onSelect: (status: WatchStatus) => void;
}

export function StatusPickerModal({
    visible,
    title = 'Выберите статус',
    currentStatus,
    onClose,
    onSelect,
}: StatusPickerModalProps) {
    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>
                        Сразу добавим фильм в нужный раздел библиотеки.
                    </Text>

                    {WATCH_STATUS_OPTIONS.map((option) => {
                        const active = option.value === currentStatus;

                        return (
                            <TouchableOpacity
                                key={option.value}
                                style={[styles.option, active && styles.optionActive]}
                                activeOpacity={0.85}
                                onPress={() => {
                                    onSelect(option.value);
                                    onClose();
                                }}
                            >
                                <View style={[styles.iconWrap, { backgroundColor: `${option.color}22` }]}>
                                    <Ionicons name={option.icon as any} size={20} color={option.color} />
                                </View>

                                <View style={styles.optionTextWrap}>
                                    <Text style={styles.optionTitle}>{option.label}</Text>
                                    <Text style={styles.optionHint}>
                                        {option.value === 'planned' && 'Оставить на будущее'}
                                        {option.value === 'watching' && 'Сейчас в процессе просмотра'}
                                        {option.value === 'completed' && 'Уже посмотрено'}
                                        {option.value === 'dropped' && 'Отложено или брошено'}
                                    </Text>
                                </View>

                                {active ? (
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={22}
                                        color={option.color}
                                    />
                                ) : (
                                    <Ionicons
                                        name="chevron-forward"
                                        size={20}
                                        color={COLORS.textMuted}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'center',
        padding: SPACING.lg,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    title: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
    },
    subtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
        marginTop: SPACING.xs,
        marginBottom: SPACING.lg,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.sm,
        borderRadius: RADIUS.md,
    },
    optionActive: {
        backgroundColor: COLORS.surfaceLight,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    optionTextWrap: {
        flex: 1,
    },
    optionTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
    },
    optionHint: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        marginTop: 2,
    },
});