# ⚡ БЫСТРОЕ ИСПРАВЛЕНИЕ

## Ошибка исправлена! ✅

Я исправил проблему `PocketBase is not a constructor` в файлах:
- ✅ `create-collections.js` 
- ✅ `test-connection.js`
- ✅ `redis-cache.js`

И создал `.env` файл с правильным URL вашего PocketBase: **http://127.0.0.1:54739**

---

## 🚀 Что делать СЕЙЧАС:

### Шаг 1: Проверьте .env файл

```bash
cd /var/www/Convert/src/backend-setup
cat .env
```

Должно быть:
```
VITE_POCKETBASE_URL=http://127.0.0.1:54739
VITE_REDIS_HOST=localhost
VITE_REDIS_PORT=6379
VITE_REDIS_DB=0
```

Если нужно изменить - используйте:
```bash
./configure.sh
```

### Шаг 2: Установите зависимости

```bash
npm install pocketbase ioredis dotenv
```

### Шаг 3: Проверьте импорт (необязательно)

```bash
node test-imports.js
```

Должно показать:
```
✅ Все модули импортированы корректно!
```

### Шаг 4: Создайте коллекции

```bash
node create-collections.js
```

### Шаг 5: Проверьте подключение

```bash
node test-connection.js
```

---

## 📋 Альтернативный метод (через NPM скрипты):

```bash
cd /var/www/Convert/src/backend-setup

# Установить зависимости
npm run install-deps

# Проверить импорт
npm run test-imports

# Создать коллекции
npm run create-collections

# Тест подключения
npm test
```

---

## 🎯 После успешного создания коллекций:

### Создайте администратора:

1. Откройте: http://localhost:8090/_/
2. Создайте админа:
   - Email: `admin@konvert.chat`
   - Password: `ваш_пароль`

### Создайте .env файл:

```bash
cd /var/www/Convert/src

cat > .env << 'EOF'
# Backend
VITE_BACKEND_TYPE=pocketbase
VITE_POCKETBASE_URL=http://localhost:8090

# Redis
VITE_REDIS_HOST=localhost
VITE_REDIS_PORT=6379
VITE_REDIS_DB=0

# Features
VITE_E2EE_ENABLED=true
VITE_REALTIME_ENABLED=true
VITE_FILE_UPLOAD_ENABLED=true
VITE_VOICE_VIDEO_ENABLED=true
VITE_GOD_MODE_ENABLED=true
VITE_ACHIEVEMENTS_ENABLED=true

# Security (сгенерируйте новые!)
JWT_SECRET=your_jwt_secret_32_chars_here
ENCRYPTION_KEY=your_encryption_key_32_chars
EOF
```

Сгенерируйте ключи:
```bash
echo "JWT_SECRET=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)" >> .env
```

### Запустите приложение:

```bash
npm run dev
```

Откройте: http://localhost:3000

---

## 🐛 Если всё еще ошибки:

### Очистите и переустановите:

```bash
cd /var/www/Convert/src/backend-setup
rm -rf node_modules package-lock.json
npm cache clean --force
npm install pocketbase ioredis dotenv
```

### Проверьте версии:

```bash
npm list pocketbase
npm list ioredis
npm list dotenv
```

---

## ✅ Контрольный список:

- [ ] PocketBase запущен (`curl http://localhost:8090/api/health`)
- [ ] Redis работает (`redis-cli ping`)
- [ ] Зависимости установлены (`npm list`)
- [ ] Импорт работает (`node test-imports.js`)
- [ ] Коллекции созданы (`node create-collections.js`)
- [ ] Тест пройден (`node test-connection.js`)
- [ ] Администратор создан (http://localhost:8090/_/)
- [ ] .env файл создан
- [ ] Приложение запускается (`npm run dev`)

---

## 📊 Созданные коллекции:

После успешного выполнения `create-collections.js` у вас будет:

1. ✅ **users** (auth) - пользователи с E2EE ключами
2. ✅ **rooms** - комнаты (public/private/dm)
3. ✅ **messages** - сообщения с реакциями
4. ✅ **achievements** - 8 готовых достижений
5. ✅ **user_achievements** - прогресс пользователей
6. ✅ **friend_requests** - заявки в друзья
7. ✅ **files** - загруженные файлы

---

## 🎉 Готово!

Backend полностью настроен и готов к использованию! 🚀

**Следующий шаг:** Запустите frontend и начните использовать чат!

---

**Исправлено:** 01.12.2025  
**Версия:** 1.0.2  
**Статус:** ✅ Готово к установке