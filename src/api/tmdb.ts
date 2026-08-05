/**
 * API-клиент для The Movie Database (TMDB).
 *
 * TMDB — это база данных фильмов и сериалов.
 * Ключ теперь берётся не из .env, а из локальных настроек приложения.
 */

import type {
    TMDBSearchResult,
    MediaType,
    TMDBDetailsResult,
    TMDBPersonCredit,
    TMDBPersonDetails,
} from '../types';
import { getConfiguredApiKey } from '../database/settings';

/** Проверяет, задан ли ключ TMDB */
export async function isTmdbConfigured(): Promise<boolean> {
    const apiKey = await getConfiguredApiKey('tmdb');
    return apiKey.length > 0;
}

/** Возвращает ключ TMDB */
export async function getTmdbApiKey(): Promise<string> {
    return getConfiguredApiKey('tmdb');
}

/** Базовый URL для API TMDB */
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/** Базовые URL для картинок */
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
export const TMDB_PROFILE_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';

/** Формирует полный URL картинки из пути постера. */
export function getPosterUrl(posterPath: string | null): string | null {
    if (!posterPath) return null;
    return `${TMDB_IMAGE_BASE}${posterPath}`;
}

/** Формирует полный URL фото человека. */
export function getProfileUrl(profilePath?: string | null): string | null {
    if (!profilePath) return null;
    return `${TMDB_PROFILE_IMAGE_BASE}${profilePath}`;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const apiKey = await getConfiguredApiKey('tmdb');

    if (!apiKey) {
        throw new Error('Не задан TMDB API-ключ. Откройте Настройки и добавьте свой ключ TMDB.');
    }

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('language', 'ru-RU');

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`TMDB API ошибка: ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as T;
    } catch (error) {
        if (
            error instanceof Error &&
            (error.name === 'AbortError' ||
                error.message.includes('Network') ||
                error.message.includes('fetch'))
        ) {
            throw new Error('Нет интернета. Проверьте подключение и попробуйте снова.');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

interface TMDBSearchResponse {
    page: number;
    results: TMDBSearchResult[];
    total_pages: number;
    total_results: number;
}

interface TMDBPersonDetailsResponse extends TMDBPersonDetails { }

interface TMDBCombinedCreditsResponse {
    cast?: TMDBPersonCredit[];
    crew?: TMDBPersonCredit[];
}

function parseReleaseDate(item: TMDBSearchResult): Date | null {
    const rawDate = item.release_date || item.first_air_date;

    if (!rawDate) {
        return null;
    }

    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dedupeResults(items: TMDBSearchResult[]): TMDBSearchResult[] {
    const seen = new Set<string>();

    return items.filter((item) => {
        const key = `${item.media_type || 'movie'}-${item.id}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/** Ищет фильмы и сериалы по названию. */
export async function searchMulti(query: string, page = 1): Promise<TMDBSearchResult[]> {
    if (!query.trim()) return [];

    const data = await tmdbFetch<TMDBSearchResponse>('/search/multi', {
        query,
        page: page.toString(),
    });

    return data.results.filter(
        (item) => item.media_type === 'movie' || item.media_type === 'tv',
    );
}

/** Возвращает короткий список подсказок прямо во время ввода. */
export async function fetchSearchSuggestions(query: string): Promise<TMDBSearchResult[]> {
    const normalized = query.trim();

    if (normalized.length < 2) {
        return [];
    }

    const results = await searchMulti(normalized, 1);

    return dedupeResults(results.filter((item) => Boolean(item.title || item.name))).slice(0, 6);
}

/**
 * Получает страницу популярных фильмов за текущий год.
 * Сортировка — popularity.desc на стороне TMDB, только фильмы (без сериалов).
 * Возвращает одну страницу (page), стабильный порядок между страницами.
 */
export async function getPopularMoviesThisYear(page = 1): Promise<TMDBSearchResult[]> {
    const currentYear = new Date().getFullYear();

    const data = await tmdbFetch<TMDBSearchResponse>('/discover/movie', {
        primary_release_year: currentYear.toString(),
        sort_by: 'popularity.desc',
        include_adult: 'false',
        page: page.toString(),
    });

    return data.results.map((item) => ({
        ...item,
        media_type: 'movie' as MediaType,
    }));
}

/**
 * Топ по рейтингу за произвольный период лет.
 * Серверная выборка: vote_count.gte отсекает «фейковые 10 звёзд» с парой голосов.
 */
export async function getTopRatedForPeriod(
    startYear: number,
    endYear: number,
    pageCount = 4,
): Promise<TMDBSearchResult[]> {
    const startYearSafe = Math.min(startYear, endYear);
    const endYearSafe = Math.max(startYear, endYear);
    const pages = Array.from({ length: Math.max(1, pageCount) }, (_, index) => index + 1);

    const [movieResponses, tvResponses] = await Promise.all([
        Promise.all(
            pages.map((page) =>
                tmdbFetch<TMDBSearchResponse>('/discover/movie', {
                    'primary_release_date.gte': `${startYearSafe}-01-01`,
                    'primary_release_date.lte': `${endYearSafe}-12-31`,
                    sort_by: 'vote_average.desc',
                    'vote_count.gte': '30',
                    include_adult: 'false',
                    page: page.toString(),
                }),
            ),
        ),
        Promise.all(
            pages.map((page) =>
                tmdbFetch<TMDBSearchResponse>('/discover/tv', {
                    'first_air_date.gte': `${startYearSafe}-01-01`,
                    'first_air_date.lte': `${endYearSafe}-12-31`,
                    sort_by: 'vote_average.desc',
                    'vote_count.gte': '30',
                    include_adult: 'false',
                    page: page.toString(),
                }),
            ),
        ),
    ]);

    const movies = movieResponses.flatMap((response) =>
        response.results.map((item) => ({ ...item, media_type: 'movie' as MediaType })),
    );
    const tvShows = tvResponses.flatMap((response) =>
        response.results.map((item) => ({ ...item, media_type: 'tv' as MediaType })),
    );

    return dedupeResults([...movies, ...tvShows])
        .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
}

/** Получает базовую подробную информацию о фильме/сериале по TMDB ID. */
export async function getDetails(
    tmdbId: number,
    mediaType: MediaType,
): Promise<TMDBSearchResult> {
    const endpoint = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    const data = await tmdbFetch<TMDBSearchResult>(endpoint);

    return { ...data, media_type: mediaType };
}

/** Получает подробную карточку фильма/сериала вместе с актёрами и отзывами. */
export async function getDetailsWithExtras(
    tmdbId: number,
    mediaType: MediaType,
): Promise<TMDBDetailsResult> {
    const endpoint = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    const data = await tmdbFetch<TMDBDetailsResult>(endpoint, {
        append_to_response: 'credits,reviews',
    });

    return {
        ...data,
        media_type: mediaType,
    };
}

/** Получает подробности по человеку из TMDB. */
export async function getPersonDetails(personId: number): Promise<TMDBPersonDetails> {
    return tmdbFetch<TMDBPersonDetailsResponse>(`/person/${personId}`);
}

/** Получает фильмографию человека из TMDB. */
export async function getPersonCredits(personId: number): Promise<TMDBPersonCredit[]> {
    const data = await tmdbFetch<TMDBCombinedCreditsResponse>(`/person/${personId}/combined_credits`);

    return [...(data.cast ?? []), ...(data.crew ?? [])]
        .filter((credit) => credit.media_type === 'movie' || credit.media_type === 'tv')
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}
