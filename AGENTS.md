# FilmsApp — Руководство для AI-агента

> **Единый источник истины.** Все остальные файлы в `ai/` дополняют этот документ.

## Быстрый старт (обязательно перед кодом)

Прочитай в указанном порядке:
1. `ai/PROJECT_CONTEXT.md` — что за проект, стек, цели
2. `ai/CURRENT_STATE.md` — что сейчас в работе
3. `ai/ARCHITECTURE.md` — структура папок и потоки данных
4. `ai/CODING_RULES.md` — правила кодирования
5. `ai/BUGS.md` — известные баги (если есть)

## Критические правила

| Правило | Почему |
|--------|--------|
| **TypeScript strict** | Проект использует `strict: true` в tsconfig |
| **После изменений — `npx tsc --noEmit`** | Обязательная проверка перед коммитом |
| **Минимальные изменения** | Не рефактори без явного запроса |
| **Не придумывай API** | Используй только существующие в проекте |
| **Сначала план, потом код** | Объясни изменения до их внесения |

## Технологический стек

- **Expo SDK 57** — читай версионированные docs: https://docs.expo.dev/versions/v57.0.0/
- **React Native 0.86** + **React 19.2**
- **TypeScript 6.0** (strict mode)
- **SQLite** (`expo-sqlite`) — локальная БД, без облака
- **React Navigation 7** — bottom tabs
- **TMDB API** — единственный источник данных о фильмах
- **AI providers**: Gemini (основной), OpenAI, Claude — переключаемые

## Структура проекта

```
src/
├── api/           # Внешние API: tmdb.ts, gemini.ts, recommendations.ts
├── components/    # Переиспользуемые UI: MovieCard, MovieDetailsModal...
├── constants/     # theme.ts, providers.ts, movieStatus.ts
├── context/       # ThemeContext (светлая/тёмная тема)
├── database/      # SQLite: db.ts, settings.ts, appSettings.ts
├── screens/       # 5 экранов: Library, Search, Recommendations, Notes, Settings
├── types/         # TypeScript интерфейсы
└── utils/         # searchFilters.ts и прочие хелперы
```

**Поток данных:** `SQLite ← Database Services ← React Hooks ← UI Components`

## Команды

```bash
npm start          # Запуск Expo
npx tsc --noEmit   # Проверка типов (обязательно после изменений)
```

## После завершения задачи

1. Добавить запись в `ai/CHANGELOG.md`
2. Обновить `ai/CURRENT_STATE.md` — только по явному указанию пользователя
3. Обновить `ai/BUGS.md` — если появились новые баги
4. Обновить `ai/ARCHITECTURE.md` — если изменилась структура проекта
5. Обновить `ai/CODING_RULES.md` — если появились новые правила

## Дополнительная документация

| Файл | Назначение |
|------|-----------|
| `ai/PROMPTS.md` | Готовые промпты для типовых задач |
| `ai/ROADMAP.md` | План развития проекта |
| `ai/DECISIONS.md` | Архитектурные решения с датами и причинами |
| `ai/CHANGELOG.md` | История изменений |