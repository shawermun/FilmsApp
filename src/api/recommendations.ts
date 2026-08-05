import type {
    AIRecommendation,
    ProviderType,
    RecommendationPromptInput,
} from '../types';
import { PROVIDER_META } from '../constants/providers';
import { getActiveProvider, getConfiguredApiKey } from '../database/settings';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-haiku-latest';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const AI_REQUEST_TIMEOUT_MS = 90000;

/**
 * Приоритет при автоподборе модели Gemini: от новых к старым.
 * Модель выбирается из реально доступных ключу (через ListModels).
 */
const GEMINI_MODEL_PREFERENCE = ['gemini-3', 'gemini-2.5', 'gemini-2.0'];
const GEMINI_FLASH_PATTERN = /^gemini-[\d.]+-flash/;

interface RecommendationProviderStatus {
    providerType: ProviderType | null;
    providerLabel: string;
    configured: boolean;
    reason?: string;
}

function formatList(title: string, items: string[]): string {
    if (!items.length) return '';
    return `${title}: ${items.join(', ')}`;
}

function buildPrompt(input: RecommendationPromptInput): string {
    const watchedList = input.watchedMovies.length
        ? input.watchedMovies
            .map((movie, index) => {
                const review = movie.review ? ` | Отзыв: "${movie.review}"` : '';
                const score = movie.rating > 0 ? `${movie.rating}/10` : 'без личной оценки';

                return `${index + 1}. "${movie.title}" (${movie.release_date?.split('-')[0] || 'год неизвестен'}) — Оценка: ${score}${review}`;
            })
            .join('\n')
        : 'Пользователь ещё не заполнил просмотренные фильмы с оценками.';

    const preferenceSections = [
        input.freeformPrompt.trim()
            ? `Свободное описание вкуса пользователя: ${input.freeformPrompt.trim()}`
            : '',
        formatList('Любимые жанры', input.favoriteGenres),
        formatList('Жанры, которые не нравятся', input.dislikedGenres),
        formatList('Любимые фильмы и сериалы', input.favoriteTitles),
        formatList('Нужное настроение / атмосфера', input.moodKeywords),
        formatList('Чего лучше избегать', input.avoidKeywords),
    ].filter(Boolean);

    const preferencesBlock = preferenceSections.length
        ? preferenceSections.join('\n')
        : 'Дополнительные пользовательские предпочтения не указаны.';

    return `Ты — опытный кинокуратор и помощник по подбору фильмов и сериалов.

Тебе нужно предложить персональные рекомендации на основе просмотренного и явных предпочтений пользователя.

Просмотренные и оценённые фильмы пользователя:
${watchedList}

Дополнительные предпочтения:
${preferencesBlock}

Правила:
1. Предложи РОВНО 8 разных фильмов и/или сериалов — не меньше и не больше. Запас нужен, так как часть названий может не найтись в TMDB. Если не хватает идей, расширяй жанровый диапазон, но не сокращай количество.
2. Не рекомендуй то, что уже есть в просмотренном списке.
3. Учитывай нежелательные жанры, слова и ограничения.
4. Если пользователь явно описал настроение, атмосферу или формат — считай это главным приоритетом.
5. Предпочитай достаточно известные и реально существующие фильмы/сериалы (название должно находиться в TMDB). Давай точные оригинальные или русские названия, которые легко искать.
6. Каждый вариант оформляй строго отдельным блоком, начинающимся с эмодзи 🎬.
7. Причину рекомендации делай короткой — одно предложение, до 15 слов.

Формат ответа — ровно 8 таких блоков, без вводного и заключительного текста:
🎬 **Название (Год)**
Причина рекомендации

🎬 **Название (Год)**
Причина рекомендации

🎬 **Название (Год)**
Причина рекомендации

🎬 **Название (Год)**
Причина рекомендации

🎬 **Название (Год)**
Причина рекомендации

🎬 **Название (Год)**
Причина рекомендации

🎬 **Название (Год)**
Причина рекомендации

🎬 **Название (Год)**
Причина рекомендации`;
}

function buildGuessMoviePrompt(description: string): string {
    return `Ты — помощник по кино. Пользователь пытается вспомнить фильм или франшизу по описанию.

Описание пользователя:
${description.trim()}

Задача:
1. Предложи РОВНО 5 разных вариантов — не меньше и не больше.
2. На первом месте поставь самый вероятный вариант.
3. Укажи короткое объяснение, почему вариант подходит.
4. Не выдумывай несуществующие фильмы.
5. Если описание слишком общее, честно скажи об этом в первом блоке и предложи несколько направлений, но всё равно верни ровно 5 блоков.

Формат ответа — ровно 5 таких блоков, без вводного и заключительного текста:
🎬 **Название (Год)**
Почему это похоже на описание

🎬 **Название (Год)**
Почему это похоже на описание

🎬 **Название (Год)**
Почему это похоже на описание

🎬 **Название (Год)**
Почему это похоже на описание

🎬 **Название (Год)**
Почему это похоже на описание`;
}

