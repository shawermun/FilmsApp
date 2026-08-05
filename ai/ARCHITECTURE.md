# ARCHITECTURE

## Структура папок

```
src/
├── api/              # Внешние API
│   ├── tmdb.ts       # TMDB API — поиск, детали фильмов, getTopRatedForPeriod
│   ├── recommendations.ts  # ИИ-рекомендации: единая точка для Gemini/OpenAI/Claude.
│   │                     # resolveGeminiModel() автоподбирает модель через ListModels,
│   │                     # промпты, парсинг ответа (🎬-блоки), requestAiText()
│   └── providerValidation.ts
│
├── components/       # Переиспользуемые UI компоненты
│   ├── MovieCard.tsx
│   ├── MovieDetailsModal.tsx
│   ├── RecommendationCard.tsx
│   ├── SearchCard.tsx
│   ├── StatusPickerModal.tsx
│   └── movieDetails/     # Подкомпоненты для деталей фильма
│
├── constants/        # Константы и конфигурация
│   ├── theme.ts      # Цвета, размеры, шрифты
│   ├── providers.ts  # Метаданные провайдеров (TMDB, Gemini, OpenAI, Claude)
│   └── movieStatus.ts    # Статусы просмотра (planned/watching/completed/dropped)
│
├── context/          # React Context
│   └── ThemeContext.tsx  # Управление темой (light/dark)
│
├── database/         # SQLite слой
│   ├── db.ts         # Основная БД: movies, notes, provider_settings
│   ├── settings.ts   # Настройки провайдеров (API ключи)
│   ├── appSettings.ts    # Настройки приложения
│   └── recommendationPreferences.ts  # Предпочтения для рекомендаций
│
├── screens/          # Экраны приложения (6 штук)
│   ├── LibraryScreen.tsx       # Библиотека фильмов
│   ├── SearchScreen.tsx        # Поиск в TMDB + чипы-фильтры (searchFilters.ts)
│   ├── RecommendationsScreen.tsx  # ИИ-подбор: промпт только из явных предпочтений,
│   │                              # ответ ИИ резолвится в карточки TMDB (SearchCard + MovieDetailsModal)
│   ├── ReviewsScreen.tsx       # Мои отзывы (фильмы с оценкой/отзывом)
│   ├── NotesScreen.tsx         # Заметки
│   └── SettingsScreen.tsx      # Настройки
│
├── types/            # TypeScript типы
│   └── index.ts      # Movie, Note, TMDBSearchResult, ProviderType...
│
└── utils/            # Вспомогательные функции
    └── searchFilters.ts
```

## Поток данных

```
SQLite (db.ts)
    ↓
Database Services (settings.ts, appSettings.ts)
    ↓
React Hooks (useState, useEffect в компонентах)
    ↓
UI Components (screens/, components/)
```

## Внешние зависимости

| Сервис | Назначение | Файл |
|--------|-----------|------|
| TMDB API | Поиск фильмов, детали, постеры | `api/tmdb.ts` |
| Gemini AI | Рекомендации (основной) | `api/recommendations.ts` |
| OpenAI | Альтернативные рекомендации | `api/recommendations.ts` |
| Claude | Альтернативные рекомендации | `api/recommendations.ts` |

## Навигация

**React Navigation 7** — bottom tabs (6 вкладок):
- Библиотека → `LibraryScreen`
- Поиск → `SearchScreen`
- ИИ-подбор → `RecommendationsScreen`
- Мои отзывы → `ReviewsScreen`
- Заметки → `NotesScreen`
- Настройки → `SettingsScreen`
