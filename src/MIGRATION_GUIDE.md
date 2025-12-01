# 🚀 Руководство по миграции чата "Конверт" на собственный сервер

## 📋 Содержание

1. [Обзор](#обзор)
2. [Экспорт из Figma Make](#экспорт-из-figma-make)
3. [Подготовка сервера](#подготовка-сервера)
4. [Установка](#установка)
5. [Миграция данных](#миграция-данных)
6. [Настройка продакшена](#настройка-продакшена)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Обзор

### Зачем мигрировать?

**Figma Make** - отличная платформа для прототипирования, но имеет ограничения:
- ❌ Работает только с Supabase (нельзя заменить backend)
- ❌ Нет полного контроля над сервером
- ❌ Ограничения бесплатного плана Supabase
- ❌ Зависимость от внешних сервисов

**Собственный сервер с PocketBase + Redis** дает:
- ✅ Полный контроль над данными и инфраструктурой
- ✅ Бесплатный самохостинг
- ✅ Лучшая производительность
- ✅ Полная приватность данных
- ✅ Легкая кастомизация

### Что мы будем делать?

```
Figma Make (Supabase)  →  Экспорт кода  →  Свой сервер (PocketBase + Redis)
```

1. Экспортируем frontend код из Figma Make
2. Экспортируем данные из Supabase
3. Разворачиваем PocketBase + Redis на своем сервере
4. Импортируем данные
5. Переключаем frontend на новый backend

---

## 📤 Экспорт из Figma Make

### Шаг 1: Скачивание кода

**В Figma Make:**

1. Откройте ваш проект "Конверт"
2. Нажмите на кнопку **"Export"** или **"Download"**
3. Выберите **"Download as ZIP"**
4. Сохраните архив на компьютер

```bash
# Распаковка архива
unzip konvert-chat.zip
cd konvert-chat
```

### Шаг 2: Сохранение ключей Supabase

**ВАЖНО:** Сохраните эти данные ДО экспорта!

1. В Figma Make откройте Settings → API
2. Скопируйте:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (если доступен)

Создайте файл `.env.backup`:

```env
VITE_SUPABASE_URL=https://ваш-проект.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_key
SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_key
```

### Шаг 3: Копирование файлов адаптера

Скопируйте папку `/backend-adapter` из этого репозитория в корень вашего проекта:

```bash
# В корне проекта
mkdir -p backend-adapter/migration
# Скопируйте все файлы из /backend-adapter
```

---

## 🖥️ Подготовка сервера

### Требования

**Минимальные:**
- CPU: 1 core
- RAM: 512 MB
- Диск: 10 GB
- ОС: Ubuntu 20.04+, Debian 11+, или macOS

**Рекомендуемые:**
- CPU: 2 cores
- RAM: 2 GB
- Диск: 50 GB SSD
- ОС: Ubuntu 22.04 LTS

### Установка Docker

#### Ubuntu/Debian:

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Перезагрузка для применения изменений
exit
# (Войдите заново)

# Проверка
docker --version
docker-compose --version
```

#### macOS:

```bash
# Установка через Homebrew
brew install --cask docker

# Или скачайте Docker Desktop:
# https://www.docker.com/products/docker-desktop/
```

---

## 🔧 Установка

### Автоматическая установка (рекомендуется)

```bash
cd backend-adapter/migration

# Сделать скрипт исполняемым
chmod +x install.sh

# Запуск установки
./install.sh
```

Скрипт автоматически:
1. ✅ Проверит наличие Docker
2. ✅ Создаст .env файл с случайными паролями
3. ✅ Запустит PocketBase + Redis
4. ✅ Инициализирует базу данных
5. ✅ Предложит мигрировать данные

**Сохраните пароли**, которые выведет скрипт!

### Ручная установка

#### 1. Настройка конфигурации

```bash
cd backend-adapter/migration
cp .env.example .env
nano .env
```

Измените:
```env
VITE_BACKEND_TYPE=pocketbase
VITE_POCKETBASE_URL=http://localhost:8090
POCKETBASE_ADMIN_EMAIL=admin@konvert.chat
POCKETBASE_ADMIN_PASSWORD=ваш_сильный_пароль

# Вставьте ключи Supabase для миграции
VITE_SUPABASE_URL=https://ваш-проект.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_key
SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_key
```

#### 2. Запуск сервисов

```bash
# Создание директорий
mkdir -p pb_data pb_migrations backups data

# Запуск Docker Compose
docker-compose up -d

# Проверка статуса
docker-compose ps
```

Вывод должен быть:
```
NAME                COMMAND             STATUS
konvert_pocketbase  "serve ..."         Up
konvert_redis       "redis-server ..."  Up
```

#### 3. Проверка доступности

```bash
# PocketBase
curl http://localhost:8090/api/health
# Ответ: {"status":"ok"}

# Redis
docker exec konvert_redis redis-cli ping
# Ответ: PONG
```

---

## 💾 Миграция данных

### Вариант 1: Автоматическая миграция

```bash
cd backend-adapter/migration

# Установка зависимостей
npm install

# Полная миграция (экспорт + импорт)
npm run migrate:auto
```

### Вариант 2: Пошаговая миграция

#### Шаг 1: Экспорт из Supabase

```bash
npm run migrate:export
```

Будет создан файл `data/export.json` с данными:
- Пользователи
- Комнаты
- Сообщения
- Достижения
- Запросы дружбы

#### Шаг 2: Проверка экспорта

```bash
# Просмотр статистики
ls -lh data/export.json

# Быстрый просмотр
cat data/export.json | jq '.users | length'
cat data/export.json | jq '.messages | length'
```

#### Шаг 3: Импорт в PocketBase

```bash
npm run migrate:import
```

Прогресс будет выглядеть так:
```
🔄 Connecting to PocketBase...
🔐 Authenticating...
📋 Creating collections...
   ✓ Collection "users" exists
   ✓ Created collection "rooms"
   ...
👥 Importing users...
   ✓ Imported: 150, Skipped: 0
💬 Importing messages...
   ✓ Imported: 5420, Skipped: 0
✅ Import complete!
```

#### Шаг 4: Верификация данных

Откройте PocketBase Admin:
```
http://localhost:8090/_/
```

Войдите с учетными данными из `.env` файла и проверьте:
- Коллекция `users` заполнена
- Коллекция `rooms` заполнена
- Коллекция `messages` заполнена

---

## 🏗️ Настройка frontend

### Шаг 1: Обновление конфигурации

В корне проекта создайте/обновите `.env`:

```env
VITE_BACKEND_TYPE=pocketbase
VITE_POCKETBASE_URL=http://localhost:8090
VITE_E2EE_ENABLED=true
VITE_REALTIME_ENABLED=true
```

### Шаг 2: Установка зависимостей

```bash
# В корне проекта
npm install

# Дополнительная зависимость для PocketBase
npm install pocketbase
```

### Шаг 3: Интеграция адаптера

Обновите `src/utils/api.ts`:

```typescript
import { getBackendConfig, BACKEND_TYPE } from '../backend-adapter/config';
import PocketBaseAdapter from '../backend-adapter/pocketbase-adapter';
import { IBackendAdapter } from '../backend-adapter/interface';

// Создаем экземпляр адаптера на основе конфигурации
let adapter: IBackendAdapter;

if (BACKEND_TYPE === 'pocketbase') {
  adapter = new PocketBaseAdapter();
} else {
  // Fallback на Supabase (текущий код)
  adapter = ... // ваш существующий код
}

// Экспортируем унифицированное API
export const authAPI = {
  signup: adapter.signup.bind(adapter),
  signin: adapter.signin.bind(adapter),
  // ... остальные методы
};
```

### Шаг 4: Сборка и запуск

```bash
# Development
npm run dev

# Production
npm run build
npm run preview
```

Откройте в браузере: `http://localhost:5173`

---

## 🌐 Настройка продакшена

### 1. Nginx конфигурация

Создайте `/etc/nginx/sites-available/konvert`:

```nginx
server {
    listen 80;
    server_name chat.example.com;
    
    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chat.example.com;

    ssl_certificate /etc/letsencrypt/live/chat.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.example.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/konvert/dist;
        try_files $uri $uri/ /index.html;
    }

    # PocketBase API
    location /api/ {
        proxy_pass http://localhost:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # PocketBase Admin
    location /_/ {
        proxy_pass http://localhost:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/konvert /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. SSL сертификат (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d chat.example.com

# Автообновление
sudo certbot renew --dry-run
```

### 3. Systemd service для автозапуска

Создайте `/etc/systemd/system/konvert.service`:

```ini
[Unit]
Description=Konvert Chat Services
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/konvert/backend-adapter/migration
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Активируйте:

```bash
sudo systemctl enable konvert
sudo systemctl start konvert
sudo systemctl status konvert
```

### 4. Резервное копирование

Создайте скрипт `/usr/local/bin/backup-konvert.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backups/konvert"
DATE=$(date +%Y%m%d_%H%M%S)

# Создание директории
mkdir -p "$BACKUP_DIR"

# Backup PocketBase
tar -czf "$BACKUP_DIR/pocketbase_$DATE.tar.gz" /path/to/pb_data

# Backup Redis
docker exec konvert_redis redis-cli --rdb /data/dump.rdb SAVE
cp /path/to/redis/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Удаление старых бэкапов (>30 дней)
find "$BACKUP_DIR" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Сделайте исполняемым и добавьте в cron:

```bash
sudo chmod +x /usr/local/bin/backup-konvert.sh

# Добавьте в crontab
sudo crontab -e

# Ежедневный бэкап в 2:00
0 2 * * * /usr/local/bin/backup-konvert.sh >> /var/log/konvert-backup.log 2>&1
```

### 5. Мониторинг

Установите базовый мониторинг:

```bash
# Установка Netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Или Grafana + Prometheus для продвинутого мониторинга
```

---

## 🐛 Troubleshooting

### Проблема: PocketBase не запускается

```bash
# Проверка логов
docker logs konvert_pocketbase

# Проверка порта
sudo lsof -i :8090

# Перезапуск
docker-compose restart pocketbase
```

### Проблема: Redis не подключается

```bash
# Проверка статуса
docker exec konvert_redis redis-cli ping

# Проверка пароля
docker exec konvert_redis redis-cli -a ваш_пароль ping

# Просмотр логов
docker logs konvert_redis
```

### Проблема: Миграция завершается с ошибкой

```bash
# Очистка и повторная попытка
rm -rf data/export.json
npm run migrate:export -- --force

# Проверка подключения к Supabase
curl -H "apikey: ваш_anon_key" "https://ваш-проект.supabase.co/rest/v1/"
```

### Проблема: Frontend не подключается к PocketBase

1. Проверьте CORS в PocketBase Admin → Settings → CORS
2. Добавьте ваш домен в разрешенные origins
3. Проверьте `VITE_POCKETBASE_URL` в `.env`
4. Убедитесь, что используется `http://` или `https://` правильно

### Проблема: E2EE не работает после миграции

```bash
# Проверьте наличие публичных ключей
# В PocketBase Admin откройте коллекцию users
# Проверьте поле public_key у пользователей

# Если ключи отсутствуют, пользователи должны:
# 1. Выйти из аккаунта
# 2. Войти заново с паролем
# 3. Ключи сгенерируются автоматически
```

---

## 📊 Сравнение производительности

| Метрика | Supabase (Figma Make) | PocketBase (Свой сервер) |
|---------|----------------------|--------------------------|
| Latency | ~100-300ms | ~10-50ms |
| Throughput | Зависит от плана | Ограничено железом |
| Real-time | WebSocket | WebSocket |
| Стоимость | $0-25+/мес | $0 (+ сервер) |
| Контроль | Ограничен | Полный |

---

## ✅ Чеклист миграции

- [ ] Экспортирован код из Figma Make
- [ ] Сохранены ключи Supabase
- [ ] Установлен Docker + Docker Compose
- [ ] Запущены сервисы PocketBase + Redis
- [ ] Экспортированы данные из Supabase
- [ ] Импортированы данные в PocketBase
- [ ] Обновлена конфигурация frontend
- [ ] Протестирована авторизация
- [ ] Протестирована отправка сообщений
- [ ] Протестирован real-time
- [ ] Настроен HTTPS (продакшен)
- [ ] Настроено резервное копирование
- [ ] Настроен мониторинг

---

## 🎓 Дополнительные ресурсы

- [PocketBase Documentation](https://pocketbase.io/docs/)
- [Redis Documentation](https://redis.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

## 💬 Поддержка

Если возникли проблемы:

1. Проверьте логи: `docker-compose logs`
2. Посмотрите [Troubleshooting](#troubleshooting)
3. Проверьте конфигурацию `.env`
4. Убедитесь, что все порты доступны

---

**Версия:** 1.0.0  
**Дата:** 01.12.2025  
**Автор:** AI Assistant для чата "Конверт"

**Успешной миграции!** 🚀
