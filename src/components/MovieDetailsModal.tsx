import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
    Movie,
    TMDBCastMember,
    TMDBCrewMember,
    TMDBDetailsResult,
    TMDBPersonCredit,
    TMDBPersonDetails,
    TMDBReview,
    TMDBSearchResult,
    WatchStatus,
} from '../types';
import { FONT_SIZES, RADIUS, SPACING } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import {
    getDetailsWithExtras,
    getPersonCredits,
    getPersonDetails,
    getPosterUrl,
    getProfileUrl,
    isTmdbConfigured,
    searchMulti,
} from '../api/tmdb';
import {
    addOrUpdateMovie,
    findMovieByTmdbId,
    syncMovieWithTmdb,
    updateMovieRatingAndReview,
    updateMovieStatus,
} from '../database/db';
import { WATCH_STATUS_META } from '../constants/movieStatus';
import { StatusPickerModal } from './StatusPickerModal';

interface MovieDetailsModalProps {
    visible: boolean;
    item: Movie | TMDBSearchResult | null;
    onClose: () => void;
    onLibraryChanged?: () => void;
}

const POSITIVE_WORDS = [
    'great', 'excellent', 'amazing', 'masterpiece', 'favorite', 'beautiful', 'strong', 'love',
    'отлич', 'сильн', 'прекрас', 'люб', 'мощн', 'атмосфер', 'класс', 'интерес', 'трог',
];

const NEGATIVE_WORDS = [
    'boring', 'weak', 'predictable', 'slow', 'bad', 'mess', 'flat', 'disappoint',
    'скуч', 'слаб', 'затянут', 'предсказ', 'разочар', 'сыр', 'хаос', 'плоск',
];

const REVIEW_TOPICS = [
    { label: 'актёрскую игру', keywords: ['actor', 'acting', 'performance', 'акт', 'игр'] },
    { label: 'атмосферу', keywords: ['atmos', 'tone', 'mood', 'атмос', 'настро'] },
    { label: 'сценарий', keywords: ['script', 'writing', 'plot', 'story', 'сценар', 'сюжет'] },
    { label: 'визуальный стиль', keywords: ['visual', 'cinemat', 'shot', 'vfx', 'визу', 'оператор'] },
    { label: 'темп повествования', keywords: ['pacing', 'pace', 'tempo', 'темп', 'динам'] },
    { label: 'саундтрек', keywords: ['soundtrack', 'score', 'music', 'музык', 'саунд'] },
    { label: 'эмоциональное воздействие', keywords: ['emotional', 'moving', 'touching', 'эмоц', 'трог'] },
];

function isLibraryMovie(item: Movie | TMDBSearchResult): item is Movie {
    return 'tmdb_id' in item;
}

function getResolvedTitle(item: Movie | TMDBSearchResult, details: TMDBDetailsResult | null): string {
    return details?.title || details?.name || (isLibraryMovie(item) ? item.title : item.title || item.name) || 'Без названия';
}

function getResolvedMediaType(item: Movie | TMDBSearchResult): 'movie' | 'tv' {
    return (isLibraryMovie(item) ? item.media_type : item.media_type) ?? 'movie';
}

function getResolvedTmdbId(item: Movie | TMDBSearchResult): number {
    return isLibraryMovie(item) ? item.tmdb_id : item.id;
}

function getResolvedPoster(item: Movie | TMDBSearchResult, details: TMDBDetailsResult | null): string | null {
    return details?.poster_path ?? (isLibraryMovie(item) ? item.poster_path : item.poster_path);
}

function getResolvedOverview(item: Movie | TMDBSearchResult, details: TMDBDetailsResult | null): string | null {
    return details?.overview || (isLibraryMovie(item) ? item.overview : item.overview) || null;
}

function getResolvedReleaseDate(item: Movie | TMDBSearchResult, details: TMDBDetailsResult | null): string | null {
    return details?.release_date || details?.first_air_date || (isLibraryMovie(item) ? item.release_date : item.release_date || item.first_air_date) || null;
}

