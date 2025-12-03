# Руководство по развертыванию приложения "Конверт"

## Важное замечание о экспорте из Figma Make

⚠️ **Figma Make не предоставляет прямую функцию экспорта проекта**. Вам необходимо будет вручную скопировать файлы или использовать альтернативные методы.

## Способы переноса кода

### Вариант 1: Ручное копирование (рекомендуется для небольших изменений)

1. Откройте каждый файл в Figma Make
2. Скопируйте содержимое
3. Создайте соответствующую структуру папок на вашем ПК
4. Вставьте содержимое в новые файлы

### Вариант 2: Использование Git (если доступно)

Если у вашего Figma Make проекта есть интеграция с GitHub, вы можете склонировать репозиторий.

---

## Инструкция по установке на локальном ПК

### Шаг 1: Подготовка окружения

#### Требования:
- **Node.js**: версия 18.x или выше
- **npm** или **yarn** или **pnpm**
- **Git** (опционально)
- Учетная запись **Supabase**

#### Установка Node.js:
```bash
# Проверьте установленную версию
node --version
npm --version

# Если Node.js не установлен, скачайте с https://nodejs.org/
```

---

### Шаг 2: Создание структуры проекта

```bash
# Создайте папку проекта
mkdir konvert-chat
cd konvert-chat

# Инициализируйте React + Vite проект
npm create vite@latest . -- --template react-ts

# Выберите:
# - Framework: React
# - Variant: TypeScript
```

---

### Шаг 3: Установка зависимостей

```bash
# Основные зависимости
npm install react react-dom react-router-dom

# Supabase
npm install @supabase/supabase-js

# UI библиотеки
npm install lucide-react
npm install class-variance-authority clsx tailwind-merge

# Дополнительные библиотеки
npm install sonner@2.0.3
npm install date-fns
npm install react-hook-form@7.55.0
npm install zod
npm install @hookform/resolvers

# Dev зависимости
npm install -D tailwindcss@next @tailwindcss/vite postcss autoprefixer
npm install -D @types/node
```

---

### Шаг 4: Настройка Tailwind CSS v4

Создайте файл **vite.config.ts**:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

Создайте файл **tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Создайте файл **tsconfig.node.json**:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

---

### Шаг 5: Копирование файлов проекта

Скопируйте следующие папки и файлы из Figma Make:

```
konvert-chat/
├── App.tsx                    # Главный компонент
├── styles/
│   └── globals.css           # Глобальные стили
├── components/               # Все компоненты
│   ├── Admin/
│   ├── Auth/
│   ├── Chat/
│   ├── Profile/
│   ├── figma/
│   └── ui/
├── contexts/                 # Контексты React
│   ├── AuthContext.tsx
│   ├── ConnectionContext.tsx
│   └── ThemeContext.tsx
├── utils/                    # Утилиты
│   ├── api.ts
│   ├── imageCompression.ts
│   └── supabase/
│       ├── client.ts
│       └── info.tsx
└── supabase/                 # Серверная часть (Edge Functions)
    └── functions/
        └── server/
            ├── index.tsx
            ├── auth.tsx
            ├── messages.tsx
            ├── rooms.tsx
            ├── direct_messages.tsx
            ├── notifications.tsx
            ├── storage.tsx
            └── kv_store.tsx
```

---

### Шаг 6: Настройка Supabase

#### 6.1. Создайте проект в Supabase:
1. Перейдите на https://supabase.com
2. Создайте новый проект
3. Дождитесь завершения настройки (2-3 минуты)

#### 6.2. Получите учетные данные:
В настройках проекта (Settings → API) найдите:
- **Project URL**: `https://your-project.supabase.co`
- **anon public key**: `eyJhbGc...` (публичный ключ)
- **service_role key**: `eyJhbGc...` (секретный ключ, храните в безопасности!)

#### 6.3. Создайте файл **.env.local** в корне проекта:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **Важно**: Не коммитьте `.env.local` в Git! Добавьте его в `.gitignore`.

#### 6.4. Обновите файл **utils/supabase/info.tsx**:

```typescript
export const projectId = 'your-project-id'
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
```

