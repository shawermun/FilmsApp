import { getDatabase } from './db';
import type { ProviderCategory, ProviderSetting, ProviderType } from '../types';

export async function getAllProviderSettings(): Promise<ProviderSetting[]> {
    const db = await getDatabase();
    return db.getAllAsync<ProviderSetting>(
        `SELECT * FROM provider_settings ORDER BY category, provider_type`,
    );
}

export async function getProviderSetting(providerType: ProviderType): Promise<ProviderSetting | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ProviderSetting>(
        `SELECT * FROM provider_settings WHERE provider_type = ?`,
        providerType,
    );
    return row ?? null;
}

export async function saveProviderApiKey(providerType: ProviderType, apiKey: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        `UPDATE provider_settings SET api_key = ?, updated_at = ? WHERE provider_type = ?`,
        apiKey.trim(),
        new Date().toISOString(),
        providerType,
    );
}

export async function setProviderEnabled(providerType: ProviderType, enabled: boolean): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        `UPDATE provider_settings SET enabled = ?, updated_at = ? WHERE provider_type = ?`,
        enabled ? 1 : 0,
        new Date().toISOString(),
        providerType,
    );
}

export async function setActiveProvider(
    category: ProviderCategory,
    providerType: ProviderType,
): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
        `UPDATE provider_settings SET is_active = 0, updated_at = ? WHERE category = ?`,
        now,
        category,
    );

    await db.runAsync(
        `UPDATE provider_settings SET is_active = 1, updated_at = ? WHERE provider_type = ?`,
        now,
        providerType,
    );
}

export async function getActiveProvider(category: ProviderCategory): Promise<ProviderSetting | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ProviderSetting>(
        `SELECT * FROM provider_settings WHERE category = ? AND is_active = 1 LIMIT 1`,
        category,
    );
    return row ?? null;
}

export async function getConfiguredApiKey(providerType: ProviderType): Promise<string> {
    const row = await getProviderSetting(providerType);
    return row?.api_key?.trim() || '';
}