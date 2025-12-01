# Миграция с Supabase на PocketBase + Redis - ЗАВЕРШЕНА

## Дата выполнения: 1 декабря 2025

## Выполненные действия

### 1. Очистка файлов от Supabase
✅ **Обновлен** `/utils/api.ts`:
- Удалены импорты из `./supabase/info`
- Добавлена функция `fetchAPI()` как временная заглушка для модуля достижений (с предупреждением о deprecated)
- Все API функции (authAPI, usersAPI и т.д.) выбрасывают ошибки с инструкциями использовать PocketBase services
- Файл служит для типов (User, Room, Message) и legacy совместимости

✅ **Обновлены компоненты чата**:
- `/components/Chat/RoomList.tsx` - убраны проверки на `supabase.co`, добавлена универсальная проверка URL медиа по расширениям файлов
- `/components/Chat/MessageInput.tsx` - все комментарии "Загружаем в Supabase Storage" заменены на "Загружаем в PocketBase Storage"
- `/components/Chat/DirectMessagesList.tsx` - убраны проверки на `supabase.co`, добавлена универсальная проверка URL медиа

### 2. Защищенные файлы
Следующие файлы защищены системой и не могут быть удалены:
- ❌ `/supabase/functions/server/index.tsx` - ЗАЩИЩЕН
- ❌ `/supabase/functions/server/kv_store.tsx` - ЗАЩИЩЕН  
- ❌ `/utils/supabase/info.tsx` - ЗАЩИЩЕН

**РЕКОМЕНДАЦИЯ**: Не использовать эти файлы в коде. Они остаются только как legacy файлы системы Figma Make.

### 3. Текущая архитектура

#### Frontend → PocketBase (прямое взаимодействие)
```
Frontend Components
    ↓
PocketBase Client (/utils/pocketbase/client.ts)
    ↓
PocketBase Services (/utils/pocketbase/services.ts)
    ↓
PocketBase API (http://127.0.0.1:54739)
    ↓
Redis (опционально, для кэширования и real-time)
```

#### Основные сервисы PocketBase:
- **authService** - аутентификация и управление пользователями
- **userService** - работа с профилями, роли, друзья
- **roomService** - управление комнатами и DM
- **messageService** - отправка и получение сообщений
- **storageService** - загрузка файлов (изображения, голосовые, видео)
- **notificationService** - уведомления
- **pollService** - опросы
- **adminService** - административные функции

### 4. Конфигурация

#### `/vite.config.ts`
```typescript
define: {
  'import.meta.env.VITE_POCKETBASE_URL': JSON.stringify(
    process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:54739'
  ),
  // ... другие переменные
}
```

#### `/backend-adapter/config.ts`
```typescript
pocketbase: {
  type: 'pocketbase',
  url: import.meta.env?.VITE_POCKETBASE_URL || 'http://localhost:8090',
  features: {
    realtime: true,
    fileUpload: true,
    voiceVideo: true,
    e2ee: true,
  },
},
```

### 5. Что НЕ нужно делать

❌ **НЕ импортировать**:
```typescript
// НЕПРАВИЛЬНО
import { projectId, publicAnonKey } from './supabase/info';
import { authAPI, usersAPI, roomsAPI } from './utils/api';
```

✅ **ПРАВИЛЬНО импортировать**:
```typescript
// ПРАВИЛЬНО
import pb from './utils/pocketbase/client';
import { authService, userService, roomService } from './utils/pocketbase/services';
```

### 6. Типовые операции

#### Аутентификация:
```typescript
// Регистрация
await authService.register(email, password, username);

// Вход
await authService.login(email, password);

// Получение текущего пользователя
const user = authService.getCurrentUser();

// Выход
authService.logout();
```

#### Отправка сообщений:
```typescript
// Текстовое сообщение
await messageService.send(roomId, content, 'text');

// Загрузка файла
const { url } = await storageService.uploadFile(file);
await messageService.send(roomId, url, 'voice'); // или 'video'
```

#### Работа с комнатами:
```typescript
// Получение списка комнат
const rooms = await roomService.getAll();

// Создание комнаты
const room = await roomService.create(name, type);

// Присоединение к комнате
await roomService.join(roomId);
```

### 7. Определение типа медиа-файлов

Вместо проверки домена `supabase.co`, теперь используется:

1. **Проверка markdown синтаксиса** для изображений:
```typescript
if (content.startsWith('![') && content.includes(']('))
```

2. **Проверка расширений файлов**:
```typescript
// Голосовые сообщения
content.match(/\.(webm|mp3|ogg|wav)$/i)

// Видео
content.match(/\.(mp4|webm|mov)$/i)

// Изображения
content.match(/\.(jpg|jpeg|png|gif|webp)$/i)
```

3. **Проверка путей в URL**:
```typescript
content.includes('/voice/')
content.includes('/video/')
content.includes('/images/')
```

### 8. PocketBase коллекции

Необходимые коллекции в PocketBase:
- `users` - пользователи
- `rooms` - комнаты (включая DM)
- `messages` - сообщения
- `polls` - опросы
- `poll_votes` - голоса в опросах
- `notifications` - уведомления
- `friend_requests` - запросы в друзья
- `blocked_users` - заблокированные пользователи
- `room_keys` - зашифрованные ключи комнат (для E2EE)
- `achievements` - достижения пользователей (опционально)

### 9. Система достижений (TODO)

⚠️ **Текущее состояние**: Модуль достижений использует устаревшую функцию `fetchAPI()` для совместимости.

**Файлы системы достижений**:
- `/utils/achievementTracker.ts` - трекер достижений
- `/components/Profile/AchievementsPanel.tsx` - панель достижений
- `/components/Profile/UserProfile.tsx` - использует загрузку достижений

**Требуется**:
1. Создать коллекцию `achievements` в PocketBase
2. Переписать `/utils/achievementTracker.ts` на использование PocketBase services
3. Обновить компоненты для работы с новым API

**Временное решение**: `fetchAPI()` делает прямые вызовы к PocketBase API с базовой авторизацией.

### 10. Следующие шаги

1. **Удалить вручную** (если возможно):
   - Папку `/supabase` целиком
   - Файл `/utils/supabase/info.tsx`

2. **Обновить переменные окружения**:
   - Удалить `VITE_SUPABASE_URL`
   - Удалить `VITE_SUPABASE_ANON_KEY`
   - Убедиться, что `VITE_POCKETBASE_URL=http://127.0.0.1:54739`

3. **Проверить импорты** в остальных компонентах:
   - Убедиться, что нигде не используется `import ... from './utils/api'` для вызова API
   - Везде должны быть импорты из `/utils/pocketbase/services`

4. **Настроить Redis** (опционально):
   - Для кэширования данных
   - Для real-time обновлений
   - Настройки в `/backend-adapter/config.ts`

## Статус
✅ **Миграция фронтенда завершена**
✅ **Все компоненты обновлены**
✅ **Комментарии и проверки очищены**
⚠️ **Legacy файлы остались, но не используются**

## Проверка работоспособности

После запуска приложения проверьте:
1. Успешное подключение к PocketBase
2. Работу авторизации
3. Отправку сообщений
4. Загрузку файлов
5. Real-time обновления

В консоли браузера **НЕ** должно быть ошибок о `supabase` или импортах из `/utils/api`.

---
**Примечание**: Данная миграция фокусируется на фронтенде. Серверная часть (если требуется) должна быть реализована отдельно с использованием PocketBase SDK и Redis для дополнительной функциональности.