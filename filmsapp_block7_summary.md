# Block 7 — рефакторинг `MovieDetailsModal` на подкомпоненты

Этот блок не добавляет новую пользовательскую функциональность — он **упрощает поддержку проекта**, сохраняя текущее поведение.

## Что сделано

`MovieDetailsModal` разнесён на отдельные части:

1. `src/components/movieDetails/MovieHeroSection.tsx`
   - верхняя hero-часть карточки
   - постер / локальная запись / статус

2. `src/components/movieDetails/MovieRemoteDetailsSections.tsx`
   - жанры
   - длительность
   - сводка по отзывам
   - режиссёр / сценаристы / команда
   - актёры
   - интересные факты

3. `src/components/movieDetails/MovieReviewEditor.tsx`
   - личная оценка 1–10
   - текстовый отзыв
   - кнопка сохранения

4. `src/components/movieDetails/PersonFilmographyModal.tsx`
   - отдельная модалка с фильмографией актёра / члена команды

5. `src/components/MovieDetailsModal.tsx`
   - теперь содержит только orchestration-логику:
     - загрузка данных
     - sticky-кнопка статуса
     - сохранение ревью
     - открытие фильмографии

## Зачем это нужно

Плюсы такого разбиения:

- легче править UI без риска задеть всю модалку;
- проще добавлять новые блоки внутри карточки фильма;
- проще поддерживать theme-совместимость;
- легче потом тестировать и выносить ещё более мелкие части.

## Какие файлы менять

- `src/components/MovieDetailsModal.tsx`
- `src/components/movieDetails/MovieHeroSection.tsx` — новый файл
- `src/components/movieDetails/MovieRemoteDetailsSections.tsx` — новый файл
- `src/components/movieDetails/MovieReviewEditor.tsx` — новый файл
- `src/components/movieDetails/PersonFilmographyModal.tsx` — новый файл

## Что проверить после вставки

1. Карточка фильма открывается как раньше.
2. Sticky-кнопка смены статуса работает как раньше.
3. Личная оценка и отзыв сохраняются.
4. Клик по актёру / режиссёру открывает фильмографию.
5. Локальные записи без TMDB всё ещё показываются корректно.
6. В тёмной и дневной теме UI выглядит так же, как до рефакторинга.

## Следующий логичный шаг

Если хочешь, следующим сообщением я могу сделать **Block 8** — cleanup `SearchScreen` и `SettingsScreen` на более мелкие компоненты по той же схеме, чтобы проект стал заметно проще поддерживать дальше.
