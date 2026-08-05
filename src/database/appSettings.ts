import { getDatabase } from './db';
import type { ThemeMode } from '../constants/theme';

const APP_SETTINGS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
`;

async function ensureAppSettingsTable(): Promise<void> {
    const db = await getDatabase();
    await db.execAsync(APP_SETTINGS_TABLE_SQL);
}

export async function getAppSetting(key: string): Promise<string | null> {
    await ensureAppSettingsTable();
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = ? LIMIT 1`,
        key,
    );

    return row?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
    await ensureAppSettingsTable();
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        key,
        value,
        now,
    );
}

export async function getThemeModeSetting(): Promise<ThemeMode> {
    const value = await getAppSetting('theme_mode');
    if (value === 'dark' || value === 'light' || value === 'system') {
        return value;
    }

    return 'system';
}

export async function setThemeModeSetting(mode: ThemeMode): Promise<void> {
    await setAppSetting('theme_mode', mode);
}
