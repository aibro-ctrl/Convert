# Backend Setup для Konvert Chat

Скрипты настройки PocketBase и Redis для чата "Конверт".

## Быстрый старт

```bash
# 1. Создать .env
cp .env.example .env

# 2. Установить зависимости
npm install

# 3. Создать коллекции PocketBase
node create-collections.js

# 4. Проверить подключение
node test-connection.js
```

## Скрипты

- **`create-collections.js`** - создает все необходимые коллекции в PocketBase
- **`test-connection.js`** - проверяет подключение к PocketBase и Redis
- **`test-imports.js`** - тестирует импорты модулей
- **`redis-cache.js`** - утилиты для работы с Redis кэшем
- **`setup.sh`** - полный скрипт установки (для Ubuntu)

## Конфигурация

Файл `.env`:

```env
VITE_POCKETBASE_URL=http://127.0.0.1:54739
VITE_REDIS_HOST=localhost
VITE_REDIS_PORT=6379
VITE_REDIS_DB=0
```

## Требования

- PocketBase запущен на http://127.0.0.1:54739
- Redis запущен на localhost:6379
- Node.js 18+

## Создаваемые коллекции

1. **users** - пользователи с ролями и E2EE ключами
2. **rooms** - комнаты (публичные, приватные, DM)
3. **messages** - сообщения с E2EE и реакциями
4. **achievements** - достижения
5. **user_achievements** - разблокированные достижения
6. **friend_requests** - запросы в друзья
7. **files** - загруженные файлы

## Troubleshooting

### PocketBase не доступен

```bash
# Проверить статус
sudo systemctl status pocketbase

# Запустить вручную
cd /opt/pocketbase
./pocketbase serve --http=127.0.0.1:54739
```

### Redis не работает

```bash
# Проверить статус
sudo systemctl status redis-server

# Тест подключения
redis-cli -h localhost -p 6379 ping
```

### Коллекции не создаются

1. Убедитесь что PocketBase доступен: `curl http://127.0.0.1:54739/api/health`
2. Проверьте `.env` файл
3. Запустите с отладкой: `node create-collections.js`
