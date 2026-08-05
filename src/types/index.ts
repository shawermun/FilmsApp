/**
 * Общие типы данных приложения.
 */

/** Статусы просмотра фильма */
export type WatchStatus = 'planned' | 'watching' | 'completed' | 'dropped';

/** Тип контента — фильм или сериал */
export type MediaType = 'movie' | 'tv';

/**
 * Фильм в локальной базе данных.
 * Эти поля хранятся в таблице movies в SQLite.
 */
export interface Movie {
    id?: number;
    tmdb_id: number;
    media_type: MediaType;
    title: string;
    poster_path: string | null;
    release_date: string | null;
    overview: string | null;
    status: WatchStatus;
    rating: number;
    review: string | null;
    created_at: string;
    updated_at: string;
}

/** Фильм, полученный из поиска TMDB (ещё не в БД) */
export interface TMDBSearchResult {
    id: number;
    media_type?: MediaType;
    title?: string;
    name?: string;
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    overview: string;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
}

export interface TMDBGenre {
    id: number;
    name: string;
}

export interface TMDBCastMember {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    order?: number;
}

export interface TMDBCrewMember {
    id: number;
    name: string;
    job: string;
    department?: string;
    profile_path?: string | null;
}

export interface TMDBReview {
    id: string;
    author: string;
    content: string;
    created_at?: string;
    url?: string;
    author_details?: {
        username?: string;
        rating?: number | null;
        avatar_path?: string | null;
    };
}

export interface TMDBPersonCredit {
    id: number;
    media_type: MediaType;
    title?: string;
    name?: string;
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    character?: string;
    job?: string;
    vote_average?: number;
    popularity?: number;
}

export interface TMDBPersonDetails {
    id: number;
    name: string;
    biography?: string;
    profile_path: string | null;
    known_for_department?: string;
    birthday?: string | null;
    place_of_birth?: string | null;
}

/** Подробная информация о фильме/сериале из TMDB */
export interface TMDBDetailsResult extends TMDBSearchResult {
    backdrop_path?: string | null;
    tagline?: string;
    runtime?: number | null;
    episode_run_time?: number[];
    number_of_seasons?: number;
    genres?: TMDBGenre[];
    credits?: {
        cast: TMDBCastMember[];
        crew?: TMDBCrewMember[];
    };
    reviews?: {
        results: TMDBReview[];
    };
    production_countries?: Array<{
        iso_3166_1: string;
        name: string;
    }>;
    spoken_languages?: Array<{
        english_name?: string;
        name: string;
    }>;
    status?: string;
}

/** Заметка в блокноте */
export interface Note {
    id?: number;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
}

/** Структура JSON-файла для экспорта/импорта */
export interface BackupData {
    version: number;
    exported_at: string;
    movies: Movie[];
    notes: Note[];
}

/** Рекомендация от ИИ */
export interface AIRecommendation {
    title: string;
    reason: string;
}

/** Типы провайдеров */
export type ProviderType = 'tmdb' | 'gemini' | 'openai' | 'claude' | 'kinopoisk';
export type ProviderCategory = 'movie' | 'ai';

export interface ProviderSetting {
    provider_type: ProviderType;
    category: ProviderCategory;
    api_key: string;
    enabled: boolean;
    is_active: boolean;
    base_url?: string | null;
    updated_at: string;
}

/** Предпочтения пользователя для рекомендаций */
export interface RecommendationPreferences {
    id?: number;
    freeform_prompt: string;
    favorite_genres: string[];
    disliked_genres: string[];
    favorite_titles: string[];
    mood_keywords: string[];
    avoid_keywords: string[];
    preferred_provider: ProviderType | null;
    updated_at: string;
}

/** Нормализованный prompt для AI provider */
export interface RecommendationPromptInput {
    watchedMovies: Movie[];
    freeformPrompt: string;
    favoriteGenres: string[];
    dislikedGenres: string[];
    favoriteTitles: string[];
    moodKeywords: string[];
    avoidKeywords: string[];
}
