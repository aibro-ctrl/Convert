# ⚡ Быстрый старт: Миграция на собственный сервер

## 🎯 Цель
Перенести чат "Конверт" с Figma Make (Supabase) на свой сервер с PocketBase + Redis

## ⏱️ Время: ~30 минут

---

## 📝 Шпаргалка команд

### 1️⃣ Подготовка (5 мин)

```bash
# Скачайте код из Figma Make (Export → Download ZIP)
# Распакуйте архив

cd konvert-chat

# Сохраните ключи Supabase в .env.backup
cat > .env.backup << EOF
VITE_SUPABASE_URL=ваш_url
VITE_SUPABASE_ANON_KEY=ваш_ключ
SUPABASE_SERVICE_ROLE_KEY=ваш_service_key
EOF
```

### 2️⃣ Установка Docker (5 мин)

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# macOS
brew install --cask docker

# Проверка
docker --version
```

### 3️⃣ Автоустановка (10 мин)

```bash
cd backend-adapter/migration
chmod +x install.sh
./install.sh
```

**Готово!** Скрипт сам:
- ✅ Создаст .env с паролями
- ✅ Запустит PocketBase + Redis
- ✅ Предложит мигрировать данные

### 4️⃣ Миграция данных (10 мин)

```bash
npm install
npm run migrate:auto
```

---

## 🔗 Полезные ссылки после установки

- **PocketBase Admin**: http://localhost:8090/_/
- **Redis**: localhost:6379
- **Frontend Dev**: http://localhost:5173

---

## 📋 Быстрая проверка

```bash
# Проверка сервисов
docker-compose ps

# Проверка PocketBase
curl http://localhost:8090/api/health

# Проверка Redis
docker exec konvert_redis redis-cli ping

# Логи
docker-compose logs -f
```

---

## 🚀 Запуск frontend

```bash
# Обновите .env в корне проекта
echo "VITE_BACKEND_TYPE=pocketbase" >> .env
echo "VITE_POCKETBASE_URL=http://localhost:8090" >> .env

# Установка зависимостей
npm install pocketbase

# Запуск
npm run dev
```

Откройте: http://localhost:5173

---

## 🐛 Если что-то пошло не так

### PocketBase не работает?
```bash
docker logs konvert_pocketbase
docker-compose restart pocketbase
```

### Redis не отвечает?
```bash
docker logs konvert_redis
docker-compose restart redis
```

### Миграция не работает?
```bash
# Проверьте ключи Supabase в .env
cat .env | grep SUPABASE

# Попробуйте снова
rm -rf data/export.json
npm run migrate:export
```

---

## 📚 Полная документация

Смотрите [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) для детальных инструкций

---

## ⚙️ Команды для продакшена

```bash
# Остановка
docker-compose down

# Запуск в фоне
docker-compose up -d

# Бэкап
docker exec konvert_pocketbase tar -czf /pb_data/backup.tar.gz /pb_data

# Просмотр логов
docker-compose logs -f --tail=100
```

---

## 🎉 Готово!

Теперь у вас:
- ✅ Собственный сервер с полным контролем
- ✅ PocketBase + Redis для максимальной производительности
- ✅ E2EE шифрование работает
- ✅ Все данные сохранены

**Наслаждайтесь чатом "Конверт" на своем сервере!** 🚀
