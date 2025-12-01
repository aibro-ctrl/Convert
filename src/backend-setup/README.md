# 🚀 Backend Setup - Установка без Docker

## 📋 Обзор

Полная установка backend для чата "Конверт" на Ubuntu сервере с нативными PocketBase и Redis (БЕЗ Docker).

## ✅ Требования

### Предустановленное ПО:
- ✅ Ubuntu 20.04+ (или Debian)
- ✅ Node.js 18+ и npm
- ✅ PocketBase установлен
- ✅ Redis установлен

### Порты:
- 8090 - PocketBase
- 6379 - Redis
- 3000 - Frontend (опционально)

## 🚀 Быстрый старт

### Автоматическая установка (рекомендуется):

```bash
cd backend-setup
chmod +x setup.sh
./setup.sh
```

Скрипт автоматически:
1. ✅ Проверит PocketBase и Redis
2. ✅ Создаст коллекции в PocketBase
3. ✅ Настроит Redis кэширование
4. ✅ Сгенерирует конфигурацию
5. ✅ Создаст systemd сервисы
6. ✅ Протестирует подключения

**Время установки:** ~5 минут

## 📁 Структура файлов

```
backend-setup/
├── setup.sh                # Основной скрипт установки
├── create-collections.js   # Создание коллекций PocketBase
├── redis-cache.js          # Redis Cache Manager
├── test-connection.js      # Тест подключений
└── README.md              # Этот файл
```

## 🔧 Ручная установка

### Шаг 1: Проверка PocketBase

```bash
# Проверьте установку
which pocketbase
# или
ls -la /opt/pocketbase/pocketbase

# Запустите PocketBase
cd /opt/pocketbase
./pocketbase serve --http=0.0.0.0:8090

# В другом терминале проверьте
curl http://localhost:8090/api/health
```

### Шаг 2: Проверка Redis

```bash
# Проверьте установку
redis-cli --version

# Проверьте работу
redis-cli ping
# Должен ответить: PONG

# Проверьте статус
sudo systemctl status redis-server
```

### Шаг 3: Установка зависимостей

```bash
cd /path/to/konvert-chat
npm install pocketbase ioredis dotenv
```

### Шаг 4: Создание коллекций

```bash
cd backend-setup
node create-collections.js
```

Будут созданы коллекции:
- ✅ users (auth)
- ✅ rooms
- ✅ messages
- ✅ achievements
- ✅ user_achievements
- ✅ friend_requests
- ✅ files

### Шаг 5: Конфигурация

Создайте `.env` файл в корне проекта:

```env
# Backend Type
VITE_BACKEND_TYPE=pocketbase

# PocketBase
VITE_POCKETBASE_URL=http://localhost:8090

# Redis
VITE_REDIS_HOST=localhost
VITE_REDIS_PORT=6379
VITE_REDIS_DB=0

# Security
JWT_SECRET=your_random_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Features
VITE_E2EE_ENABLED=true
VITE_REALTIME_ENABLED=true
```

### Шаг 6: Создание systemd сервиса

```bash
sudo nano /etc/systemd/system/konvert-pocketbase.service
```

Добавьте:

```ini
[Unit]
Description=Konvert PocketBase Backend
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http=0.0.0.0:8090
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Активируйте:

```bash
sudo systemctl daemon-reload
sudo systemctl enable konvert-pocketbase
sudo systemctl start konvert-pocketbase
sudo systemctl status konvert-pocketbase
```

## 🧪 Тестирование

### Проверка PocketBase:

```bash
# Health check
curl http://localhost:8090/api/health

# Список коллекций
curl http://localhost:8090/api/collections
```

### Проверка Redis:

```bash
# Ping
redis-cli ping

# Установка и получение значения
redis-cli SET test "hello"
redis-cli GET test

# Статистика
redis-cli INFO
```

### Комплексный тест:

```bash
cd backend-setup
node test-connection.js
```

## 🔐 Настройка доступа

### PocketBase Admin:

1. Откройте: http://localhost:8090/_/
2. Создайте первого администратора
3. Email: `admin@konvert.chat`
4. Password: `ваш_безопасный_пароль`

### Правила доступа:

В PocketBase Admin UI настройте правила для каждой коллекции:

**Users:**
- List: `@request.auth.id != ""`
- View: `@request.auth.id != ""`
- Create: Только для signup
- Update: `@request.auth.id = id || @request.auth.role = "admin"`

**Rooms:**
- List: `members.id ?= @request.auth.id`
- View: `members.id ?= @request.auth.id`
- Create: `@request.auth.id != ""`
- Update: `created_by = @request.auth.id || @request.auth.role = "admin"`

**Messages:**
- List: Через room permissions
- Create: `@request.auth.id != ""`
- Update: `sender_id = @request.auth.id`
- Delete: `sender_id = @request.auth.id || @request.auth.role = "admin"`

## 📊 Redis кэширование

### Использование Redis Cache:

```javascript
const { getRedisCache } = require('./backend-setup/redis-cache');

