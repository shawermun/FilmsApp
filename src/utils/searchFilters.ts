import type { MediaType, TMDBSearchResult } from '../types';

export type SearchMediaFilter = 'all' | MediaType;
export type SearchSortMode = 'default' | 'newest' | 'rating' | 'hybrid' | 'top_rated_period';

export interface SearchFilterOptions {
    mediaFilter: SearchMediaFilter;
    sortMode: SearchSortMode;
    minRating: number;
    recentWindowYears: number;
    periodStartYear: number;
    periodEndYear: number;
    currentYear?: number;
}

const DEFAULT_MIN_RATING = 7;
const DEFAULT_RECENT_WINDOW_YEARS = 4;
/** Минимальное количество голосов, чтобы рейтинг считался надёжным (отсекает фейковые 10 звёзд) */
const MIN_VOTE_COUNT = 30;

export function getDisplayTitle(item: TMDBSearchResult): string {
    return item.title || item.name || 'Без названия';
}

export function getReleaseDate(item: TMDBSearchResult): string {
    return item.release_date || item.first_air_date || '';
}

export function getReleaseYear(item: TMDBSearchResult): number | null {
    const rawYear = getReleaseDate(item).slice(0, 4);
    if (!rawYear) return null;

    const year = Number(rawYear);
    return Number.isFinite(year) ? year : null;
}

export function getVoteAverage(item: TMDBSearchResult): number {
    return typeof item.vote_average === 'number' ? item.vote_average : 0;
}

export function getVoteCount(item: TMDBSearchResult): number {
    return typeof item.vote_count === 'number' ? item.vote_count : 0;
}

export function getPopularity(item: TMDBSearchResult): number {
    return typeof item.popularity === 'number' ? item.popularity : 0;
}

export function parsePositiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseRating(value: string, fallback = DEFAULT_MIN_RATING): number {
    const parsed = Number.parseFloat(value.trim().replace(',', '.'));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(10, Math.max(0, parsed));
}

function byNewest(a: TMDBSearchResult, b: TMDBSearchResult): number {
    const dateA = getReleaseDate(a);
    const dateB = getReleaseDate(b);
    return dateB.localeCompare(dateA);
}

function byRating(a: TMDBSearchResult, b: TMDBSearchResult): number {
    const ratingDiff = getVoteAverage(b) - getVoteAverage(a);
    if (ratingDiff !== 0) return ratingDiff;
    return byNewest(a, b);
}

function byPopularity(a: TMDBSearchResult, b: TMDBSearchResult): number {
    const popDiff = getPopularity(b) - getPopularity(a);
    if (popDiff !== 0) return popDiff;
    return byRating(a, b);
}

/** Проверяет, что рейтинг есть и набрано достаточно голосов */
function hasUsableRating(item: TMDBSearchResult): boolean {
    return getVoteAverage(item) > 0 && getVoteCount(item) >= MIN_VOTE_COUNT;
}

function getHybridScore(item: TMDBSearchResult, minYear: number, minRating: number): number {
    const year = getReleaseYear(item) ?? 0;
    const rating = getVoteAverage(item);
    const yearBonus = year >= minYear ? 100 : Math.max(0, 100 - (minYear - year) * 15);
    const ratingBonus = rating >= minRating ? 100 : rating * 10;
    return yearBonus + ratingBonus;
}

export function applySearchFilters(
    items: TMDBSearchResult[],
    options: SearchFilterOptions,
): TMDBSearchResult[] {
    const currentYear = options.currentYear ?? new Date().getFullYear();
    const minRating = Number.isFinite(options.minRating) ? options.minRating : DEFAULT_MIN_RATING;
    const recentWindowYears = Number.isFinite(options.recentWindowYears)
        ? Math.max(1, options.recentWindowYears)
        : DEFAULT_RECENT_WINDOW_YEARS;
    const periodStartYear = Math.min(options.periodStartYear, options.periodEndYear);
    const periodEndYear = Math.max(options.periodStartYear, options.periodEndYear);

    let filtered = [...items];

    if (options.mediaFilter !== 'all') {
        filtered = filtered.filter((item) => (item.media_type ?? 'movie') === options.mediaFilter);
    }

    switch (options.sortMode) {
        case 'newest':
            return filtered.sort(byNewest);

        case 'rating':
            return filtered.filter(hasUsableRating).sort(byRating);

        case 'hybrid': {
            const minYear = currentYear - recentWindowYears + 1;
            const ratedItems = filtered.filter(hasUsableRating);
            const recentItems = ratedItems.filter((item) => {
                const year = getReleaseYear(item);
                return year !== null && year >= minYear;
            });
            const targetSet = recentItems.length > 0 ? recentItems : ratedItems;

            return targetSet.sort((a, b) => {
                const scoreDiff = getHybridScore(b, minYear, minRating) - getHybridScore(a, minYear, minRating);
                if (scoreDiff !== 0) return scoreDiff;
                return byRating(a, b);
            });
        }

        case 'top_rated_period':
            return filtered
                .filter((item) => {
                    const year = getReleaseYear(item);
                    return hasUsableRating(item) && year !== null && year >= periodStartYear && year <= periodEndYear;
                })
                .sort(byRating);

        case 'default':
        default:
            // По умолчанию — сохраняем порядок ответа сервера (popularity.desc),
            // без повторной сортировки на клиенте, чтобы позиции не менялись при пагинации
            return filtered;
    }
}

export function buildFilterSummary(options: SearchFilterOptions, searched: boolean): string {
    const base = searched ? 'поиска' : 'подборки';
    const currentYear = options.currentYear ?? new Date().getFullYear();

    switch (options.sortMode) {
        case 'newest':
            return `Показываю результаты ${base}, отсортированные по новизне.`;
        case 'rating':
            return `Показываю результаты ${base}, отсортированные по рейтингу TMDB. Показаны только тайтлы с ${MIN_VOTE_COUNT}+ голосами.`;
        case 'hybrid':
            return `Режим «Свежий + топ»: свежие релизы за последние ${options.recentWindowYears} лет с рейтингом от ${options.minRating.toFixed(1)}. Показаны только тайтлы с ${MIN_VOTE_COUNT}+ голосами.`;
        case 'top_rated_period':
            return `Топ за период ${options.periodStartYear}–${options.periodEndYear}: сначала лучший рейтинг, затем более свежий релиз. Показаны только тайтлы с ${MIN_VOTE_COUNT}+ голосами.`;
        case 'default':
        default:
            return searched
                ? 'Показываю самые популярные результаты поиска по TMDB.'
                : `Показываю самые популярные фильмы ${new Date().getFullYear()} года по TMDB (популярность по убыванию).`;
    }
}