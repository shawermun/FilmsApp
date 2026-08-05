import type { ProviderType } from '../types';
import { PROVIDER_META } from '../constants/providers';

const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const TMDB_CONFIG_URL = 'https://api.themoviedb.org/3/configuration';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL_CANDIDATES = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

export interface ProviderValidationResult {
    ok: boolean;
    message: string;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('Network') || error.message.includes('fetch'))) {
            throw new Error('Нет ответа от сервиса. Проверь интернет и попробуй ещё раз.');
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function validateTmdb(apiKey: string): Promise<ProviderValidationResult> {
    const url = `${TMDB_CONFIG_URL}?api_key=${encodeURIComponent(apiKey)}`;
    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
        return {
            ok: false,
            message: data?.status_message || 'TMDB отклонил ключ.',
        };
    }

    return {
        ok: true,
        message: 'TMDB ключ валиден и отвечает корректно.',
    };
}

function isGeminiModelUnavailable(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('not found') || normalized.includes('not supported') || normalized.includes('unsupported');
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

async function validateGemini(apiKey: string): Promise<ProviderValidationResult> {
    let lastErrorMessage = 'Gemini отклонил ключ.';

    for (const model of GEMINI_MODEL_CANDIDATES) {
        const response = await fetchWithTimeout(`${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: 'Reply with one word: ok' }],
                    },
                ],
                generationConfig: {
                    temperature: 0,
                },
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            const apiMessage = data?.error?.message || 'Gemini отклонил ключ.';
            lastErrorMessage = apiMessage;

            if (isGeminiModelUnavailable(apiMessage)) {
                continue;
            }

            return {
                ok: false,
                message: apiMessage,
            };
        }

        const text = extractGeminiText(data);

        return {
            ok: true,
            message: text ? 'Gemini ключ принят.' : 'Gemini ответил пусто, но ключ выглядит рабочим.',
        };
    }

    return {
        ok: false,
        message: lastErrorMessage,
    };
}

async function validateOpenAI(apiKey: string): Promise<ProviderValidationResult> {
    const response = await fetchWithTimeout(OPENAI_MODELS_URL, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json();

    if (!response.ok) {
        return {
            ok: false,
            message: data?.error?.message || 'OpenAI отклонил ключ.',
        };
    }

    return {
        ok: true,
        message: 'OpenAI ключ валиден и сервис отвечает.',
    };
}

async function validateClaude(apiKey: string): Promise<ProviderValidationResult> {
    const response = await fetchWithTimeout(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 8,
            messages: [{ role: 'user', content: 'Reply with ok' }],
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        return {
            ok: false,
            message: data?.error?.message || 'Claude отклонил ключ.',
        };
    }

    return {
        ok: true,
        message: 'Claude ключ валиден и сервис отвечает.',
    };
}

export async function validateProviderKey(providerType: ProviderType, apiKey: string): Promise<ProviderValidationResult> {
    const normalizedKey = apiKey.trim();

    if (!normalizedKey) {
        return {
            ok: false,
            message: `Сначала вставь API-ключ для ${PROVIDER_META[providerType].label}.`,
        };
    }

    switch (providerType) {
        case 'tmdb':
            return validateTmdb(normalizedKey);
        case 'gemini':
            return validateGemini(normalizedKey);
        case 'openai':
            return validateOpenAI(normalizedKey);
        case 'claude':
            return validateClaude(normalizedKey);
        case 'kinopoisk':
            return {
                ok: false,
                message: 'Для Кинопоиска тест ключа пока не реализован: сначала нужно финализировать сам API-интеграционный слой.',
            };
        default:
            return {
                ok: false,
                message: 'Неизвестный тип провайдера.',
            };
    }
}
