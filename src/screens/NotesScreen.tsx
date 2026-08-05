/**
 * Экран "Заметки" — блокнот с ручным заголовком
 * и импортом списка фильмов в библиотеку.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    getAllNotes,
    addNote,
    updateNote,
    deleteNote,
    importMoviesFromNote,
} from '../database/db';
import type { Note, WatchStatus } from '../types';
import { COLORS, SPACING, FONT_SIZES, RADIUS } from '../constants/theme';

interface ParsedMovieItem {
    title: string;
    status: WatchStatus;
}

function parseMoviesFromText(content: string): ParsedMovieItem[] {
    const checkedRegex = /^(\s*[-*•]?\s*)?(\[x\]|\[X\]|☑|✅|✔|✓)\s+/;
    const uncheckedRegex = /^(\s*[-*•]?\s*)?(\[\s\]|☐|⬜|▫️|◻)\s+/;

    return content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            if (checkedRegex.test(line)) {
                return {
                    title: line.replace(checkedRegex, '').trim(),
                    status: 'completed' as WatchStatus,
                };
            }

            if (uncheckedRegex.test(line)) {
                return {
                    title: line.replace(uncheckedRegex, '').trim(),
                    status: 'planned' as WatchStatus,
                };
            }

            return {
                title: line.replace(/^[-*•]\s+/, '').trim(),
                status: 'planned' as WatchStatus,
            };
        })
        .filter((item) => item.title.length > 0);
}

export default function NotesScreen() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteText, setNoteText] = useState('');
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);

    const loadNotes = useCallback(async () => {
        try {
            const data = await getAllNotes();
            setNotes(data);
        } catch (error) {
            console.error('Ошибка загрузки заметок:', error);
        }
    }, []);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const resetEditor = () => {
        setEditingNote(null);
        setNoteTitle('');
        setNoteText('');
    };

    const closeModal = () => {
        setModalVisible(false);
        resetEditor();
    };

    const openModal = (note?: Note) => {
        if (note) {
            setEditingNote(note);
            setNoteTitle(note.title || 'Без названия');
            setNoteText(note.content);
        } else {
            resetEditor();
        }

        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!noteText.trim()) {
            Alert.alert('Пустая заметка', 'Добавьте текст заметки перед сохранением.');
            return;
        }

        setSaving(true);

        try {
            const resolvedTitle = noteTitle.trim() || 'Без названия';

            if (editingNote?.id) {
                await updateNote(editingNote.id, resolvedTitle, noteText.trim());
            } else {
                await addNote(resolvedTitle, noteText.trim());
            }

            closeModal();
            await loadNotes();
        } catch (error) {
            console.error('Ошибка сохранения заметки:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить заметку.');
        } finally {
            setSaving(false);
        }
    };

    const handleImportList = async () => {
        const items = parseMoviesFromText(noteText);

        if (!items.length) {
            Alert.alert(
                'Нечего импортировать',
                'Добавьте список фильмов. Отмеченные галочкой строки будут считаться просмотренными, остальные — запланированными.',
            );
            return;
        }

        setImporting(true);

        try {
            const result = await importMoviesFromNote(items);

            Alert.alert(
                'Импорт завершён',
                `Создано: ${result.created}\nОбновлено: ${result.updated}\nПропущено: ${result.skipped}`,
            );
        } catch (error) {
            console.error('Ошибка импорта фильмов из заметки:', error);
            Alert.alert('Ошибка', 'Не удалось разобрать и импортировать список фильмов.');
        } finally {
            setImporting(false);
        }
    };

    const handleDelete = (note: Note) => {
        if (!note.id) return;

        Alert.alert('Удалить заметку?', 'Это действие нельзя отменить.', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Удалить',
                style: 'destructive',
                onPress: async () => {
                    if (note.id === undefined) return;
                    try {
                        await deleteNote(note.id);
                        await loadNotes();
                    } catch (error) {
                        console.error('Ошибка удаления заметки:', error);
                    }
                },
            },
        ]);
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Заметки</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
                    <Ionicons name="add" size={28} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.tipCard}>
                <Ionicons name="list-outline" size={18} color={COLORS.primary} />
                <Text style={styles.tipText}>
                    Можно вставить список фильмов из заметок. Строки с галочкой попадут в
                    «Просмотрено», остальные — в «Запланировано».
                </Text>
            </View>

            {notes.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="document-text-outline" size={64} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>Нет заметок</Text>
                    <Text style={styles.emptySubtext}>
                        Нажмите +, чтобы создать первую заметку или вставить список фильмов
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={notes}
                    keyExtractor={(item) => `${item.id}`}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.noteCard}
                            onPress={() => openModal(item)}
                            onLongPress={() => handleDelete(item)}
                        >
                            <Text style={styles.noteTitle} numberOfLines={1}>
                                {item.title || 'Без названия'}
                            </Text>
                            <Text style={styles.noteContent} numberOfLines={4}>
                                {item.content}
                            </Text>
                            <Text style={styles.noteDate}>{formatDate(item.updated_at)}</Text>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={styles.listContainer}
                />
            )}

            <Modal
                animationType="slide"
                transparent={false}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={closeModal}>
                            <Ionicons name="close" size={28} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {editingNote ? 'Редактировать заметку' : 'Новая заметка'}
                        </Text>
                        <TouchableOpacity onPress={handleSave} disabled={saving}>
                            <Ionicons name="checkmark" size={28} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.modalScrollContent}>
                        <Text style={styles.fieldLabel}>Заголовок</Text>
                        <TextInput
                            style={styles.titleInput}
                            placeholder="Например: Фильмы на выходные"
                            placeholderTextColor={COLORS.textMuted}
                            value={noteTitle}
                            onChangeText={setNoteTitle}
                        />

                        <Text style={styles.fieldLabel}>Текст заметки</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder={`Пример:\n✅ Интерстеллар\n[ ] Бегущий по лезвию 2049\n• Тьма`}
                            placeholderTextColor={COLORS.textMuted}
                            value={noteText}
                            onChangeText={setNoteText}
                            multiline
                            autoFocus={!editingNote}
                            textAlignVertical="top"
                        />

                        <View style={styles.helperCard}>
                            <Text style={styles.helperTitle}>Как работает импорт списка</Text>
                            <Text style={styles.helperText}>• ✅ / ☑ / [x] → уже просмотрено</Text>
                            <Text style={styles.helperText}>• [ ] / ☐ / обычная строка → запланировано</Text>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.secondaryButton]}
                                onPress={handleImportList}
                                disabled={importing}
                            >
                                <Ionicons name="list-outline" size={18} color={COLORS.textPrimary} />
                                <Text style={styles.actionButtonText}>
                                    {importing ? 'Импортирую...' : 'Импортировать в библиотеку'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.primaryButton]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                <Ionicons name="save-outline" size={18} color={COLORS.textPrimary} />
                                <Text style={styles.actionButtonText}>
                                    {saving ? 'Сохраняю...' : 'Сохранить'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    title: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
    },
    addButton: {
        padding: SPACING.xs,
    },
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.lg,
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.sm,
        padding: SPACING.md,
    },
    tipText: {
        flex: 1,
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
        marginLeft: SPACING.sm,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    emptyText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.lg,
        fontWeight: 'bold',
        marginTop: SPACING.md,
    },
    emptySubtext: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        marginTop: SPACING.xs,
        textAlign: 'center',
    },
    listContainer: {
        padding: SPACING.md,
    },
    noteCard: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    noteTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        marginBottom: SPACING.sm,
    },
    noteContent: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        lineHeight: 22,
        marginBottom: SPACING.sm,
    },
    noteDate: {
        color: COLORS.textMuted,
        fontSize: FONT_SIZES.xs,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: SPACING.xl,
    },
    modalScrollContent: {
        padding: SPACING.md,
        paddingBottom: SPACING.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.lg,
        fontWeight: 'bold',
    },
    fieldLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        marginBottom: SPACING.xs,
        marginTop: SPACING.sm,
    },
    titleInput: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
    },
    modalInput: {
        minHeight: 260,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        padding: SPACING.md,
        marginTop: SPACING.xs,
        textAlignVertical: 'top',
    },
    helperCard: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginTop: SPACING.md,
    },
    helperTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        marginBottom: SPACING.xs,
    },
    helperText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
    },
    modalActions: {
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
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
    },
    primaryButton: {
        backgroundColor: COLORS.primary,
    },
    secondaryButton: {
        backgroundColor: COLORS.surfaceLight,
    },
    actionButtonText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        marginLeft: SPACING.xs,
        textAlign: 'center',
    },
});
