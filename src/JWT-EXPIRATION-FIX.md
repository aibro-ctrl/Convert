# Исправление проблемы истечения JWT токенов

## Проблема

Приложение получало ошибки при работе с истекшими JWT токенами:
```
getUserFromToken: Supabase validation error: invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired
Invalid token - user not found
GET /auth/me - getUserFromToken returned null
```

### Причина
1. JWT токены имеют ограниченный срок действия (обычно 1 час)
2. Истекшие токены продолжали храниться в localStorage
3. Приложение пыталось использовать истекшие токены для API запросов
4. Не было автоматической очистки истекших токенов

## Решение

### ✅ 1. Добавлена проверка истечения токена в utils/api.ts

Создана функция `isTokenExpired()`, которая:
- Парсит JWT токен
- Проверяет поле `exp` (expiration time)
- Добавляет буфер в 60 секунд для предотвращения edge cases
- Возвращает `true` если токен истёк

```typescript
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    
    return payload.exp * 1000 < Date.now() + 60000;
  } catch (e) {
    return true;
  }
}
```

### ✅ 2. Автоматическая очистка истекших токенов перед запросами

В `fetchAPI()` добавлена проверка перед каждым запросом:
- Проверяется истечение токена
- Если истёк - очищается localStorage (с сохранением темы)
- Вместо истекшего токена используется anon key

```typescript
if (token && isTokenExpired(token)) {
  console.warn('fetchAPI: Token is expired, clearing localStorage');
  const savedTheme = localStorage.getItem('app-theme');
  localStorage.clear();
  if (savedTheme) {
    localStorage.setItem('app-theme', savedTheme);
  }
  token = null;
}
```

### ✅ 3. Обработка 401 ошибок с автоматическим logout

При получении 401 ошибки:
- Очищается localStorage
- Страница перезагружается для показа экрана входа
- Сохраняется тема оформления

```typescript
if (response.status === 401) {
  console.log(`API ${endpoint}: Unauthorized - clearing token`);
  if (token) {
    const savedTheme = localStorage.getItem('app-theme');
    localStorage.clear();
    if (savedTheme) {
      localStorage.setItem('app-theme', savedTheme);
    }
    window.location.reload();
  }
}
```

### ✅ 4. Улучшено логирование в AuthContext.tsx

Добавлена подробная информация о токенах:
- Когда истекли (X минут назад)
- Когда истекут (через X минут)
- Точное время истечения в ISO формате

```typescript
if (payload.exp && payload.exp * 1000 < Date.now()) {
  const expDate = new Date(payload.exp * 1000);
  const now = new Date();
  const minutesAgo = Math.floor((now.getTime() - expDate.getTime()) / 1000 / 60);
  console.log(`Token expired ${minutesAgo} minutes ago (at ${expDate.toISOString()})`);
  // ... clear localStorage
}
```

## Как работает защита

### Многоуровневая проверка:

1. **При загрузке приложения (AuthContext)**:
   - Проверка формата JWT
   - Проверка поля `sub` (user ID)
   - Проверка истечения токена
   - Очистка если токен невалиден

2. **Перед каждым API запросом (utils/api.ts)**:
   - Проверка истечения с 60-секундным буфером
   - Автоматическая очистка истекших токенов
   - Использование anon key вместо истекшего токена

3. **После получения ответа от сервера**:
   - Обработка 401 ошибок
   - Автоматический logout
   - Перезагрузка страницы

4. **На сервере (auth.tsx)**:
   - Проверка формата JWT
   - Валидация через Supabase
   - Проверка истечения
   - Подробное логирование

## Что делать при ошибке "Token expired"

### Для пользователей:
1. Просто обновите страницу - вы увидите экран входа
2. Войдите заново с вашими учётными данными
3. Новый токен будет выдан на 1 час

### Для разработчиков:
1. Проверьте консоль браузера - там будет подробная информация
2. Токены автоматически очищаются при истечении
3. Не нужно вручную чистить localStorage

## Технические детали

### Структура JWT токена:
```
header.payload.signature
```

### Пример payload:
```json
{
  "sub": "user-id-here",
  "email": "user@example.com",
  "iat": 1730462400,  // Issued At (Unix timestamp)
  "exp": 1730466000,  // Expires At (Unix timestamp)
  "role": "authenticated"
}
```

### Время жизни токена:
- **По умолчанию**: 1 час (3600 секунд)
- **Буфер проверки**: 60 секунд (токен считается истекшим за 60 сек до реального истечения)
- **Автопереподключение**: каждые 30 секунд (если есть токен и нет пользователя)

## Преимущества решения

✅ **Автоматическая очистка** - пользователь не застревает с истекшим токеном  
✅ **Проактивная проверка** - истечение обнаруживается до отправки запроса  
✅ **Подробное логирование** - легко диагностировать проблемы  
✅ **Сохранение темы** - UX не страдает при logout  
✅ **Graceful fallback** - автоматический переход на anon key  
✅ **Многоуровневая защита** - проверки на клиенте и сервере  

## Тестирование

### Как проверить:
1. Войдите в приложение
2. Откройте DevTools → Application → Local Storage
3. Скопируйте access_token
4. Декодируйте на jwt.io
5. Подождите до истечения (или измените время системы)
6. Обновите страницу или сделайте любой запрос
7. Токен должен быть автоматически очищен

### Ожидаемое поведение:
- ✅ Истекший токен очищается автоматически
- ✅ Пользователь перенаправляется на экран входа
- ✅ В консоли видны подробные логи
- ✅ Тема оформления сохраняется
- ✅ Нет ошибок в консоли

**Дата исправления**: 2025-11-01  
**Статус**: ✅ Исправлено и протестировано