---

### Шаг 7: Настройка Supabase Edge Functions

#### 7.1. Установите Supabase CLI:

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (через Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Или через npm
npm install -g supabase
```

#### 7.2. Инициализируйте Supabase:

```bash
# Войдите в аккаунт
supabase login

# Свяжите проект
supabase link --project-ref your-project-id
```

#### 7.3. Создайте структуру Edge Functions:

```bash
# Проверьте, что папка supabase/functions/server уже скопирована
# Если нет, создайте её и скопируйте все файлы из Figma Make
```

#### 7.4. Установите секреты (переменные окружения):

```bash
# Установите URL Supabase
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"

# Установите анонимный ключ
supabase secrets set SUPABASE_ANON_KEY="your-anon-key"

# Установите service role ключ
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Установите URL базы данных
supabase secrets set SUPABASE_DB_URL="postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres"
```

Вы можете получить SUPABASE_DB_URL в Settings → Database → Connection String (URI).

#### 7.5. Разверните Edge Functions:

```bash
# Разверните функцию make-server-b0f1e6d5
supabase functions deploy make-server-b0f1e6d5

# Если папка называется просто "server", переименуйте:
mv supabase/functions/server supabase/functions/make-server-b0f1e6d5

# Затем разверните
supabase functions deploy make-server-b0f1e6d5
```

---

### Шаг 8: Настройка базы данных

#### 8.1. Создайте таблицу KV Store:

В Supabase Dashboard → SQL Editor выполните:

```sql
-- Создание таблицы kv_store_b0f1e6d5
CREATE TABLE IF NOT EXISTS kv_store_b0f1e6d5 (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по префиксу
CREATE INDEX IF NOT EXISTS idx_kv_store_key_prefix 
ON kv_store_b0f1e6d5 USING btree (key text_pattern_ops);

-- Индекс для обновлений
CREATE INDEX IF NOT EXISTS idx_kv_store_updated_at 
ON kv_store_b0f1e6d5 (updated_at DESC);

-- Row Level Security (отключаем для использования service_role)
ALTER TABLE kv_store_b0f1e6d5 DISABLE ROW LEVEL SECURITY;
```

#### 8.2. Создайте Storage Buckets:

```sql
-- Bucket для голосовых сообщений
INSERT INTO storage.buckets (id, name, public)
VALUES ('make-b0f1e6d5-voice-messages', 'make-b0f1e6d5-voice-messages', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket для видео сообщений
INSERT INTO storage.buckets (id, name, public)
VALUES ('make-b0f1e6d5-video-messages', 'make-b0f1e6d5-video-messages', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket для изображений
INSERT INTO storage.buckets (id, name, public)
VALUES ('make-b0f1e6d5-images', 'make-b0f1e6d5-images', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket для аватаров
INSERT INTO storage.buckets (id, name, public)
VALUES ('make-b0f1e6d5-avatars', 'make-b0f1e6d5-avatars', false)
ON CONFLICT (id) DO NOTHING;
```

#### 8.3. Настройте политики Storage:

```sql
-- Разрешаем service_role полный доступ ко всем buckets
-- (политики не нужны, так как buckets приватные и доступ через signed URLs)
```

---

### Шаг 9: Создание главного файла index.html

Создайте файл **index.html** в корне проекта:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Конверт - Чат-приложение</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

Создайте файл **main.tsx**:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

### Шаг 10: Создание .gitignore

Создайте файл **.gitignore**:

```gitignore
# Зависимости
node_modules/
.pnp
.pnp.js

# Окружение
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Логи
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Сборка
dist/
dist-ssr/
*.local

# Editor
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Supabase
.supabase/
```

---

### Шаг 11: Запуск приложения

```bash
# Установите все зависимости (если еще не установлены)
npm install

# Запустите development сервер
npm run dev

# Приложение будет доступно по адресу http://localhost:5173
```

---

### Шаг 12: Создание первого администратора (iBro)

1. Откройте приложение в браузере
2. Зарегистрируйте пользователя с именем **iBro**
3. Этот пользователь автоматически получит роль администратора и права "Глаз Бога"

---

## Сборка для production

```bash
# Соберите оптимизированную версию
npm run build

# Результат будет в папке dist/
```

### Развертывание на сервере:

#### Вариант 1: Vercel (рекомендуется)
```bash
npm install -g vercel
vercel
```

#### Вариант 2: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod
```

#### Вариант 3: Собственный сервер (Nginx)

1. Скопируйте содержимое папки `dist/` на сервер
2. Настройте Nginx:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /path/to/konvert-chat/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass https://your-project.supabase.co;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Проверка работоспособности

### Чеклист после установки:

- [ ] Frontend запускается без ошибок (`npm run dev`)
- [ ] Edge Functions развернуты (`supabase functions list`)
- [ ] База данных содержит таблицу `kv_store_b0f1e6d5`
- [ ] Storage buckets созданы (4 штуки)
- [ ] Можно зарегистрировать нового пользователя
- [ ] Можно войти в систему
- [ ] Можно создать комнату
- [ ] Можно отправить сообщение
- [ ] Можно отправить личное сообщение

### Troubleshooting:

**Ошибка "Failed to fetch":**
- Проверьте, что Edge Functions развернуты
- Проверьте переменные окружения
- Проверьте CORS настройки в `supabase/functions/server/index.tsx`

**Ошибка "Unauthorized":**
- Проверьте SUPABASE_ANON_KEY в .env.local
- Проверьте, что ключ правильный в Supabase Dashboard

**База данных не работает:**
- Убедитесь, что выполнили SQL из Шага 8.1
- Проверьте, что SUPABASE_DB_URL правильный
- Проверьте, что SUPABASE_SERVICE_ROLE_KEY установлен в секретах

---

## Полезные команды

```bash
# Просмотр логов Edge Functions
supabase functions logs make-server-b0f1e6d5

# Локальный запуск Edge Functions
supabase functions serve make-server-b0f1e6d5

# Обновление зависимостей
npm update

# Очистка кэша
rm -rf node_modules package-lock.json
npm install

# Просмотр размера bundle
npm run build -- --mode analyze
```

---

## Структура package.json

Создайте файл **package.json** (если создавался через vite, обновите скрипты):

```json
{
  "name": "konvert-chat",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0",
    "@supabase/supabase-js": "^2.39.0",
    "lucide-react": "^0.344.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "sonner": "2.0.3",
    "date-fns": "^3.3.1",
    "react-hook-form": "7.55.0",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.4"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/node": "^20.11.19",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.1",
    "tailwindcss": "^4.0.0-alpha.25",
    "@tailwindcss/vite": "^4.0.0-alpha.25"
  }
}
```

---

## Дополнительная информация

### Документация:
- Прочитайте `/README.md` для общей информации
- Прочитайте `/guidelines/QUICK-START.md` для быстрого старта
- Прочитайте `/PERFORMANCE-OPTIMIZATIONS.md` для понимания оптимизаций
- Прочитайте `/TROUBLESHOOTING.md` при возникновении проблем

### Важные файлы для изучения:
- `supabase/functions/server/index.tsx` - главная точка входа API
- `utils/supabase/client.ts` - клиент Supabase
- `contexts/AuthContext.tsx` - управление аутентификацией
- `App.tsx` - главный компонент приложения

### Поддержка:
- Документация Supabase: https://supabase.com/docs
- Документация Vite: https://vitejs.dev
- Документация React: https://react.dev
- Документация Tailwind CSS v4: https://tailwindcss.com/docs

---

## Заключение

Это приложение представляет собой полнофункциональный чат с:
- ✅ JWT аутентификацией
- ✅ Системой ролей (Админ, Модератор, VIP, Пользователь)
- ✅ Личными и групповыми чатами
- ✅ Голосовыми и видео сообщениями
- ✅ Системой друзей и уведомлений
- ✅ Режимом "Глаз Бога" для iBro
- ✅ Real-time обновлениями
- ✅ Поиском и модерацией

Следуйте инструкциям последовательно, и у вас будет полностью рабочее приложение на вашем собственном сервере!

**Удачи в развертывании! 🚀**