function buildReviewSummary(reviews: TMDBReview[]): string {
    if (reviews.length === 0) {
        return 'У этого фильма пока мало пользовательских отзывов на TMDB, поэтому краткой сводки нет.';
    }

    const combined = reviews
        .slice(0, 8)
        .map((review) => review.content.toLowerCase())
        .join(' ');

    const positiveHits = POSITIVE_WORDS.reduce((total, word) => total + (combined.includes(word) ? 1 : 0), 0);
    const negativeHits = NEGATIVE_WORDS.reduce((total, word) => total + (combined.includes(word) ? 1 : 0), 0);

    const topTopics = REVIEW_TOPICS
        .map((topic) => ({
            label: topic.label,
            score: topic.keywords.reduce((total, keyword) => total + (combined.includes(keyword) ? 1 : 0), 0),
        }))
        .filter((topic) => topic.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((topic) => topic.label);

    const tone = positiveHits > negativeHits + 1
        ? 'в основном положительные'
        : negativeHits > positiveHits + 1
            ? 'скорее критичные'
            : 'смешанные';

    if (topTopics.length > 0) {
        return `Отзывы ${tone}. Чаще всего зрители отмечают ${topTopics.join(', ')}.`;
    }

    return `Отзывы ${tone}. По ощущениям зрители чаще обсуждают общее впечатление от истории, темп и постановку.`;
}


function buildExpandedReviewSummary(reviews: TMDBReview[]): string {
    if (reviews.length === 0) {
        return 'У этого фильма пока мало пользовательских отзывов на TMDB, поэтому развёрнутой сводки нет.';
    }

    const baseSummary = buildReviewSummary(reviews);
    const detailedReviews = reviews.filter((review) => review.content.trim().length >= 280).length;
    const withRating = reviews.filter((review) => typeof review.author_details?.rating === 'number').length;

    const densityNote = detailedReviews >= 3
        ? 'Среди отзывов есть несколько достаточно подробных разборов, так что впечатление по фильму складывается уверенно.'
        : 'Большая часть отзывов короткая, поэтому сводка опирается на повторяющиеся темы и общий тон.';

    const ratingNote = withRating > 0
        ? `Часть авторов ещё и проставляет собственную оценку, поэтому общий тон подтверждается численно в ${withRating} отзывах.`
        : 'Большинство авторов пишет без личной числовой оценки, поэтому здесь важнее повторяющиеся формулировки, чем цифры.';

    return `${baseSummary} ${densityNote} ${ratingNote}`;
}

function getSummaryPreview(summary: string, maxLength = 150): string {
    if (summary.length <= maxLength) {
        return summary;
    }

    return `${summary.slice(0, maxLength).trimEnd()}…`;
}

function getUsefulReviews(reviews: TMDBReview[]): TMDBReview[] {
    const scoreReview = (review: TMDBReview): number => {
        const contentLength = review.content.trim().length;
        const ratingBonus = typeof review.author_details?.rating === 'number' ? 80 : 0;
        const detailBonus = contentLength >= 500 ? 120 : contentLength >= 250 ? 60 : 0;
        return contentLength + ratingBonus + detailBonus;
    };

    return [...reviews]
        .filter((review) => review.content.trim().length > 0)
        .sort((a, b) => scoreReview(b) - scoreReview(a))
        .slice(0, 3);
}

function getReviewSnippet(content: string, maxLength = 420): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function formatReviewDate(createdAt?: string): string | null {
    if (!createdAt) return null;

    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function buildInterestingFacts(details: TMDBDetailsResult | null): string[] {
    if (!details) return [];

    const facts: string[] = [];

    if (details.production_countries?.length) {
        facts.push(`Производство: ${details.production_countries.slice(0, 2).map((country) => country.name).join(', ')}.`);
    }

    if (details.vote_count) {
        facts.push(`На TMDB уже собрано ${details.vote_count.toLocaleString('ru-RU')} пользовательских оценок.`);
    }

    if (details.spoken_languages?.length) {
        const language = details.spoken_languages[0]?.name || details.spoken_languages[0]?.english_name;
        if (language) {
            facts.push(`Оригинальный язык — ${language}.`);
        }
    }

    if (details.status) {
        facts.push(`Статус релиза: ${details.status}.`);
    }

    return facts.slice(0, 4);
}

function translateMediaType(mediaType: 'movie' | 'tv'): string {
    return mediaType === 'tv' ? 'Сериал' : 'Фильм';
}

function formatAudienceRating(details: TMDBDetailsResult | null): string {
    if (!details?.vote_average) return '—';
    return `${details.vote_average.toFixed(1)}/10`;
}

function getRuntimeLabel(details: TMDBDetailsResult | null): string {
    if (!details) return '—';

    if (details.media_type === 'movie' && details.runtime) {
        return `${details.runtime} мин`;
    }

    if (details.media_type === 'tv') {
        const runtime = details.episode_run_time?.[0];
        if (runtime) {
            return `${runtime} мин / серия`;
        }

        if (details.number_of_seasons) {
            return `${details.number_of_seasons} сезон(ов)`;
        }
    }

    return '—';
}

function normalizeCredits(credits: TMDBPersonCredit[]): TMDBPersonCredit[] {
    const seen = new Set<string>();

    return credits.filter((credit) => {
        const title = credit.title || credit.name || '';
        const key = `${credit.media_type}:${credit.id}:${title}`;

        if (!title || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function pickCrewMembers(crew: TMDBCrewMember[] | undefined, jobs: string[]): TMDBCrewMember[] {
    if (!crew?.length) return [];

    const seen = new Set<number>();
    return crew.filter((member) => {
        if (!jobs.includes(member.job) || seen.has(member.id)) {
            return false;
        }

        seen.add(member.id);
        return true;
    });
}

export function MovieDetailsModal({ visible, item, onClose, onLibraryChanged }: MovieDetailsModalProps) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [details, setDetails] = useState<TMDBDetailsResult | null>(null);
    const [libraryMovie, setLibraryMovie] = useState<Movie | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusPickerVisible, setStatusPickerVisible] = useState(false);
    const [reviewDraft, setReviewDraft] = useState('');
    const [ratingDraft, setRatingDraft] = useState(0);
    const [savingReview, setSavingReview] = useState(false);
    const [showAllCrew, setShowAllCrew] = useState(false);
    const [showFullReviewSummary, setShowFullReviewSummary] = useState(false);

    // Состояния для привязки локальной записи к карточке TMDB
    const [syncSearchVisible, setSyncSearchVisible] = useState(false);
    const [syncQuery, setSyncQuery] = useState('');
    const [syncResults, setSyncResults] = useState<TMDBSearchResult[]>([]);
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncApplying, setSyncApplying] = useState(false);

    const [selectedPerson, setSelectedPerson] = useState<TMDBCastMember | TMDBCrewMember | null>(null);
    const [personDetails, setPersonDetails] = useState<TMDBPersonDetails | null>(null);
    const [personCredits, setPersonCredits] = useState<TMDBPersonCredit[]>([]);
    const [personLoading, setPersonLoading] = useState(false);
    const [personError, setPersonError] = useState<string | null>(null);

    const statusButtonAnim = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const statusButtonVisible = useRef(true);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!visible || !item) return;

            setLoading(true);
            setError(null);
            setShowAllCrew(false);
            setShowFullReviewSummary(false);

            try {
                const tmdbId = getResolvedTmdbId(item);
                const mediaType = getResolvedMediaType(item);
                const shouldLoadRemoteDetails = tmdbId > 0;

                const [existingMovie, remoteDetails] = await Promise.all([
                    findMovieByTmdbId(tmdbId),
                    shouldLoadRemoteDetails && (await isTmdbConfigured())
                        ? getDetailsWithExtras(tmdbId, mediaType)
                        : Promise.resolve(null),
                ]);

                if (!cancelled) {
                    const resolvedMovie = existingMovie ?? (isLibraryMovie(item) ? item : null);
                    setLibraryMovie(resolvedMovie);
                    setDetails(remoteDetails);
                    setRatingDraft(resolvedMovie?.rating ?? 0);
                    setReviewDraft(resolvedMovie?.review ?? '');
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить детали');
                    const fallbackMovie = isLibraryMovie(item) ? item : null;
                    setLibraryMovie(fallbackMovie);
                    setRatingDraft(fallbackMovie?.rating ?? 0);
                    setReviewDraft(fallbackMovie?.review ?? '');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [visible, item]);

    useEffect(() => {
        if (!visible) {
            Animated.timing(statusButtonAnim, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }).start();
            statusButtonVisible.current = true;
        } else {
            Animated.timing(statusButtonAnim, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }).start();
            statusButtonVisible.current = true;
        }
    }, [visible, statusButtonAnim]);

    useEffect(() => {
        let cancelled = false;

        async function loadPerson() {
            if (!selectedPerson) return;

            setPersonLoading(true);
            setPersonError(null);

            try {
                const [detailsResponse, creditsResponse] = await Promise.all([
                    getPersonDetails(selectedPerson.id),
                    getPersonCredits(selectedPerson.id),
                ]);

                if (!cancelled) {
                    setPersonDetails(detailsResponse);
                    setPersonCredits(normalizeCredits(creditsResponse).slice(0, 20));
                }
            } catch (personLoadError) {
                if (!cancelled) {
                    setPersonError(personLoadError instanceof Error ? personLoadError.message : 'Не удалось загрузить фильмографию');
                }
            } finally {
                if (!cancelled) {
                    setPersonLoading(false);
                }
            }
        }

        loadPerson();

        return () => {
            cancelled = true;
        };
    }, [selectedPerson]);

    const reviewSummary = useMemo(() => buildReviewSummary(details?.reviews?.results ?? []), [details]);
    const expandedReviewSummary = useMemo(() => buildExpandedReviewSummary(details?.reviews?.results ?? []), [details]);
    const reviewSummaryPreview = useMemo(() => getSummaryPreview(expandedReviewSummary), [expandedReviewSummary]);
    const usefulReviews = useMemo(() => getUsefulReviews(details?.reviews?.results ?? []), [details]);
    const interestingFacts = useMemo(() => buildInterestingFacts(details), [details]);

    const directors = useMemo(() => pickCrewMembers(details?.credits?.crew, ['Director']), [details]);
    const writers = useMemo(
        () => pickCrewMembers(details?.credits?.crew, ['Writer', 'Screenplay', 'Story']),
        [details],
    );
    const extraCrew = useMemo(() => {
        const excludedIds = new Set([...directors, ...writers].map((member) => member.id));
        return (details?.credits?.crew || []).filter((member) => !excludedIds.has(member.id)).slice(0, 12);
    }, [details, directors, writers]);

    if (!item) {
        return null;
    }

    const posterUrl = getPosterUrl(getResolvedPoster(item, details));
    const title = getResolvedTitle(item, details);
    const overview = getResolvedOverview(item, details);
    const releaseDate = getResolvedReleaseDate(item, details);
    const year = releaseDate?.split('-')[0];
    const mediaType = getResolvedMediaType(item);
    const statusMeta = libraryMovie ? WATCH_STATUS_META[libraryMovie.status] : null;
    const topCast = details?.credits?.cast?.slice(0, 10) ?? [];
    const genresLabel = details?.genres?.length ? details.genres.map((genre) => genre.name).join(', ') : '—';
    const stickyTranslateY = statusButtonAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [120, 0],
    });
    const isSparseLibraryEntry = !details && !posterUrl && !overview && !releaseDate;
    const isLocalOnlyMovie = Boolean(libraryMovie?.id && libraryMovie.tmdb_id < 0);

    const openSyncSearch = async () => {
        setSyncQuery(title === 'Без названия' ? '' : title);
        setSyncResults([]);
        setSyncError(null);
        setSyncSearchVisible(true);

        try {
            setSyncLoading(true);
            const configured = await isTmdbConfigured();
            if (!configured) {
                setSyncError('Не задан TMDB API-ключ. Добавьте его в Настройках.');
                return;
            }
            const initialQuery = title === 'Без названия' ? '' : title;
            if (initialQuery.trim().length >= 2) {
                const data = await searchMulti(initialQuery);
                setSyncResults(data);
            }
        } catch (searchErr) {
            setSyncError(searchErr instanceof Error ? searchErr.message : 'Ошибка поиска TMDB');
        } finally {
            setSyncLoading(false);
        }
    };

    const handleSyncSearchSubmit = async () => {
        const trimmed = syncQuery.trim();
        if (trimmed.length < 2) return;

        try {
            setSyncLoading(true);
            setSyncError(null);
            const data = await searchMulti(trimmed);
            setSyncResults(data);
        } catch (searchErr) {
            setSyncError(searchErr instanceof Error ? searchErr.message : 'Ошибка поиска TMDB');
            setSyncResults([]);
        } finally {
            setSyncLoading(false);
        }
    };

    const handleApplySyncCandidate = async (candidate: TMDBSearchResult) => {
        if (!libraryMovie?.id) return;

        const candidateTitle = candidate.title || candidate.name || '';
        if (!candidateTitle) return;

        try {
            setSyncApplying(true);
            const candidateMediaType = candidate.media_type === 'tv' ? 'tv' : 'movie';
            const existing = await findMovieByTmdbId(candidate.id);

            // Если такой фильм уже есть в библиотеке — не создаём дубликат
            if (existing && existing.id !== libraryMovie.id) {
                Alert.alert(
                    'Уже в библиотеке',
                    'Эта карточка TMDB уже привязана к другой записи в библиотеке.',
                );
                return;
            }

            await syncMovieWithTmdb(libraryMovie.id, {
                tmdb_id: candidate.id,
                media_type: candidateMediaType,
                title: candidateTitle,
                poster_path: candidate.poster_path,
                release_date: candidate.release_date || candidate.first_air_date || null,
                overview: candidate.overview || null,
            });

            const now = new Date().toISOString();
            setLibraryMovie({
                ...libraryMovie,
                tmdb_id: candidate.id,
                media_type: candidateMediaType,
                title: candidateTitle,
                poster_path: candidate.poster_path,
                release_date: candidate.release_date || candidate.first_air_date || null,
                overview: candidate.overview || null,
                updated_at: now,
            });

            // Подтягиваем полные детали TMDB для обновлённой записи
            try {
                const remoteDetails = await getDetailsWithExtras(candidate.id, candidateMediaType);
                setDetails(remoteDetails);
            } catch {
                setDetails(null);
            }

            setSyncSearchVisible(false);
            onLibraryChanged?.();
            Alert.alert('Готово', 'Запись привязана к карточке TMDB.');
        } catch (applyErr) {
            Alert.alert('Ошибка', applyErr instanceof Error ? applyErr.message : 'Не удалось привязать карточку.');
        } finally {
            setSyncApplying(false);
        }
    };

    const ensureMovieForReview = async (): Promise<Movie> => {
        if (libraryMovie?.id) {
            return libraryMovie;
        }

        const now = new Date().toISOString();
        const movieBase = {
            tmdb_id: getResolvedTmdbId(item),
            media_type: mediaType,
            title,
            poster_path: getResolvedPoster(item, details),
            release_date: releaseDate,
            overview,
            status: 'planned' as WatchStatus,
            rating: ratingDraft,
            review: reviewDraft.trim() || null,
            created_at: now,
            updated_at: now,
        };

        const id = await addOrUpdateMovie(movieBase);
        const createdMovie: Movie = { id, ...movieBase };
        setLibraryMovie(createdMovie);
        return createdMovie;
    };

    const handleStatusChange = async (status: WatchStatus) => {
        const now = new Date().toISOString();
        const movieBase = {
            tmdb_id: getResolvedTmdbId(item),
            media_type: mediaType,
            title,
            poster_path: getResolvedPoster(item, details),
            release_date: releaseDate,
            overview,
            status,
            rating: libraryMovie?.rating ?? ratingDraft,
            review: libraryMovie?.review ?? (reviewDraft.trim() || null),
            created_at: libraryMovie?.created_at ?? now,
            updated_at: now,
        };

        if (libraryMovie?.id) {
            await updateMovieStatus(libraryMovie.id, status);
            setLibraryMovie({ ...libraryMovie, status, updated_at: now });
        } else {
            const id = await addOrUpdateMovie(movieBase);
            setLibraryMovie({ id, ...movieBase });
        }

        onLibraryChanged?.();
    };

    const handleSaveReview = async () => {
        try {
            setSavingReview(true);
            const movie = await ensureMovieForReview();
            await updateMovieRatingAndReview(movie.id!, ratingDraft, reviewDraft.trim() || null);
            setLibraryMovie({
                ...movie,
                rating: ratingDraft,
                review: reviewDraft.trim() || null,
                updated_at: new Date().toISOString(),
            });
            onLibraryChanged?.();
            Alert.alert('Сохранено', 'Оценка и отзыв обновлены.');
        } catch (saveError) {
            console.error('Ошибка сохранения отзыва:', saveError);
            Alert.alert('Ошибка', 'Не удалось сохранить оценку и отзыв.');
        } finally {
            setSavingReview(false);
        }
    };

    const handleScroll = (event: any) => {
        const currentY = event.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;

        if (Math.abs(diff) < 14) {
            return;
        }

        if (diff > 0 && currentY > 80 && statusButtonVisible.current) {
            statusButtonVisible.current = false;
            Animated.timing(statusButtonAnim, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }).start();
        } else if (diff < 0 && !statusButtonVisible.current) {
            statusButtonVisible.current = true;
            Animated.timing(statusButtonAnim, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }).start();
        }

        lastScrollY.current = currentY;
    };

    const renderPersonCard = (person: TMDBCastMember | TMDBCrewMember, subtitle?: string) => {
        const imageUrl = getProfileUrl(person.profile_path);

        return (
            <TouchableOpacity
                key={`${person.id}-${subtitle || person.name}`}
                style={styles.personCard}
                activeOpacity={0.85}
                onPress={() => setSelectedPerson(person)}
            >
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.personAvatar} />
                ) : (
                    <View style={[styles.personAvatar, styles.personAvatarFallback]}>
                        <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                    </View>
                )}
                <View style={styles.personInfo}>
                    <Text style={styles.personName} numberOfLines={1}>{person.name}</Text>
                    {subtitle ? <Text style={styles.personSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.headerIconBtn}>
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle} numberOfLines={1}>Карточка фильма</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.content}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    >
                        {isSparseLibraryEntry ? (
                            <View style={styles.localEntryHero}>
                                <View style={styles.localEntryIconWrap}>
                                    <Ionicons name="document-text-outline" size={32} color={colors.primary} />
                                </View>
                                <View style={styles.localEntryContent}>
                                    <Text style={styles.title}>{title}</Text>
                                    <Text style={styles.metaText}>Локальная запись без карточки TMDB</Text>
                                    {statusMeta ? (
                                        <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}22` }]}>
                                            <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
                                            <Text style={[styles.statusText, { color: statusMeta.color }]}>
                                                {statusMeta.label}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.statusHintRow}>
                                            <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
                                            <Text style={styles.statusHintText}>Запись ещё не добавлена в библиотеку</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View style={styles.heroCard}>
                                {posterUrl ? (
                                    <Image source={{ uri: posterUrl }} style={styles.poster} />
                                ) : (
                                    <View style={[styles.poster, styles.posterFallback]}>
                                        <Ionicons name="film-outline" size={36} color={colors.textMuted} />
                                    </View>
                                )}

                                <View style={styles.heroInfo}>
                                    <Text style={styles.title}>{title}</Text>

                                    <Text style={styles.metaText}>
                                        {translateMediaType(mediaType)}{year ? ` • ${year}` : ''}
                                    </Text>

                                    {details?.tagline ? (
                                        <Text style={styles.tagline}>{details.tagline}</Text>
                                    ) : null}

                                    {statusMeta ? (
                                        <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}22` }]}>
                                            <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
                                            <Text style={[styles.statusText, { color: statusMeta.color }]}>
                                                {statusMeta.label}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.statusHintRow}>
                                            <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
                                            <Text style={styles.statusHintText}>Фильм ещё не добавлен в библиотеку</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {loading ? (
                            <View style={styles.loadingWrap}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.loadingText}>Подгружаю оценки, отзывы и актёров…</Text>
                            </View>
                        ) : null}

                        {error ? (
                            <View style={styles.infoCard}>
                                <Text style={styles.sectionTitle}>Подробности пока недоступны</Text>
                                <Text style={styles.infoText}>{error}</Text>
                            </View>
                        ) : null}

                        {isSparseLibraryEntry ? (
                            <View style={styles.infoCard}>
                                <Text style={styles.sectionTitle}>Локальная запись</Text>
                                <Text style={styles.infoText}>
                                    Эта запись была добавлена без карточки TMDB, поэтому здесь нет постера, актёров и расширенных фактов.
                                    Всё ещё можно удобно менять статус, поставить личную оценку и написать свой отзыв.
                                </Text>
                                {isLocalOnlyMovie ? (
                                    <TouchableOpacity
                                        style={styles.syncButton}
                                        onPress={openSyncSearch}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="link-outline" size={18} color={colors.textPrimary} />
                                        <Text style={styles.syncButtonText}>Найти в TMDB и привязать</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ) : (
                            <>
                                <View style={styles.metadataGrid}>
                                    <View style={styles.metadataCard}>
                                        <Text style={styles.metadataLabel}>Жанры</Text>
                                        <Text style={styles.metadataValue}>{genresLabel}</Text>
                                    </View>
                                    <View style={styles.metadataCard}>
                                        <Text style={styles.metadataLabel}>Длительность</Text>
                                        <Text style={styles.metadataValue}>{getRuntimeLabel(details)}</Text>
                                    </View>
                                </View>

                                <View style={styles.scoreRow}>
                                    <View style={styles.scoreCard}>
                                        <Text style={styles.scoreLabel}>Рейтинг TMDB</Text>
                                        <Text style={styles.scoreValue}>{formatAudienceRating(details)}</Text>
                                        <Text style={styles.scoreSubtext}>
                                            {details?.vote_count
                                                ? `${details.vote_count.toLocaleString('ru-RU')} оценок пользователей`
                                                : 'Пока недостаточно оценок'}
                                        </Text>
                                    </View>

                                    <View style={styles.scoreCard}>
                                        <Text style={styles.scoreLabel}>Краткая сводка отзывов</Text>
                                        <Text style={styles.summaryText}>
                                            {showFullReviewSummary ? expandedReviewSummary : reviewSummaryPreview}
                                        </Text>
                                        {expandedReviewSummary !== reviewSummaryPreview ? (
                                            <TouchableOpacity
                                                style={styles.summaryToggleButton}
                                                onPress={() => setShowFullReviewSummary((value) => !value)}
                                                activeOpacity={0.85}
                                            >
                                                <Text style={styles.summaryToggleText}>
                                                    {showFullReviewSummary ? 'Свернуть' : 'Ещё'}
                                                </Text>
                                                <Ionicons
                                                    name={showFullReviewSummary ? 'chevron-up' : 'chevron-down'}
                                                    size={16}
                                                    color={colors.primary}
                                                />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>

                                {showFullReviewSummary && usefulReviews.length > 0 ? (
                                    <View style={styles.infoCard}>
                                        <View style={styles.sectionHeaderRow}>
                                            <Text style={styles.sectionTitle}>Полезные отзывы</Text>
                                            <Text style={styles.sectionHelper}>Не последние, а самые содержательные</Text>
                                        </View>
                                        {usefulReviews.map((review) => {
                                            const reviewMeta = [
                                                typeof review.author_details?.rating === 'number'
                                                    ? `${review.author_details.rating}/10`
                                                    : null,
                                                formatReviewDate(review.created_at),
                                            ]
                                                .filter(Boolean)
                                                .join(' • ');

                                            return (
                                                <View key={review.id} style={styles.usefulReviewCard}>
                                                    <View style={styles.usefulReviewHeader}>
                                                        <Text style={styles.usefulReviewAuthor}>{review.author}</Text>
                                                        {reviewMeta ? (
                                                            <Text style={styles.usefulReviewMeta}>{reviewMeta}</Text>
                                                        ) : null}
                                                    </View>
                                                    <Text style={styles.usefulReviewText}>{getReviewSnippet(review.content)}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : null}

                                {overview ? (
                                    <View style={styles.infoCard}>
                                        <Text style={styles.sectionTitle}>О чём фильм</Text>
                                        <Text style={styles.infoText}>{overview}</Text>
                                    </View>
                                ) : null}

                                <View style={styles.infoCard}>
                                    <Text style={styles.sectionTitle}>Режиссёр и сценарий</Text>
                                    {directors.length ? (
                                        <>
                                            <Text style={styles.groupLabel}>Режиссёр</Text>
                                            {directors.map((person) => renderPersonCard(person, person.job))}
                                        </>
                                    ) : null}

                                    {writers.length ? (
                                        <>
                                            <Text style={[styles.groupLabel, directors.length ? styles.groupLabelSpacing : null]}>Сценарий</Text>
                                            {writers.map((person) => renderPersonCard(person, person.job))}
                                        </>
                                    ) : null}

                                    {!directors.length && !writers.length ? (
                                        <Text style={styles.infoText}>Состав команды появится, когда будут доступны подробности TMDB.</Text>
                                    ) : null}

                                    {extraCrew.length ? (
                                        <>
                                            <TouchableOpacity
                                                style={styles.moreButton}
                                                onPress={() => setShowAllCrew((value) => !value)}
                                            >
                                                <Text style={styles.moreButtonText}>{showAllCrew ? 'Скрыть остальную команду' : 'Ещё команда'}</Text>
                                                <Ionicons
                                                    name={showAllCrew ? 'chevron-up' : 'chevron-down'}
                                                    size={18}
                                                    color={colors.primary}
                                                />
                                            </TouchableOpacity>

                                            {showAllCrew ? extraCrew.map((person) => renderPersonCard(person, person.job)) : null}
                                        </>
                                    ) : null}
                                </View>

                                <View style={styles.infoCard}>
                                    <View style={styles.sectionHeaderRow}>
                                        <Text style={styles.sectionTitle}>Актёры</Text>
                                        <Text style={styles.sectionHelper}>Нажми, чтобы открыть фильмографию</Text>
                                    </View>
                                    {topCast.length > 0 ? (
                                        topCast.map((castMember) => renderPersonCard(castMember, castMember.character))
                                    ) : (
                                        <Text style={styles.infoText}>Список актёров загрузится, когда будет доступен TMDB API.</Text>
                                    )}
                                </View>
                            </>
                        )}

                        <View style={styles.infoCard}>
                            <Text style={styles.sectionTitle}>Твоя оценка и отзыв</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratingRow}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                                    <TouchableOpacity
                                        key={score}
                                        style={[
                                            styles.ratingChip,
                                            ratingDraft === score && styles.ratingChipActive,
                                        ]}
                                        onPress={() => setRatingDraft(score)}
                                    >
                                        <Text
                                            style={[
                                                styles.ratingChipText,
                                                ratingDraft === score && styles.ratingChipTextActive,
                                            ]}
                                        >
                                            {score}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <TextInput
                                style={styles.reviewInput}
                                multiline
                                value={reviewDraft}
                                onChangeText={setReviewDraft}
                                placeholder="Что понравилось или не понравилось? Этот отзыв сохранится локально и будет использоваться в рекомендациях."
                                placeholderTextColor={colors.textMuted}
                                textAlignVertical="top"
                            />

                            <TouchableOpacity
                                style={styles.saveReviewButton}
                                onPress={handleSaveReview}
                                disabled={savingReview}
                            >
                                <Ionicons name="save-outline" size={18} color={colors.textPrimary} />
                                <Text style={styles.saveReviewButtonText}>{savingReview ? 'Сохраняю...' : 'Сохранить оценку и отзыв'}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.infoCard}>
                            <Text style={styles.sectionTitle}>Интересные факты без спойлеров</Text>
                            {interestingFacts.length > 0 ? (
                                interestingFacts.map((fact) => (
                                    <View key={fact} style={styles.factRow}>
                                        <Ionicons name="sparkles-outline" size={16} color={colors.primaryLight} />
                                        <Text style={styles.factText}>{fact}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.infoText}>
                                    Здесь появятся факты о языке, производстве и статусе релиза, когда загрузятся детали фильма.
                                </Text>
                            )}
                        </View>
                    </ScrollView>

                    <Animated.View
                        style={[
                            styles.stickyStatusWrap,
                            { transform: [{ translateY: stickyTranslateY }] },
                        ]}
                    >
                        <TouchableOpacity
                            style={[styles.stickyStatusButton, statusMeta ? { backgroundColor: statusMeta.color } : null]}
                            onPress={() => setStatusPickerVisible(true)}
                            activeOpacity={0.9}
                        >
                            <Ionicons
                                name={statusMeta ? 'swap-horizontal' : 'add-circle-outline'}
                                size={20}
                                color={colors.textPrimary}
                            />
                            <Text style={styles.stickyStatusText}>
                                {statusMeta ? `Статус: ${statusMeta.label}` : 'Добавить в библиотеку'}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            <StatusPickerModal
                visible={statusPickerVisible}
                currentStatus={libraryMovie?.status ?? null}
                title={libraryMovie ? 'Изменить статус' : 'Добавить в библиотеку'}
                onClose={() => setStatusPickerVisible(false)}
                onSelect={handleStatusChange}
            />

            {/* Модал привязки локальной записи к карточке TMDB */}
            <Modal
                visible={syncSearchVisible}
                animationType="slide"
                onRequestClose={() => setSyncSearchVisible(false)}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setSyncSearchVisible(false)} style={styles.headerIconBtn}>
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle} numberOfLines={1}>Привязка к TMDB</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    <View style={styles.syncSearchRow}>
                        <TextInput
                            style={styles.syncSearchInput}
                            value={syncQuery}
                            onChangeText={setSyncQuery}
                            onSubmitEditing={handleSyncSearchSubmit}
                            placeholder="Название фильма или сериала…"
                            placeholderTextColor={colors.textMuted}
                            returnKeyType="search"
                        />
                        <TouchableOpacity
                            style={styles.syncSearchButton}
                            onPress={handleSyncSearchSubmit}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="search" size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        {syncLoading ? (
                            <View style={styles.centeredCard}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.loadingText}>Ищу похожие карточки…</Text>
                            </View>
                        ) : syncError ? (
                            <View style={styles.infoCard}>
                                <Text style={styles.sectionTitle}>Не удалось выполнить поиск</Text>
                                <Text style={styles.infoText}>{syncError}</Text>
                            </View>
                        ) : syncResults.length === 0 ? (
                            <View style={styles.infoCard}>
                                <Text style={styles.sectionTitle}>Ничего не найдено</Text>
                                <Text style={styles.infoText}>
                                    Попробуй изменить запрос. Если подходящей карточки нет — запись можно оставить локальной, она никуда не денется.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.infoCard}>
                                <Text style={styles.sectionTitle}>Выбери подходящую карточку</Text>
                                {syncResults.map((candidate) => {
                                    const candidateTitle = candidate.title || candidate.name || 'Без названия';
                                    const candidateYear = (candidate.release_date || candidate.first_air_date || '').split('-')[0];
                                    const candidatePoster = getPosterUrl(candidate.poster_path);

                                    return (
                                        <TouchableOpacity
                                            key={`${candidate.media_type || 'movie'}-${candidate.id}`}
                                            style={styles.syncCandidateRow}
                                            onPress={() => handleApplySyncCandidate(candidate)}
                                            disabled={syncApplying}
                                            activeOpacity={0.85}
                                        >
                                            {candidatePoster ? (
                                                <Image source={{ uri: candidatePoster }} style={styles.syncCandidatePoster} />
                                            ) : (
                                                <View style={[styles.syncCandidatePoster, styles.posterFallback]}>
                                                    <Ionicons name="film-outline" size={18} color={colors.textMuted} />
                                                </View>
                                            )}
                                            <View style={styles.syncCandidateInfo}>
                                                <Text style={styles.syncCandidateTitle} numberOfLines={2}>{candidateTitle}</Text>
                                                <Text style={styles.syncCandidateMeta}>
                                                    {translateMediaType(candidate.media_type === 'tv' ? 'tv' : 'movie')}
                                                    {candidateYear ? ` • ${candidateYear}` : ''}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.syncKeepLocalButton}
                            onPress={() => setSyncSearchVisible(false)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                            <Text style={styles.syncKeepLocalText}>Оставить локальную запись как есть</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>

            <Modal
                visible={!!selectedPerson}
                animationType="slide"
                onRequestClose={() => {
                    setSelectedPerson(null);
                    setPersonCredits([]);
                    setPersonDetails(null);
                }}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => {
                                setSelectedPerson(null);
                                setPersonCredits([]);
                                setPersonDetails(null);
                            }}
                            style={styles.headerIconBtn}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle} numberOfLines={1}>Фильмография</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        {personLoading ? (
                            <View style={styles.centeredCard}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.loadingText}>Загружаю фильмографию…</Text>
                            </View>
                        ) : personError ? (
                            <View style={styles.infoCard}>
                                <Text style={styles.sectionTitle}>Не удалось загрузить данные</Text>
                                <Text style={styles.infoText}>{personError}</Text>
                            </View>
                        ) : (
                            <>
                                {selectedPerson ? (
                                    <View style={styles.infoCard}>
                                        <View style={styles.personHeroRow}>
                                            {getProfileUrl(personDetails?.profile_path || selectedPerson.profile_path) ? (
                                                <Image
                                                    source={{ uri: getProfileUrl(personDetails?.profile_path || selectedPerson.profile_path)! }}
                                                    style={styles.personHeroAvatar}
                                                />
                                            ) : (
                                                <View style={[styles.personHeroAvatar, styles.personAvatarFallback]}>
                                                    <Ionicons name="person-outline" size={28} color={colors.textMuted} />
                                                </View>
                                            )}
                                            <View style={styles.personHeroText}>
                                                <Text style={styles.personHeroName}>{personDetails?.name || selectedPerson.name}</Text>
                                                <Text style={styles.personHeroSubtitle}>
                                                    {personDetails?.known_for_department || ('job' in selectedPerson ? selectedPerson.job : 'Актёр')}
                                                </Text>
                                                {personDetails?.birthday ? (
                                                    <Text style={styles.personHeroMeta}>Дата рождения: {personDetails.birthday}</Text>
                                                ) : null}
                                                {personDetails?.place_of_birth ? (
                                                    <Text style={styles.personHeroMeta}>Место рождения: {personDetails.place_of_birth}</Text>
                                                ) : null}
                                            </View>
                                        </View>
                                        {personDetails?.biography ? (
                                            <Text style={styles.personBio} numberOfLines={6}>{personDetails.biography}</Text>
                                        ) : null}
                                    </View>
                                ) : null}

                                <View style={styles.infoCard}>
                                    <Text style={styles.sectionTitle}>Фильмы и сериалы</Text>
                                    {personCredits.length ? (
                                        personCredits.map((credit) => (
                                            <View key={`${credit.media_type}-${credit.id}`} style={styles.creditRow}>
                                                {getPosterUrl(credit.poster_path) ? (
                                                    <Image source={{ uri: getPosterUrl(credit.poster_path)! }} style={styles.creditPoster} />
                                                ) : (
                                                    <View style={[styles.creditPoster, styles.posterFallback]}>
                                                        <Ionicons name="film-outline" size={18} color={colors.textMuted} />
                                                    </View>
                                                )}
                                                <View style={styles.creditInfo}>
                                                    <Text style={styles.creditTitle}>{credit.title || credit.name || 'Без названия'}</Text>
                                                    <Text style={styles.creditMeta}>
                                                        {credit.media_type === 'tv' ? 'Сериал' : 'Фильм'}
                                                        {(credit.release_date || credit.first_air_date)
                                                            ? ` • ${(credit.release_date || credit.first_air_date || '').split('-')[0]}`
                                                            : ''}
                                                    </Text>
                                                    <Text style={styles.creditMeta} numberOfLines={2}>
                                                        {credit.character || credit.job || 'Участие в проекте'}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.infoText}>TMDB не вернул фильмографию для этого человека.</Text>
                                    )}
                                </View>
                            </>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </>
    );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: SPACING.md,
            paddingTop: SPACING.lg,
            paddingBottom: SPACING.md,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        headerIconBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceLight,
        },
        headerSpacer: {
            width: 40,
            height: 40,
        },
        headerTitle: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: FONT_SIZES.lg,
            fontWeight: '700',
            textAlign: 'center',
            marginHorizontal: SPACING.md,
        },
        content: {
            padding: SPACING.md,
            paddingBottom: 120,
        },
        heroCard: {
            flexDirection: 'row',
            marginBottom: SPACING.md,
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
        },
        poster: {
            width: 130,
            height: 195,
            backgroundColor: colors.surfaceLight,
        },
        posterFallback: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        heroInfo: {
            flex: 1,
            padding: SPACING.md,
            justifyContent: 'center',
        },
        localEntryHero: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: SPACING.md,
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            padding: SPACING.md,
        },
        localEntryIconWrap: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: `${colors.primary}14`,
            alignItems: 'center',
            justifyContent: 'center',
        },
        localEntryContent: {
            flex: 1,
            marginLeft: SPACING.md,
        },
        title: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.xl,
            fontWeight: '700',
            marginBottom: SPACING.xs,
        },
        metaText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            marginBottom: SPACING.sm,
        },
        tagline: {
            color: colors.primaryLight,
            fontSize: FONT_SIZES.sm,
            fontStyle: 'italic',
            marginBottom: SPACING.md,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
            borderRadius: RADIUS.xl,
        },
        statusDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: SPACING.xs,
        },
        statusText: {
            fontSize: FONT_SIZES.xs,
            fontWeight: '700',
        },
        statusHintRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        statusHintText: {
            color: colors.primary,
            fontSize: FONT_SIZES.sm,
            marginLeft: SPACING.xs,
        },
        loadingWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: SPACING.md,
        },
        loadingText: {
            color: colors.textSecondary,
            marginLeft: SPACING.sm,
        },
        metadataGrid: {
            flexDirection: 'row',
            gap: SPACING.md,
            marginBottom: SPACING.md,
        },
        metadataCard: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.md,
        },
        metadataLabel: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            marginBottom: SPACING.xs,
        },
        metadataValue: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.md,
            fontWeight: '600',
            lineHeight: 22,
        },
        scoreRow: {
            flexDirection: 'row',
            gap: SPACING.md,
            marginBottom: SPACING.md,
        },
        scoreCard: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.md,
        },
        scoreLabel: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            marginBottom: SPACING.xs,
        },
        scoreValue: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.xxl,
            fontWeight: '700',
            marginBottom: SPACING.xs,
        },
        scoreSubtext: {
            color: colors.textMuted,
            fontSize: FONT_SIZES.xs,
            lineHeight: 18,
        },
        summaryText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
        },
        summaryToggleButton: {
            marginTop: SPACING.sm,
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
        },
        summaryToggleText: {
            color: colors.primary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginRight: SPACING.xs,
        },
        usefulReviewCard: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: SPACING.md,
            marginTop: SPACING.md,
        },
        usefulReviewHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: SPACING.sm,
            marginBottom: SPACING.xs,
        },
        usefulReviewAuthor: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            flex: 1,
        },
        usefulReviewMeta: {
            color: colors.textMuted,
            fontSize: FONT_SIZES.xs,
        },
        usefulReviewText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 22,
        },
        infoCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.md,
            marginBottom: SPACING.md,
        },
        centeredCard: {
            backgroundColor: colors.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACING.lg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        sectionHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: SPACING.sm,
        },
        sectionTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.md,
            fontWeight: '700',
            marginBottom: SPACING.sm,
        },
        sectionHelper: {
            color: colors.textMuted,
            fontSize: FONT_SIZES.xs,
            marginBottom: SPACING.sm,
        },
        infoText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 22,
        },
        groupLabel: {
            color: colors.primaryLight,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginBottom: SPACING.sm,
        },
        groupLabelSpacing: {
            marginTop: SPACING.md,
        },
        personCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceLight,
            borderRadius: RADIUS.md,
            padding: SPACING.sm,
            marginBottom: SPACING.sm,
        },
        personAvatar: {
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.inputBg,
        },
        personAvatarFallback: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        personInfo: {
            flex: 1,
            marginLeft: SPACING.sm,
        },
        personName: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '600',
        },
        personSubtitle: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.xs,
            marginTop: 2,
        },
        moreButton: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            marginTop: SPACING.xs,
            marginBottom: SPACING.sm,
        },
        moreButtonText: {
            color: colors.primary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginRight: SPACING.xs,
        },
        ratingRow: {
            paddingBottom: SPACING.sm,
        },
        ratingChip: {
            width: 42,
            height: 42,
            borderRadius: 21,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: SPACING.sm,
        },
        ratingChipActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        ratingChipText: {
            color: colors.textPrimary,
            fontWeight: '700',
        },
        ratingChipTextActive: {
            color: colors.textPrimary,
        },
        reviewInput: {
            minHeight: 120,
            marginTop: SPACING.sm,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: RADIUS.md,
            padding: SPACING.md,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceLight,
            fontSize: FONT_SIZES.sm,
        },
        saveReviewButton: {
            marginTop: SPACING.md,
            backgroundColor: colors.primary,
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        saveReviewButtonText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginLeft: SPACING.xs,
        },
        factRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginBottom: SPACING.sm,
        },
        factText: {
            flex: 1,
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
            marginLeft: SPACING.sm,
        },
        stickyStatusWrap: {
            position: 'absolute',
            left: SPACING.md,
            right: SPACING.md,
            bottom: SPACING.lg,
        },
        stickyStatusButton: {
            backgroundColor: colors.primary,
            borderRadius: RADIUS.xl,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 10,
        },
        stickyStatusText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.md,
            fontWeight: '700',
            marginLeft: SPACING.sm,
        },
        personHeroRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        personHeroAvatar: {
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: colors.surfaceLight,
        },
        personHeroText: {
            flex: 1,
            marginLeft: SPACING.md,
        },
        personHeroName: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.lg,
            fontWeight: '700',
        },
        personHeroSubtitle: {
            color: colors.primaryLight,
            fontSize: FONT_SIZES.sm,
            marginTop: 4,
        },
        personHeroMeta: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.xs,
            marginTop: 4,
        },
        personBio: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.sm,
            lineHeight: 20,
            marginTop: SPACING.md,
        },
        creditRow: {
            flexDirection: 'row',
            backgroundColor: colors.surfaceLight,
            borderRadius: RADIUS.md,
            padding: SPACING.sm,
            marginBottom: SPACING.sm,
        },
        creditPoster: {
            width: 54,
            height: 78,
            borderRadius: RADIUS.sm,
            backgroundColor: colors.inputBg,
        },
        creditInfo: {
            flex: 1,
            marginLeft: SPACING.sm,
            justifyContent: 'center',
        },
        creditTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
        },
        creditMeta: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.xs,
            marginTop: 4,
            lineHeight: 18,
        },
        syncButton: {
            marginTop: SPACING.md,
            backgroundColor: colors.primary,
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        syncButtonText: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginLeft: SPACING.xs,
        },
        syncSearchRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: SPACING.md,
            paddingTop: SPACING.md,
            gap: SPACING.sm,
        },
        syncSearchInput: {
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: RADIUS.md,
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.sm,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceLight,
            fontSize: FONT_SIZES.md,
        },
        syncSearchButton: {
            width: 44,
            height: 44,
            borderRadius: RADIUS.md,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        syncCandidateRow: {
            flexDirection: 'row',
            backgroundColor: colors.surfaceLight,
            borderRadius: RADIUS.md,
            padding: SPACING.sm,
            marginBottom: SPACING.sm,
        },
        syncCandidatePoster: {
            width: 54,
            height: 78,
            borderRadius: RADIUS.sm,
            backgroundColor: colors.inputBg,
        },
        syncCandidateInfo: {
            flex: 1,
            marginLeft: SPACING.sm,
            justifyContent: 'center',
        },
        syncCandidateTitle: {
            color: colors.textPrimary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
        },
        syncCandidateMeta: {
            color: colors.textSecondary,
            fontSize: FONT_SIZES.xs,
            marginTop: 4,
        },
        syncKeepLocalButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: SPACING.md,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: RADIUS.md,
            borderStyle: 'dashed',
        },
        syncKeepLocalText: {
            color: colors.primary,
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            marginLeft: SPACING.xs,
        },
    });
}

