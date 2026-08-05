/**
 * Настройка локальной базы данных SQLite.
 *
 * Здесь создаётся подключение к БД и инициализируются таблицы.
 * База хранится локально на устройстве и не синхронизируется с облаком.
 */

import * as SQLite from 'expo-sqlite';
import type { Movie, Note, WatchStatus, BackupData, MediaType } from '../types';

const DB_NAME = 'films.db';
let dbInstance: SQLite.SQLiteDatabase | null = null;

interface NoteImportItem {
    title: string;
    status: WatchStatus;
}

async function ensureNotesTitleColumn(db: SQLite.SQLiteDatabase): Promise<void> {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(notes)`);
    const hasTitle = columns.some((column) => column.name === 'title');

    if (!hasTitle) {
        await db.execAsync(`ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT 'Без названия';`);
    }
}

async function getNextLocalTmdbId(db: SQLite.SQLiteDatabase): Promise<number> {
    const row = await db.getFirstAsync<{ min_tmdb_id: number | null }>(
        `SELECT MIN(tmdb_id) as min_tmdb_id FROM movies`,
    );

    if (typeof row?.min_tmdb_id !== 'number' || row.min_tmdb_id >= 0) {
        return -1;
    }

    return row.min_tmdb_id - 1;
}

async function seedProviderSettings(db: SQLite.SQLiteDatabase): Promise<void> {
    const now = new Date().toISOString();

    await db.runAsync(
        `INSERT OR IGNORE INTO provider_settings (provider_type, category, api_key, enabled, is_active, base_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        'tmdb',
        'movie',
        '',
        0,
        1,
        null,
        now,
    );

    await db.runAsync(
        `INSERT OR IGNORE INTO provider_settings (provider_type, category, api_key, enabled, is_active, base_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        'kinopoisk',
        'movie',
        '',
        0,
        0,
        null,
        now,
    );

    for (const provider of ['gemini', 'openai', 'claude']) {
        await db.runAsync(
            `INSERT OR IGNORE INTO provider_settings (provider_type, category, api_key, enabled, is_active, base_url, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            provider,
            'ai',
            '',
            0,
            provider === 'gemini' ? 1 : 0,
            null,
            now,
        );
    }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (dbInstance) return dbInstance;

    const db = await SQLite.openDatabaseAsync(DB_NAME);

    await db.execAsync(`
    PRAGMA journal_mode = WAL;
  `);

    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER NOT NULL UNIQUE,
      media_type TEXT NOT NULL DEFAULT 'movie',
      title TEXT NOT NULL,
      poster_path TEXT,
      release_date TEXT,
      overview TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      rating INTEGER NOT NULL DEFAULT 0,
      review TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status);

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Без названия',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_settings (
      provider_type TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      base_url TEXT,
      updated_at TEXT NOT NULL
    );
  `);

    await ensureNotesTitleColumn(db);
    await seedProviderSettings(db);

    dbInstance = db;
    return db;
}

export async function addOrUpdateMovie(movie: Omit<Movie, 'id'>): Promise<number> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const createdAt = movie.created_at || now;

    await db.runAsync(
        `INSERT INTO movies
      (tmdb_id, media_type, title, poster_path, release_date, overview, status, rating, review, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tmdb_id) DO UPDATE SET
      media_type = excluded.media_type,
      title = excluded.title,
      poster_path = excluded.poster_path,
      release_date = excluded.release_date,
      overview = excluded.overview,
      status = excluded.status,
      rating = excluded.rating,
      review = excluded.review,
      updated_at = excluded.updated_at`,
        movie.tmdb_id,
        movie.media_type,
        movie.title,
        movie.poster_path,
        movie.release_date,
        movie.overview,
        movie.status,
        movie.rating,
        movie.review,
        createdAt,
        now,
    );

    const savedMovie = await findMovieByTmdbId(movie.tmdb_id);
    return savedMovie?.id ?? 0;
}

export async function updateMovieStatus(id: number, status: WatchStatus): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        `UPDATE movies SET status = ?, updated_at = ? WHERE id = ?`,
        status,
        new Date().toISOString(),
        id,
    );
}

export async function updateMovieRatingAndReview(
    id: number,
    rating: number,
    review: string | null,
): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        `UPDATE movies SET rating = ?, review = ?, updated_at = ? WHERE id = ?`,
        rating,
        review,
        new Date().toISOString(),
        id,
    );
}

export async function getAllMovies(): Promise<Movie[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Movie>(`SELECT * FROM movies ORDER BY updated_at DESC`);
}

export async function getMoviesByStatus(status: WatchStatus): Promise<Movie[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Movie>(
        `SELECT * FROM movies WHERE status = ? ORDER BY updated_at DESC`,
        status,
    );
}

export async function getMovieById(id: number): Promise<Movie | null> {
    const db = await getDatabase();
    const movie = await db.getFirstAsync<Movie>(`SELECT * FROM movies WHERE id = ?`, id);
    return movie ?? null;
}

export async function deleteMovie(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM movies WHERE id = ?`, id);
}