function parseRecommendations(text: string): AIRecommendation[] {
    const normalized = text.trim();

    if (!normalized) {
        return [];
    }

    const blocks = normalized
        .split('🎬')
        .map((block) => block.trim())
        .filter(Boolean);

    if (blocks.length > 0) {
        return blocks.map((block) => {
            const lines = block
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);

            const title = (lines[0] || 'Рекомендация').replace(/\*\*/g, '').trim();
            const reason = lines.slice(1).join(' ').trim() || 'Подходит под ваш вкус и предпочтения.';

            return { title, reason };
        });
    }

    const fallbackLines = normalized
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    return fallbackLines.slice(0, 5).map((line, index) => ({
        title: `Рекомендация ${index + 1}`,
        reason: line.replace(/^[-•\d.)\s]+/, ''),
    }));
}

async function resolveActiveProvider(): Promise<{ providerType: ProviderType; apiKey: string }> {
    const provider = await getActiveProvider('ai');

    if (!provider) {
        throw new Error('В настройках не выбран AI-провайдер. Откройте раздел «Провайдеры ИИ» и сделайте один провайдер активным.');
    }

    if (!provider.enabled) {
        throw new Error(`Провайдер ${PROVIDER_META[provider.provider_type].label} выключен. Сначала включите его в настройках.`);
    }

    const apiKey = (provider.api_key || (await getConfiguredApiKey(provider.provider_type))).trim();

    if (!apiKey) {
        throw new Error(`Для ${PROVIDER_META[provider.provider_type].label} не сохранён API-ключ.`);
    }

    return {
        providerType: provider.provider_type,
        apiKey,
    };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number = AI_REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Запрос к AI-провайдеру превысил ${Math.round(timeoutMs / 1000)} сек. Попробуйте ещё раз.`);
        }

        if (
            error instanceof Error &&
            (error.message.includes('Network') || error.message.includes('fetch'))
        ) {
            throw new Error('Не удалось обратиться к AI-провайдеру. Проверьте интернет-соединение.');
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function extractGeminiText(data: any): string {
    if (!Array.isArray(data?.candidates)) {
        return '';
    }

    const parts: string[] = [];

    for (const candidate of data.candidates) {
        const candidateParts = candidate?.content?.parts;
        if (!Array.isArray(candidateParts)) {
            continue;
        }

        for (const part of candidateParts) {
            if (typeof part?.text === 'string' && part.text.trim()) {
                parts.push(part.text);
            }
        }
    }

    return parts.join('\n').trim();
}

/** Кеш выбранной модели, чтобы не запрашивать список при каждом вызове */
let resolvedGeminiModel: string | null = null;

/**
 * Выбирает лучшую доступную модель Gemini для данного API-ключа.
 * Запрашивает список моделей (ListModels) и берёт первую по приоритету
 * из поддерживающих generateContent: gemini-3 → gemini-2.5 → gemini-2.0 (flash).
 */
async function resolveGeminiModel(apiKey: string): Promise<string> {
    if (resolvedGeminiModel) {
        return resolvedGeminiModel;
    }

    const response = await fetchWithTimeout(
        `${GEMINI_API_BASE}?key=${encodeURIComponent(apiKey)}`,
        { method: 'GET' },
        15000,
    );

    let data: any = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const apiMessage = data?.error?.message || `не удалось получить список моделей (HTTP ${response.status})`;
        console.error('Gemini ListModels отказ:', apiMessage, JSON.stringify(data ?? {}));
        throw new Error(`Gemini: ${apiMessage}. Проверьте API-ключ.`);
    }

    const available: string[] = Array.isArray(data?.models)
        ? data.models
            .filter((m: any) =>
                Array.isArray(m?.supportedGenerationMethods) &&
                m.supportedGenerationMethods.includes('generateContent'))
            .map((m: any) => String(m?.name || '').replace(/^models\//, ''))
            .filter((name: string) => GEMINI_FLASH_PATTERN.test(name))
        : [];

    if (available.length === 0) {
        console.error('Gemini: нет доступных flash-моделей. Полный список:', JSON.stringify(data?.models ?? []));
        throw new Error('Для этого API-ключа нет доступных моделей Gemini с поддержкой generateContent.');
    }

    for (const preferred of GEMINI_MODEL_PREFERENCE) {
        const match = available.find((name) => name.startsWith(preferred) && !name.includes('lite'));
        if (match) {
            resolvedGeminiModel = match;
            console.log(`Gemini: выбрана модель ${match} из доступных:`, available.join(', '));
            return match;
        }
    }

    resolvedGeminiModel = available[0];
    console.log(`Gemini: выбрана модель ${available[0]} (fallback) из доступных:`, available.join(', '));
    return available[0];
}

async function requestGemini(apiKey: string, prompt: string): Promise<string> {
    const model = await resolveGeminiModel(apiKey);

    const response = await fetchWithTimeout(
        `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 4096,
                },
            }),
        },
    );

    let data: any = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const apiMessage = data?.error?.message || `Gemini вернул ошибку (HTTP ${response.status}).`;
        console.error(`Gemini (${model}) отказ:`, apiMessage, JSON.stringify(data ?? {}));

        // Если модель внезапно стала недоступна — сбросить кеш, чтобы при следующем вызове выбрать заново
        if (response.status === 404) {
            resolvedGeminiModel = null;
        }

        throw new Error(apiMessage);
    }

    const text = extractGeminiText(data);

    if (!text) {
        const finishReason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'unknown';
        console.error(`Gemini (${model}) пустой ответ (finishReason=${finishReason}):`, JSON.stringify(data ?? {}));
        throw new Error(
            finishReason === 'SAFETY' || finishReason === 'BLOCKLIST' || finishReason === 'PROHIBITED_CONTENT'
                ? 'Gemini заблокировал ответ фильтром безопасности. Переформулируйте предпочтения.'
                : `Gemini вернул пустой ответ (причина: ${finishReason}). Попробуйте ещё раз.`,
        );
    }

    return text;
}

