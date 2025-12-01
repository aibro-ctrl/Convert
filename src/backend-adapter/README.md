# 🚀 Backend Adapter - Миграция чата "Конверт"

## 📋 Обзор

Этот адаптер позволяет легко мигрировать чат "Конверт" с Supabase на любой другой backend:
- ✅ PocketBase + Redis (рекомендуется)
- ✅ Firebase
- ✅ Appwrite
- ✅ Собственный Node.js/Deno сервер

## 🏗️ Архитектура

```
Frontend (React)
    ↓
Backend Adapter (абстракция)
    ↓
Backend Implementation
    ↓
Database (PocketBase/Firebase/Custom)
```

## 📁 Структура

```
/backend-adapter/
├── README.md                    # Этот файл
├── interface.ts                 # Интерфейсы API
├── supabase-adapter.ts          # Текущий адаптер Supabase
├── pocketbase-adapter.ts        # Новый адаптер PocketBase
├── config.ts                    # Конфигурация бэкенда
└── /migration/
    ├── export-data.ts           # Экспорт данных из Supabase
    ├── import-data.ts           # Импорт в PocketBase
    └── docker-compose.yml       # Docker для развертывания
```

## 🔧 Установка на свой сервер

### Вариант 1: Docker (Рекомендуется)

```bash
# 1. Клонируйте репозиторий
git clone <your-repo>
cd backend-adapter/migration

# 2. Запустите Docker Compose
docker-compose up -d

# 3. Настройте окружение
cp .env.example .env
nano .env

# 4. Запустите миграцию
npm install
npm run migrate:export  # Экспорт из Supabase
npm run migrate:import  # Импорт в PocketBase
```

### Вариант 2: Ручная установка

```bash
# 1. Установите PocketBase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_linux_amd64.zip
unzip pocketbase_0.22.0_linux_amd64.zip
./pocketbase serve

# 2. Установите Redis
sudo apt install redis-server
sudo systemctl start redis

# 3. Настройте приложение
cd /path/to/app
npm install
npm run build
```

## 🔄 Миграция данных

### Автоматическая миграция (скрипт)

```bash
npm run migrate:auto
```

### Ручная миграция

1. **Экспорт данных из Supabase**
```typescript
npm run migrate:export
// Создаст файл: /data/export.json
```

2. **Импорт в PocketBase**
```typescript
npm run migrate:import
// Импортирует из: /data/export.json
```

## ⚙️ Конфигурация

### .env файл

```env
# Backend Type
BACKEND_TYPE=pocketbase  # supabase | pocketbase | firebase | custom

# PocketBase
POCKETBASE_URL=http://localhost:8090
POCKETBASE_ADMIN_EMAIL=admin@example.com
POCKETBASE_ADMIN_PASSWORD=your_secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Encryption
ENCRYPTION_ENABLED=true
JWT_SECRET=your_jwt_secret_here

# Feature Flags
ENABLE_REALTIME=true
ENABLE_FILE_UPLOAD=true
ENABLE_VOICE_VIDEO=true
```

## 📊 Сравнение Backend решений

| Функция | Supabase | PocketBase | Firebase |
|---------|----------|------------|----------|
| Real-time | ✅ | ✅ | ✅ |
| Auth | ✅ | ✅ | ✅ |
| Storage | ✅ | ✅ | ✅ |
| Самохостинг | ⚠️ | ✅✅✅ | ❌ |
| Стоимость | $ | Free | $$ |
| Простота | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| E2EE | ✅ | ✅ | ✅ |

## 🎯 Выбор Backend

### Рекомендуется PocketBase + Redis, если:
- ✅ Нужен полный контроль над данными
- ✅ Самохостинг обязателен
- ✅ Бюджет ограничен
- ✅ Нужна простота настройки
- ✅ Важна приватность

### Остаться на Supabase, если:
- ✅ Используете Figma Make (обязательно)
- ✅ Нужна облачная инфраструктура
- ✅ Не хотите управлять сервером

## 📝 Шаги миграции

### Этап 1: Подготовка (10 мин)
1. ✅ Создайте резервную копию данных
2. ✅ Установите Docker
3. ✅ Клонируйте репозиторий
4. ✅ Настройте .env файл

### Этап 2: Развертывание (5 мин)
1. ✅ Запустите `docker-compose up -d`
2. ✅ Проверьте доступность PocketBase (http://localhost:8090/_/)
3. ✅ Проверьте Redis: `redis-cli ping`

### Этап 3: Миграция данных (15 мин)
1. ✅ Экспорт: `npm run migrate:export`
2. ✅ Проверьте /data/export.json
3. ✅ Импорт: `npm run migrate:import`
4. ✅ Проверьте данные в PocketBase Admin UI

### Этап 4: Переключение (5 мин)
1. ✅ Обновите .env: `BACKEND_TYPE=pocketbase`
2. ✅ Пересоберите: `npm run build`
3. ✅ Запустите: `npm start`
4. ✅ Тестируйте функционал

### Этап 5: Проверка (10 мин)
- ✅ Авторизация работает
- ✅ Сообщения отправляются/получаются
- ✅ Real-time обновления работают
- ✅ Файлы загружаются
- ✅ E2EE шифрование работает

## 🐛 Troubleshooting

### PocketBase не запускается
```bash
# Проверьте порт
sudo lsof -i :8090

# Проверьте логи
docker logs pocketbase
```

### Redis не подключается
```bash
# Проверьте статус
redis-cli ping

# Перезапустите
docker restart redis
```

### Ошибка миграции
```bash
# Очистите и попробуйте снова
rm -rf /data/export.json
npm run migrate:export -- --force
```

## 📚 Дополнительные ресурсы

- [PocketBase Documentation](https://pocketbase.io/docs/)
- [Redis Documentation](https://redis.io/docs/)
- [Docker Compose Guide](https://docs.docker.com/compose/)

## 🔐 Безопасность

### Рекомендации для продакшена:

1. **Измените пароли**
```env
POCKETBASE_ADMIN_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
JWT_SECRET=<random-secret>
```

2. **Настройте HTTPS**
```nginx
server {
    listen 443 ssl;
    server_name chat.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8090;
    }
}
```

3. **Настройте firewall**
```bash
sudo ufw allow 443/tcp
sudo ufw allow 8090/tcp  # PocketBase (только для локальной сети)
sudo ufw enable
```

4. **Резервное копирование**
```bash
# Cron job для ежедневного бэкапа
0 2 * * * /usr/local/bin/backup-pocketbase.sh
```

## 💡 Советы по оптимизации

### PocketBase
- Используйте индексы для часто запрашиваемых полей
- Настройте кэширование статики
- Включите gzip компрессию

### Redis
- Настройте TTL для временных данных
- Используйте Redis для сессий
- Настройте persistence для важных данных

### Frontend
- Используйте React.memo для оптимизации
- Lazy loading для компонентов
- Service Worker для оффлайн режима

---

**Версия:** 1.0.0  
**Автор:** AI Assistant  
**Дата:** 01.12.2025