// Получение экземпляра
const cache = getRedisCache();

// Кэширование пользователя
await cache.cacheUser('user123', userData);
const user = await cache.getUser('user123');

// Кэширование комнаты
await cache.cacheRoom('room456', roomData);
const room = await cache.getRoom('room456');

// Онлайн пользователи
await cache.addOnlineUser('user123');
const online = await cache.getOnlineUsers();

// Real-time события
await cache.publishRoomUpdate('room456', { type: 'new_message' });
```

### Оптимизация Redis:

Отредактируйте `/etc/redis/redis.conf`:

```conf
# Максимальная память (для кэша)
maxmemory 256mb

# Политика вытеснения
maxmemory-policy allkeys-lru

# Persistence (опционально)
appendonly yes
appendfsync everysec
```

Перезапустите Redis:

```bash
sudo systemctl restart redis-server
```

## 🔄 Интеграция с frontend

### Обновите файлы проекта:

1. Установите адаптер:
```bash
npm install pocketbase ioredis
```

2. Обновите `src/utils/api.ts`:
```typescript
import PocketBaseAdapter from '../backend-adapter/pocketbase-adapter';

const adapter = new PocketBaseAdapter();

export const authAPI = {
  signup: adapter.signup.bind(adapter),
  signin: adapter.signin.bind(adapter),
  // ... остальные методы
};
```

3. Запустите:
```bash
npm run dev
```

## 📝 Полезные команды

### Управление PocketBase:

```bash
# Статус
sudo systemctl status konvert-pocketbase

# Логи
sudo journalctl -u konvert-pocketbase -f

# Перезапуск
sudo systemctl restart konvert-pocketbase

# Остановка
sudo systemctl stop konvert-pocketbase
```

### Управление Redis:

```bash
# Статус
sudo systemctl status redis-server

# Мониторинг команд
redis-cli monitor

# Статистика
redis-cli INFO stats

# Очистка кэша
redis-cli FLUSHDB
```

### Резервное копирование:

```bash
# PocketBase
tar -czf pocketbase-backup-$(date +%Y%m%d).tar.gz /opt/pocketbase/pb_data

# Redis
redis-cli SAVE
cp /var/lib/redis/dump.rdb ~/backups/redis-$(date +%Y%m%d).rdb
```

## 🐛 Troubleshooting

### PocketBase не запускается:

```bash
# Проверка порта
sudo lsof -i :8090

# Права доступа
sudo chown -R $USER:$USER /opt/pocketbase

# Логи
cat /opt/pocketbase/pocketbase.log
```

### Redis не подключается:

```bash
# Проверка сервиса
sudo systemctl status redis-server

# Проверка конфигурации
redis-cli CONFIG GET bind

# Перезапуск
sudo systemctl restart redis-server
```

### Ошибка создания коллекций:

```bash
# Проверка доступности API
curl http://localhost:8090/api/health

# Повторная попытка
node create-collections.js

# Ручное создание через Admin UI
# Откройте: http://localhost:8090/_/
```

## 🌐 Production Deployment

### Настройка Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

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
    }

    # PocketBase Admin
    location /_/ {
        proxy_pass http://localhost:8090;
        proxy_set_header Host $host;
    }

    # WebSocket для real-time
    location /ws {
        proxy_pass http://localhost:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### SSL с Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
sudo certbot renew --dry-run
```

### Мониторинг:

```bash
# Установка Netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Или простой мониторинг
watch -n 5 'systemctl status konvert-pocketbase redis-server'
```

## 📊 Производительность

### Рекомендуемые настройки:

**PocketBase:**
- Индексы на часто используемых полях
- Лимиты на размер файлов
- Rate limiting через Nginx

**Redis:**
- maxmemory: 256-512MB
- maxmemory-policy: allkeys-lru
- appendonly: yes

**System:**
- Swap: минимум 2GB
- File descriptors: увеличить лимит
- TCP keepalive: настроить для long-running connections

## ✅ Чеклист установки

- [ ] PocketBase установлен и запущен
- [ ] Redis установлен и запущен
- [ ] Коллекции созданы
- [ ] .env файл настроен
- [ ] Systemd сервисы созданы
- [ ] Первый администратор создан
- [ ] Правила доступа настроены
- [ ] Подключения протестированы
- [ ] Nginx настроен (для продакшена)
- [ ] SSL настроен (для продакшена)
- [ ] Резервное копирование настроено

## 🎉 Готово!

После установки у вас будет:

✅ PocketBase запущен как системный сервис  
✅ Redis настроен для кэширования  
✅ Все коллекции созданы  
✅ Дефолтные достижения добавлены  
✅ Готово к использованию!  

Запустите frontend:
```bash
npm run dev
```

Откройте: http://localhost:3000

---

**Версия:** 1.0.0  
**Дата:** 01.12.2025  
**Поддержка:** Ubuntu 20.04+