async function requestOpenAI(apiKey: string, prompt: string): Promise<string> {
    const response = await fetchWithTimeout(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature: 0.9,
            max_tokens: 4096,
            messages: [
                {
                    role: 'system',
                    content: 'Ты помощник по рекомендациям фильмов и сериалов. Всегда отвечай по-русски и строго в запрошенном формате.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        const apiMessage = data?.error?.message || 'OpenAI вернул ошибку.';
        throw new Error(apiMessage);
    }

    return data?.choices?.[0]?.message?.content?.trim() || '';
}

async function requestClaude(apiKey: string, prompt: string): Promise<string> {
    const response = await fetchWithTimeout(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 4096,
            temperature: 0.9,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        const apiMessage = data?.error?.message || 'Claude вернул ошибку.';
        throw new Error(apiMessage);
    }

    const text = Array.isArray(data?.content)
        ? data.content
            .filter((item: { type?: string }) => item?.type === 'text')
            .map((item: { text?: string }) => item.text || '')
            .join('\n')
        : '';

    return text.trim();
}

async function requestAiText(providerType: ProviderType, apiKey: string, prompt: string): Promise<string> {
    if (providerType === 'gemini') {
        return requestGemini(apiKey, prompt);
    }

    if (providerType === 'openai') {
        return requestOpenAI(apiKey, prompt);
    }

    if (providerType === 'claude') {
        return requestClaude(apiKey, prompt);
    }

    throw new Error(`${PROVIDER_META[providerType].label} пока не подключён для AI-рекомендаций.`);
}

export async function getRecommendationProviderStatus(): Promise<RecommendationProviderStatus> {
    const provider = await getActiveProvider('ai');

    if (!provider) {
        return {
            providerType: null,
            providerLabel: 'Не выбран',
            configured: false,
            reason: 'Не выбран активный AI-провайдер.',
        };
    }

    const label = PROVIDER_META[provider.provider_type].label;
    const apiKey = (provider.api_key || '').trim();

    if (!provider.enabled) {
        return {
            providerType: provider.provider_type,
            providerLabel: label,
            configured: false,
            reason: `Провайдер ${label} выключен.`,
        };
    }

    if (!apiKey) {
        return {
            providerType: provider.provider_type,
            providerLabel: label,
            configured: false,
            reason: `Для ${label} не указан API-ключ.`,
        };
    }

    return {
        providerType: provider.provider_type,
        providerLabel: label,
        configured: true,
    };
}

export async function getRecommendations(
    input: RecommendationPromptInput,
): Promise<AIRecommendation[]> {
    if (
        !input.watchedMovies.length &&
        !input.freeformPrompt.trim() &&
        !input.favoriteGenres.length &&
        !input.favoriteTitles.length &&
        !input.moodKeywords.length
    ) {
        return [];
    }

    const { providerType, apiKey } = await resolveActiveProvider();
    const prompt = buildPrompt(input);

    try {
        const text = await requestAiText(providerType, apiKey, prompt);
        return parseRecommendations(text);
    } catch (error) {
        console.error('Ошибка AI-рекомендаций:', error);

        if (error instanceof Error) {
            throw new Error(`Не удалось получить рекомендации через ${PROVIDER_META[providerType].label}. ${error.message}`);
        }

        throw new Error('Не удалось получить рекомендации.');
    }
}

export async function guessMoviesByDescription(description: string): Promise<AIRecommendation[]> {
    if (!description.trim()) {
        return [];
    }

    const { providerType, apiKey } = await resolveActiveProvider();
    const prompt = buildGuessMoviePrompt(description);

    try {
        const text = await requestAiText(providerType, apiKey, prompt);
        return parseRecommendations(text);
    } catch (error) {
        console.error('Ошибка угадывания фильма:', error);

        if (error instanceof Error) {
            throw new Error(`Не удалось обработать описание через ${PROVIDER_META[providerType].label}. ${error.message}`);
        }

        throw new Error('Не удалось обработать описание фильма.');
    }
}
