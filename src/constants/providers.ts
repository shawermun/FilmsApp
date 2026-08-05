import type { ProviderCategory, ProviderType } from '../types';

export const PROVIDER_META: Record<
    ProviderType,
    {
        label: string;
        category: ProviderCategory;
        helpUrl?: string;
        placeholder: string;
        description: string;
    }
> = {
    tmdb: {
        label: 'TMDB',
        category: 'movie',
        helpUrl: 'https://www.themoviedb.org/settings/api',
        placeholder: 'Вставьте TMDB API key',
        description: 'Поиск фильмов, сериалов, актёров и карточек.',
    },
    gemini: {
        label: 'Gemini',
        category: 'ai',
        helpUrl: 'https://aistudio.google.com/app/apikey',
        placeholder: 'Вставьте Gemini API key',
        description: 'ИИ-рекомендации по библиотеке и предпочтениям.',
    },
    openai: {
        label: 'OpenAI',
        category: 'ai',
        helpUrl: 'https://platform.openai.com/api-keys',
        placeholder: 'Вставьте OpenAI API key',
        description: 'Альтернативный AI provider для рекомендаций.',
    },
    claude: {
        label: 'Claude',
        category: 'ai',
        helpUrl: 'https://console.anthropic.com/settings/keys',
        placeholder: 'Вставьте Claude API key',
        description: 'Альтернативный AI provider для рекомендаций.',
    },
    kinopoisk: {
        label: 'Кинопоиск',
        category: 'movie',
        placeholder: 'Вставьте API key агрегатора',
        description: 'Резервный movie provider / задел на будущее.',
    },
};

export const PROVIDER_ORDER: ProviderType[] = [
    'tmdb',
    'kinopoisk',
    'gemini',
    'openai',
    'claude',
];