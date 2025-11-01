# Настройка восстановления пароля в Supabase

## Обзор

Приложение "Конверт" теперь использует встроенную функциональность восстановления пароля Supabase вместо кастомной реализации с кодами.

## Как это работает

1. **Пользователь запрашивает восстановление пароля**
   - Вводит email на экране входа
   - Система отправляет письмо с ссылкой для сброса пароля

2. **Пользователь получает письмо**
   - Письмо содержит ссылку для восстановления пароля
   - Ссылка перенаправляет на приложение с хэшем `#reset-password`

3. **Пользователь устанавливает новый пароль**
   - Приложение обнаруживает хэш и показывает форму сброса пароля
   - Пользователь вводит новый пароль
   - Пароль обновляется в Supabase Auth

## Настройка в Supabase

### 1. Настройка Email Templates

1. Перейдите в ваш проект Supabase
2. Откройте **Authentication** → **Email Templates**
3. Выберите **Reset Password**
4. Убедитесь, что шаблон содержит правильную ссылку:

```html
<h2>Reset Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .SiteURL }}/#reset-password?access_token={{ .Token }}&type=recovery">Reset Password</a></p>
```

### 2. Настройка Site URL

1. Перейдите в **Authentication** → **URL Configuration**
2. Установите **Site URL** на URL вашего приложения:
   - Для разработки: `http://localhost:3000` (или ваш dev URL)
   - Для продакшена: ваш production URL
3. Добавьте **Redirect URLs** (если необходимо)

### 3. Настройка Email Provider

#### Для разработки (Supabase Email)
Supabase автоматически отправляет письма в режиме разработки (ограничение: 3-4 письма в час).

#### Для продакшена (Рекомендуется)
Настройте SMTP провайдера:

1. Перейдите в **Project Settings** → **Authentication**
2. Прокрутите до **SMTP Settings**
3. Настройте ваш SMTP провайдер (например, SendGrid, Mailgun, AWS SES):

```
SMTP Host: smtp.yourprovider.com
SMTP Port: 587
SMTP User: your-smtp-username
SMTP Password: your-smtp-password
Sender Email: noreply@yourdomain.com
Sender Name: Конверт Chat
```

### 4. Настройка Email Rate Limits

1. Перейдите в **Authentication** → **Rate Limits**
2. Настройте лимиты для восстановления пароля по необходимости

## Использование в приложении

**Важно**: Всегда используйте singleton экземпляр Supabase клиента из `/utils/supabase/client.ts`

```typescript
import { supabase } from '../../utils/supabase/client';
```

⚠️ **Не создавайте** новые экземпляры клиента - это вызовет предупреждения и проблемы с состоянием!

### Запрос восстановления пароля

```typescript
import { supabase } from '../../utils/supabase/client';

const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/#reset-password`,
});
```

### Обновление пароля

```typescript
import { supabase } from '../../utils/supabase/client';

const { error } = await supabase.auth.updateUser({
  password: newPassword
});
```

## Компоненты

- **Login.tsx** - Форма запроса восстановления пароля
- **ResetPassword.tsx** - Форма установки нового пароля
- **App.tsx** - Обработка хэша URL и показ нужного компонента

## Тестирование

### Локальная разработка

1. Запросите восстановление пароля через форму
2. Откройте Supabase Dashboard → **Authentication** → **Logs**
3. Найдите письмо в логах и скопируйте ссылку
4. Откройте ссылку в браузере
5. Установите новый пароль

### С настроенным SMTP

1. Запросите восстановление пароля
2. Проверьте ваш email
3. Перейдите по ссылке из письма
4. Установите новый пароль

## Безопасность

- Ссылки для сброса пароля действительны ограниченное время (по умолчанию 1 час)
- Ссылка содержит одноразовый токен
- После использования токен становится недействительным
- Пользователь автоматически выходит после смены пароля

## Troubleshooting

### Письма не приходят

1. Проверьте SMTP настройки
2. Проверьте логи в Supabase Dashboard
3. Проверьте папку спам
4. Убедитесь, что не превышены rate limits

### Ошибка "Invalid recovery session"

1. Токен мог истечь (попробуйте запросить новый)
2. Токен уже был использован
3. Проверьте правильность Site URL в настройках

### Ссылка не работает

1. Проверьте, что Site URL правильно настроен
2. Убедитесь, что в шаблоне email правильный формат ссылки
3. Проверьте, что хэш `#reset-password` присутствует в URL

## Дополнительная информация

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Password Reset Guide](https://supabase.com/docs/guides/auth/passwords)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
