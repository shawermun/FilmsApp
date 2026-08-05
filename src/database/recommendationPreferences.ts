import { getDatabase } from './db';
import type { RecommendationPreferences } from '../types';

const DEFAULT_PREFERENCES: RecommendationPreferences = {
    freeform_prompt: '',
    favorite_genres: [],
    disliked_genres: [],
    favorite_titles: [],
    mood_keywords: [],
    avoid_keywords: [],
    preferred_provider: null,
    updated_at: new Date().toISOString(),
};

function safeParseArray(value: string | null | undefined): string[] {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

function normalizeList(items: string[]): string[] {
    return items
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index);
}

export async function ensureRecommendationPreferencesTable(): Promise<void> {
    const db = await getDatabase();

    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS recommendation_preferences (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            freeform_prompt TEXT NOT NULL DEFAULT '',
            favorite_genres TEXT NOT NULL DEFAULT '[]',
            disliked_genres TEXT NOT NULL DEFAULT '[]',
            favorite_titles TEXT NOT NULL DEFAULT '[]',
            mood_keywords TEXT NOT NULL DEFAULT '[]',
            avoid_keywords TEXT NOT NULL DEFAULT '[]',
            preferred_provider TEXT,
            updated_at TEXT NOT NULL
        );
    `);

    await db.runAsync(
        `INSERT OR IGNORE INTO recommendation_preferences (
            id,
            freeform_prompt,
            favorite_genres,
            disliked_genres,
            favorite_titles,
            mood_keywords,
            avoid_keywords,
            preferred_provider,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        1,
        DEFAULT_PREFERENCES.freeform_prompt,
        JSON.stringify(DEFAULT_PREFERENCES.favorite_genres),
        JSON.stringify(DEFAULT_PREFERENCES.disliked_genres),
        JSON.stringify(DEFAULT_PREFERENCES.favorite_titles),
        JSON.stringify(DEFAULT_PREFERENCES.mood_keywords),
        JSON.stringify(DEFAULT_PREFERENCES.avoid_keywords),
        DEFAULT_PREFERENCES.preferred_provider,
        DEFAULT_PREFERENCES.updated_at,
    );
}

export async function getRecommendationPreferences(): Promise<RecommendationPreferences> {
    await ensureRecommendationPreferencesTable();
    const db = await getDatabase();

    const row = await db.getFirstAsync<{
        id?: number;
        freeform_prompt: string;
        favorite_genres: string;
        disliked_genres: string;
        favorite_titles: string;
        mood_keywords: string;
        avoid_keywords: string;
        preferred_provider: RecommendationPreferences['preferred_provider'];
        updated_at: string;
    }>(`SELECT * FROM recommendation_preferences WHERE id = 1 LIMIT 1`);

    if (!row) {
        return DEFAULT_PREFERENCES;
    }

    return {
        id: row.id,
        freeform_prompt: row.freeform_prompt || '',
        favorite_genres: safeParseArray(row.favorite_genres),
        disliked_genres: safeParseArray(row.disliked_genres),
        favorite_titles: safeParseArray(row.favorite_titles),
        mood_keywords: safeParseArray(row.mood_keywords),
        avoid_keywords: safeParseArray(row.avoid_keywords),
        preferred_provider: row.preferred_provider || null,
        updated_at: row.updated_at,
    };
}

export async function saveRecommendationPreferences(
    input: Omit<RecommendationPreferences, 'id' | 'updated_at'>,
): Promise<void> {
    await ensureRecommendationPreferencesTable();
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
        `UPDATE recommendation_preferences
         SET freeform_prompt = ?,
             favorite_genres = ?,
             disliked_genres = ?,
             favorite_titles = ?,
             mood_keywords = ?,
             avoid_keywords = ?,
             preferred_provider = ?,
             updated_at = ?
         WHERE id = 1`,
        input.freeform_prompt.trim(),
        JSON.stringify(normalizeList(input.favorite_genres)),
        JSON.stringify(normalizeList(input.disliked_genres)),
        JSON.stringify(normalizeList(input.favorite_titles)),
        JSON.stringify(normalizeList(input.mood_keywords)),
        JSON.stringify(normalizeList(input.avoid_keywords)),
        input.preferred_provider,
        now,
    );
}

export async function resetRecommendationPreferences(): Promise<void> {
    await ensureRecommendationPreferencesTable();
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
        `UPDATE recommendation_preferences
         SET freeform_prompt = ?,
             favorite_genres = ?,
             disliked_genres = ?,
             favorite_titles = ?,
             mood_keywords = ?,
             avoid_keywords = ?,
             preferred_provider = ?,
             updated_at = ?
         WHERE id = 1`,
        '',
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        null,
        now,
    );
}