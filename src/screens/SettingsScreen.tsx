/**
 * Экран "Настройки" — быстрые секции для API, тем, данных и информации.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Linking,
    ScrollView,
    TextInput,
    Switch,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

import { exportData, importData, clearAllData } from '../database/db';
import {
    getAllProviderSettings,
    saveProviderApiKey,
    setProviderEnabled,
    setActiveProvider,
} from '../database/settings';
import { PROVIDER_META, PROVIDER_ORDER } from '../constants/providers';
import type { ProviderSetting, ProviderType } from '../types';
import { FONT_SIZES, RADIUS, SPACING, type ThemeMode } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { validateProviderKey } from '../api/providerValidation';

type SettingsSection = 'api' | 'themes' | 'data' | 'about';

const SECTION_TABS: Array<{
    value: SettingsSection;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
        { value: 'api', label: 'API', icon: 'key-outline' },
        { value: 'themes', label: 'Темы', icon: 'color-palette-outline' },
        { value: 'data', label: 'Данные', icon: 'archive-outline' },
        { value: 'about', label: 'О проекте', icon: 'information-circle-outline' },
    ];

const THEME_OPTIONS: Array<{
    value: ThemeMode;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
        { value: 'system', title: 'Как в системе', icon: 'phone-portrait-outline' },
        { value: 'dark', title: 'Тёмная', icon: 'moon-outline' },
        { value: 'light', title: 'Дневная', icon: 'sunny-outline' },
    ];

export default function SettingsScreen() {
    const { colors, themeMode, setThemeMode } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [activeSection, setActiveSection] = useState<SettingsSection>('api');
    const [busy, setBusy] = useState(false);
    const [providers, setProviders] = useState<ProviderSetting[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(true);
    const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
    const [themeSaving, setThemeSaving] = useState(false);
    const [testingProvider, setTestingProvider] = useState<ProviderType | null>(null);
    const [pastingProvider, setPastingProvider] = useState<ProviderType | null>(null);

    const movieProviders = useMemo(
        () => providers.filter((provider) => provider.category === 'movie'),
        [providers],
    );

    const aiProviders = useMemo(
        () => providers.filter((provider) => provider.category === 'ai'),
        [providers],
    );

    const loadProviders = async () => {
        try {
            setLoadingProviders(true);
            const rows = await getAllProviderSettings();

            const sorted = [...rows].sort((a, b) => {
                return PROVIDER_ORDER.indexOf(a.provider_type) - PROVIDER_ORDER.indexOf(b.provider_type);
            });

            setProviders(sorted);

            const nextDrafts: Record<string, string> = {};
            for (const provider of sorted) {
                nextDrafts[provider.provider_type] = provider.api_key || '';
            }
            setDraftKeys(nextDrafts);
        } catch (error) {
            console.error('Ошибка загрузки провайдеров:', error);
            Alert.alert('Ошибка', 'Не удалось загрузить настройки провайдеров.');
        } finally {
            setLoadingProviders(false);
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    const handleExport = async () => {
        setBusy(true);
        try {
            const data = await exportData();
            const jsonStr = JSON.stringify(data, null, 2);
            const fileName = `films_backup_${new Date().toISOString().split('T')[0]}.json`;
            const baseDir = FileSystem.documentDirectory;

            if (!baseDir) {
                throw new Error('Не удалось получить доступ к локальной папке приложения.');
            }

            const filePath = `${baseDir}${fileName}`;

            await FileSystem.writeAsStringAsync(filePath, jsonStr, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            if (!(await Sharing.isAvailableAsync())) {
                Alert.alert('Готово', `Файл резервной копии сохранён: ${fileName}`);
                return;
            }

            await Sharing.shareAsync(filePath, {
                mimeType: 'application/json',
                dialogTitle: 'Поделиться резервной копией FilmsApp',
            });
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            Alert.alert('Ошибка', 'Не удалось экспортировать данные.');
        } finally {
            setBusy(false);
        }
    };

    const handleImport = async () => {
        setBusy(true);
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets?.[0]) {
                setBusy(false);
                return;
            }

            const fileUri = result.assets[0].uri;
            const content = await FileSystem.readAsStringAsync(fileUri, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            const data = JSON.parse(content);

            Alert.alert(
                'Импорт',
                `Загружено ${data.movies?.length || 0} фильмов и ${data.notes?.length || 0} заметок. Заменить текущие данные?`,
                [
                    { text: 'Отмена', style: 'cancel', onPress: () => setBusy(false) },
                    {
                        text: 'Заменить',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await importData(data);
                                Alert.alert('Готово', 'Данные успешно импортированы.');
                            } catch (err) {
                                console.error('Ошибка импорта данных:', err);
                                Alert.alert('Ошибка', 'Не удалось импортировать данные.');
                            } finally {
                                setBusy(false);
                            }
                        },
                    },
                ],
            );
        } catch (error) {
            console.error('Ошибка импорта:', error);
            Alert.alert('Ошибка', 'Не удалось прочитать файл.');
            setBusy(false);
        }
    };

    const handleClearData = () => {
        Alert.alert(
            'Удалить все данные?',
            'Будут удалены все фильмы и заметки. Это действие необратимо!',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить всё',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearAllData();
                            Alert.alert('Готово', 'Все данные удалены.');
                        } catch (error) {
                            console.error('Ошибка очистки:', error);
                            Alert.alert('Ошибка', 'Не удалось удалить данные.');
                        }
                    },
                },
            ],
        );
    };

    const openLink = (url: string) => {
        Linking.openURL(url).catch(() => Alert.alert('Ошибка', 'Не удалось открыть ссылку.'));
    };

    const handleDraftChange = (providerType: ProviderType, value: string) => {
        setDraftKeys((prev) => ({
            ...prev,
            [providerType]: value,
        }));
    };

    const handlePasteProviderKey = async (providerType: ProviderType) => {
        try {
            setPastingProvider(providerType);
            const clipboardText = await Clipboard.getStringAsync();
            if (!clipboardText.trim()) {
                Alert.alert('Буфер пуст', 'В буфере обмена сейчас нет текста для вставки.');
                return;
            }

            setDraftKeys((prev) => ({
                ...prev,
                [providerType]: clipboardText.trim(),
            }));
        } catch (error) {
            console.error('Ошибка вставки из буфера:', error);
            Alert.alert('Ошибка', 'Не удалось прочитать буфер обмена.');
        } finally {
            setPastingProvider(null);
        }
    };

    const handleSaveProviderKey = async (providerType: ProviderType) => {
        try {
            await saveProviderApiKey(providerType, draftKeys[providerType] || '');
            await loadProviders();
            Alert.alert('Сохранено', 'API-ключ сохранён локально на устройстве.');
        } catch (error) {
            console.error('Ошибка сохранения ключа:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить API-ключ.');
        }
    };

    const handleTestProviderKey = async (providerType: ProviderType) => {
        try {
            setTestingProvider(providerType);
            const result = await validateProviderKey(providerType, draftKeys[providerType] || '');
            Alert.alert(result.ok ? 'Ключ работает' : 'Проверка не пройдена', result.message);
        } catch (error) {
            console.error('Ошибка проверки ключа:', error);
            Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось проверить ключ.');
        } finally {
            setTestingProvider(null);
        }
    };

    const handleToggleEnabled = async (providerType: ProviderType, enabled: boolean) => {
        try {
            await setProviderEnabled(providerType, enabled);
            await loadProviders();
        } catch (error) {
            console.error('Ошибка переключения провайдера:', error);
            Alert.alert('Ошибка', 'Не удалось изменить состояние провайдера.');
        }
    };

    const handleSetActive = async (provider: ProviderSetting) => {
        try {
            if (!provider.enabled) {
                Alert.alert('Сначала включите провайдера', 'Перед выбором активного провайдера его нужно включить.');
                return;
            }

            if (!(draftKeys[provider.provider_type] || provider.api_key || '').trim()) {
                Alert.alert('Нет API-ключа', 'Сначала вставьте и сохраните API-ключ для этого провайдера.');
                return;
            }

            await saveProviderApiKey(provider.provider_type, draftKeys[provider.provider_type] || provider.api_key || '');
            await setActiveProvider(provider.category, provider.provider_type);
            await loadProviders();
            Alert.alert('Готово', 'Активный провайдер обновлён.');
        } catch (error) {
            console.error('Ошибка выбора активного провайдера:', error);
            Alert.alert('Ошибка', 'Не удалось сделать провайдера активным.');
        }
    };

    const handleThemeChange = async (mode: ThemeMode) => {
        try {
            setThemeSaving(true);
            await setThemeMode(mode);
        } catch (error) {
            console.error('Ошибка сохранения темы:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить тему приложения.');
        } finally {
            setThemeSaving(false);
        }
    };

    const renderProviderCard = (provider: ProviderSetting) => {
        const meta = PROVIDER_META[provider.provider_type];
        const draftValue = draftKeys[provider.provider_type] ?? '';
        const isTesting = testingProvider === provider.provider_type;
        const isPasting = pastingProvider === provider.provider_type;

        return (
            <View key={provider.provider_type} style={styles.providerCard}>
                <View style={styles.providerHeader}>
                    <View style={styles.providerTitleWrap}>
                        <Text style={styles.providerTitle}>{meta.label}</Text>
                        <Text style={styles.providerDescription}>{meta.description}</Text>
                    </View>

                    <View style={styles.providerHeaderRight}>
                        {provider.is_active ? (
                            <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>Активный</Text>
                            </View>
                        ) : null}
                        <Switch
                            value={!!provider.enabled}
                            onValueChange={(value) => handleToggleEnabled(provider.provider_type, value)}
                            trackColor={{ false: colors.border, true: colors.primaryLight }}
                            thumbColor={provider.enabled ? colors.primary : colors.textMuted}
                        />
                    </View>
                </View>

                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder={meta.placeholder}
                        placeholderTextColor={colors.textMuted}
                        value={draftValue}
                        onChangeText={(value) => handleDraftChange(provider.provider_type, value)}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry
                    />
                    <TouchableOpacity
                        style={styles.clipboardButton}
                        onPress={() => handlePasteProviderKey(provider.provider_type)}
                        disabled={isPasting}
                    >
                        {isPasting ? (
                            <ActivityIndicator size="small" color={colors.textPrimary} />
                        ) : (
                            <Ionicons name="clipboard-outline" size={18} color={colors.textPrimary} />
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.providerActionsRow}>
                    <TouchableOpacity
                        style={[styles.providerButton, styles.secondaryButton]}
                        onPress={() => handleTestProviderKey(provider.provider_type)}
                        disabled={isTesting}
                    >
                        {isTesting ? (
                            <ActivityIndicator size="small" color={colors.textPrimary} />
                        ) : (
                            <Ionicons name="beaker-outline" size={16} color={colors.textPrimary} />
                        )}
                        <Text style={styles.providerButtonText}>{isTesting ? 'Проверяю...' : 'Тест'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.providerButton, styles.secondaryButton]}
                        onPress={() => handleSaveProviderKey(provider.provider_type)}
                    >
                        <Ionicons name="save-outline" size={16} color={colors.textPrimary} />
                        <Text style={styles.providerButtonText}>Сохранить</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.providerButton, styles.primaryButton, styles.fullWidthButton]}
                    onPress={() => handleSetActive(provider)}
                >
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.textPrimary} />
                    <Text style={styles.providerButtonText}>Сделать активным</Text>
                </TouchableOpacity>

                {meta.helpUrl ? (
                    <TouchableOpacity style={styles.helpLink} onPress={() => openLink(meta.helpUrl!)}>
                        <Ionicons name="open-outline" size={16} color={colors.primary} />
                        <Text style={styles.helpLinkText}>Как получить ключ</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        );
    };

    const renderThemesSection = () => (
        <View style={styles.sectionCard}>
            <View style={styles.themeButtonsGrid}>
                {THEME_OPTIONS.map((option) => {
                    const active = option.value === themeMode;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[styles.themeButton, active && styles.themeButtonActive]}
                            onPress={() => handleThemeChange(option.value)}
                            activeOpacity={0.85}
                        >
                            {themeSaving && active ? (
                                <ActivityIndicator size="small" color={colors.textPrimary} />
                            ) : (
                                <Ionicons
                                    name={option.icon}
                                    size={20}
                                    color={active ? colors.textPrimary : colors.primary}
                                />
                            )}
                            <Text style={[styles.themeButtonText, active && styles.themeButtonTextActive]}>
                                {option.title}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderApiSection = () => (
        <>
            <Text style={styles.sectionTitle}>Провайдеры фильмов</Text>
            {loadingProviders ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Загружаю провайдеры...</Text>
                </View>
            ) : (
                movieProviders.map(renderProviderCard)
            )}

            <Text style={styles.sectionTitle}>Провайдеры ИИ</Text>
            {loadingProviders ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Загружаю провайдеры...</Text>
                </View>
            ) : (
                aiProviders.map(renderProviderCard)
            )}
        </>
    );

    const renderDataSection = () => (
        <View style={styles.section}>
            <TouchableOpacity style={styles.row} onPress={handleExport} disabled={busy}>
                <Ionicons name="download-outline" size={24} color={colors.primary} />
                <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Экспорт данных</Text>
                    <Text style={styles.rowSubtitle}>Сохранить библиотеку в JSON-файл</Text>
                </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.row} onPress={handleImport} disabled={busy}>
                <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Импорт данных</Text>
                    <Text style={styles.rowSubtitle}>Загрузить библиотеку из JSON-файла</Text>
                </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.row} onPress={handleClearData}>
                <Ionicons name="trash-outline" size={24} color={colors.danger} />
                <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.danger }]}>Очистить все данные</Text>
                    <Text style={styles.rowSubtitle}>Удалить все фильмы и заметки</Text>
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderAboutSection = () => (
        <>
            <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.infoBoxText}>
                    Для рекомендаций уже можно использовать Gemini, OpenAI и Claude. Вставь ключ, нажми «Тест», затем «Сохранить» и только потом делай провайдера активным.
                </Text>
            </View>

            <View style={styles.section}>
                <View style={styles.row}>
                    <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
                    <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>FilmsApp</Text>
                        <Text style={styles.rowSubtitle}>Версия Beta 0.2</Text>
                    </View>
                </View>
            </View>
        </>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.sectionTabsWrap}>
                {SECTION_TABS.map((tab) => {
                    const active = tab.value === activeSection;
                    return (
                        <TouchableOpacity
                            key={tab.value}
                            style={[styles.sectionTab, active && styles.sectionTabActive]}
                            onPress={() => setActiveSection(tab.value)}
                        >
                            <Ionicons
                                name={tab.icon}
                                size={16}
                                color={active ? colors.textPrimary : colors.textSecondary}
                            />
                            <Text style={[styles.sectionTabText, active && styles.sectionTabTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {activeSection === 'themes' ? renderThemesSection() : null}
            {activeSection === 'api' ? renderApiSection() : null}
            {activeSection === 'data' ? renderDataSection() : null}
            {activeSection === 'about' ? renderAboutSection() : null}
        </ScrollView>
    );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        content: {
            padding: SPACING.md,
            paddingBottom: SPACING.xl,
        },
        sectionTabsWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginBottom: SPACING.md,
            gap: SPACING.sm,
        },
        sectionTab: {
            minWidth: '47%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.md,
            borderRadius: RADIUS.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        sectionTabActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        sectionTabText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginLeft: SPACING.xs,
        },
        sectionTabTextActive: {
            color: colors.textPrimary,
        },
        sectionTitle: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '600',
            textTransform: 'uppercase',
            marginBottom: SPACING.sm,
            marginLeft: SPACING.xs,
            marginTop: SPACING.xs,
        },
        sectionCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            marginBottom: SPACING.lg,
            padding: SPACING.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        section: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            marginBottom: SPACING.lg,
            overflow: 'hidden',
        },
        themeButtonsGrid: {
            flexDirection: 'row',
            gap: SPACING.sm,
        },
        themeButton: {
            flex: 1,
            minHeight: 92,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceLight,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.md,
        },
        themeButtonActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        themeButtonText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            textAlign: 'center',
            marginTop: SPACING.sm,
        },
        themeButtonTextActive: {
            color: colors.textPrimary,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: SPACING.md,
        },
        rowText: {
            flex: 1,
            marginLeft: SPACING.md,
        },
        rowTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.md,
            fontWeight: '600',
        },
        rowSubtitle: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            marginTop: 2,
            lineHeight: 20,
        },
        divider: {
            height: 1,
            backgroundColor: colors.border,
            marginLeft: SPACING.xl + SPACING.md,
        },
        providerCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            padding: SPACING.md,
            marginBottom: SPACING.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        providerHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: SPACING.md,
        },
        providerTitleWrap: {
            flex: 1,
            paddingRight: SPACING.md,
        },
        providerHeaderRight: {
            alignItems: 'flex-end',
            gap: SPACING.sm,
        },
        providerTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.lg,
            fontWeight: '700',
            marginBottom: SPACING.xs,
        },
        providerDescription: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
        },
        activeBadge: {
            backgroundColor: `${colors.primary}22`,
            paddingHorizontal: SPACING.sm,
            paddingVertical: 6,
            borderRadius: RADIUS.xl,
        },
        activeBadgeText: {
            color: colors.primaryLight,
            fontSize: FONT_SIZES.xs,
            fontWeight: '700',
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.sm,
        },
        input: {
            flex: 1,
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: RADIUS.md,
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.md,
        },
        clipboardButton: {
            width: 48,
            height: 48,
            borderRadius: RADIUS.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
        },
        providerActionsRow: {
            flexDirection: 'row',
            gap: SPACING.sm,
            marginTop: SPACING.md,
        },
        providerButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.sm,
        },
        primaryButton: {
            backgroundColor: colors.primary,
        },
        secondaryButton: {
            backgroundColor: colors.surfaceLight,
        },
        fullWidthButton: {
            marginTop: SPACING.sm,
        },
        providerButtonText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginLeft: SPACING.xs,
            textAlign: 'center',
        },
        helpLink: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            marginTop: SPACING.md,
        },
        helpLinkText: {
            color: colors.primary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '600',
            marginLeft: SPACING.xs,
        },
        loadingBox: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            padding: SPACING.lg,
            marginBottom: SPACING.md,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
        },
        loadingText: {
            color: colors.textSecondary,
            marginTop: SPACING.sm,
            fontSize: FONT_SIZES.sm,
        },
        infoBox: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.md,
            marginBottom: SPACING.lg,
        },
        infoBoxText: {
            flex: 1,
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
            marginLeft: SPACING.sm,
        },
    });
}
