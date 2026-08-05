# CODING RULES

## TypeScript

| Правило | Уровень | Почему |
|--------|---------|--------|
| `strict: true` | Обязательно | Проект настроен так в tsconfig |
| **НЕ использовать `any`** | Запрещено | Используй `unknown` или конкретный тип |
| Явные типы для функций | Обязательно | Указывай return type |
| Интерфейсы для объектов | Обязательно | Особенно для props и API responses |

## React / React Native

| Правило | Уровень | Почему |
|--------|---------|--------|
| Только функциональные компоненты | Обязательно | Class components запрещены |
| React Hooks (`useState`, `useEffect`, `useCallback`, `useMemo`) | Обязательно | Для состояния и side effects |
| `StyleSheet.create()` | Обязательно | Не используй inline styles |
| Компоненты — с большой буквы | Обязательно | `MovieCard`, не `movieCard` |

## Стиль кода

| Правило | Уровень |
|--------|---------|
| Минимальные изменения | Обязательно |
| Не рефактори без запроса | Обязательно |
| Не переписывай файлы >100 строк без необходимости | Обязательно |
| Не ломай существующую архитектуру | Обязательно |
| Комментарии на русском | Рекомендуется |
| Названия переменных/функций на английском | Рекомендуется |

## Проверка после изменений

```bash
# Обязательно запусти перед завершением задачи
npx tsc --noEmit
```

Если есть ошибки TypeScript — исправь их до завершения задачи.

## Импорты

```typescript
// ✅ Правильно — явные типы
import type { Movie, WatchStatus } from '../types';
import { getDatabase } from '../database/db';

// ❌ Неправильно — неявный any
import { someFunction } from './utils';
```

## Асинхронность

```typescript
// ✅ Правильно — async/await
const loadMovies = async () => {
  const movies = await getAllMovies();
  setMovies(movies);
};

// ❌ Избегай — цепочки .then()
getAllMovies().then(movies => setMovies(movies));
```

## Обработка ошибок

```typescript
// ✅ Правильно — try/catch с типизацией
try {
  await saveMovie(movie);
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}

// ❌ Неправильно — игнорирование ошибок
saveMovie(movie);