/**
 * Привязывает локальную запись (tmdb_id < 0) к настоящей карточке TMDB.
 * Обновляет tmdb_id и заполняет постер/дату/описание из TMDB,
 * но сохраняет статус, оценку и отзыв пользователя.
 */
export async function syncMovieWithTmdb(
    id: number,
    tmdbData: {
        tmdb_id: number;
        media_type: MediaType;
        title: string;
        poster_path: string | null;
        release_date: string | null;
        overview: string | null;
    },
): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        `UPDATE movies
         SET tmdb_id = ?, media_type = ?, title = ?, poster_path = ?, release_date = ?, overview = ?, updated_at = ?
         WHERE id = ?`,
        tmdbData.tmdb_id,
        tmdbData.media_type,
        tmdbData.title,
        tmdbData.poster_path,
        tmdbData.release_date,
        tmdbData.overview,
        new Date().toISOString(),
        id,
    );
}

/** Фильмы, на которые пользователь поставил оценку или написал отзыв. */
export async function getMoviesWithReviews(): Promise<Movie[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Movie>(
        `SELECT * FROM movies
         WHERE rating > 0 OR (review IS NOT NULL AND trim(review) != '')
         ORDER BY updated_at DESC`,
    );
}

export async function findMovieByTmdbId(tmdbId: number): Promise<Movie | null> {
    const db = await getDatabase();
    const movie = await db.getFirstAsync<Movie>(
        `SELECT * FROM movies WHERE tmdb_id = ?`,
        tmdbId,
    );
    return movie ?? null;
}

export async function findMovieByTitle(title: string): Promise<Movie | null> {
    const db = await getDatabase();
    const movie = await db.getFirstAsync<Movie>(
        `SELECT * FROM movies WHERE trim(title) = trim(?) COLLATE NOCASE LIMIT 1`,
        title,
    );
    return movie ?? null;
}

export async function importMoviesFromNote(items: NoteImportItem[]): Promise<{
    created: number;
    updated: number;
    skipped: number;
}> {
    const db = await getDatabase();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
        const title = item.title.trim();

        if (!title) {
            skipped += 1;
            continue;
        }

        const existing = await findMovieByTitle(title);

        if (existing?.id) {
            await updateMovieStatus(existing.id, item.status);
            updated += 1;
            continue;
        }

        const now = new Date().toISOString();
        const tmdbId = await getNextLocalTmdbId(db);

        await addOrUpdateMovie({
            tmdb_id: tmdbId,
            media_type: 'movie',
            title,
            poster_path: null,
            release_date: null,
            overview: null,
            status: item.status,
            rating: 0,
            review: null,
            created_at: now,
            updated_at: now,
        });

        created += 1;
    }

    return { created, updated, skipped };
}

export async function addNote(title: string, content?: string): Promise<number> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const resolvedTitle = content === undefined ? 'Без названия' : title.trim() || 'Без названия';
    const resolvedContent = (content === undefined ? title : content).trim();
    const result = await db.runAsync(
        `INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        resolvedTitle,
        resolvedContent,
        now,
        now,
    );
    return result.lastInsertRowId as number;
}

export async function updateNote(id: number, title: string, content?: string): Promise<void> {
    const db = await getDatabase();
    const resolvedTitle = content === undefined ? 'Без названия' : title.trim() || 'Без названия';
    const resolvedContent = (content === undefined ? title : content).trim();
    await db.runAsync(
        `UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?`,
        resolvedTitle,
        resolvedContent,
        new Date().toISOString(),
        id,
    );
}

export async function getAllNotes(): Promise<Note[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Note>(`SELECT * FROM notes ORDER BY updated_at DESC`);
}

export async function deleteNote(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM notes WHERE id = ?`, id);
}

export async function exportData(): Promise<BackupData> {
    const db = await getDatabase();
    const movies = await db.getAllAsync<Movie>(`SELECT * FROM movies ORDER BY id`);
    const notes = await db.getAllAsync<Note>(`SELECT * FROM notes ORDER BY id`);

    return {
        version: 1,
        exported_at: new Date().toISOString(),
        movies,
        notes,
    };
}

export async function importData(data: BackupData): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(`DELETE FROM movies`);
    await db.runAsync(`DELETE FROM notes`);

    for (const movie of data.movies) {
        await db.runAsync(
            `INSERT INTO movies
       (tmdb_id, media_type, title, poster_path, release_date, overview, status, rating, review, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            movie.tmdb_id,
            movie.media_type,
            movie.title,
            movie.poster_path,
            movie.release_date,
            movie.overview,
            movie.status,
            movie.rating,
            movie.review,
            movie.created_at,
            movie.updated_at,
        );
    }

    for (const note of data.notes) {
        await db.runAsync(
            `INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)`,
            note.title || 'Без названия',
            note.content,
            note.created_at,
            note.updated_at,
        );
    }
}

export async function clearAllData(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM movies`);
    await db.runAsync(`DELETE FROM notes`);
}