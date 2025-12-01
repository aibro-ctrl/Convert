# Руководство по использованию скрипта setup.sh

## Интерактивная установка (Рекомендуется)

### Базовая установка

```bash
cd backend-setup
chmod +x setup.sh
./setup.sh
```

Скрипт проведет вас через все шаги:

1. **Настройка PocketBase**
   - Запросит хост (по умолчанию: 127.0.0.1)
   - Запросит порт (по умолчанию: 54739)
   - Проверит доступность
   - Предложит запустить, если не запущен

2. **Авторизация администратора**
   - Запросит email администратора PocketBase
   - Запросит пароль (вводится скрыто)
   - Если админа нет - предложит создать

3. **Настройка Redis**
   - Запросит хост (по умолчанию: localhost)
   - Запросит порт (по умолчанию: 6379)
   - Запросит номер БД (по умолчанию: 0)
   - Проверит подключение

4. **Feature Flags**
   - E2EE шифрование
   - Real-time обновления
   - Загрузка файлов
   - Голосовые/видео сообщения
   - Режим "Глаз Бога"
   - Система достижений

5. **Генерация ключей**
   - Автоматически сгенерирует JWT_SECRET
   - Автоматически сгенерирует ENCRYPTION_KEY

6. **Настройка приложения**
   - Режим работы (production/development)
   - Порт frontend (по умолчанию: 3000)
   - Хост frontend (по умолчанию: 0.0.0.0)

7. **Установка**
   - Создаст .env файлы
   - Установит зависимости backend
   - Создаст коллекции PocketBase
   - Установит зависимости frontend
   - Протестирует подключения

### С предварительно заданными переменными

```bash
# Использование кастомного порта PocketBase
POCKETBASE_PORT=8090 ./setup.sh

# Удаленный PocketBase
POCKETBASE_HOST=192.168.1.100 POCKETBASE_PORT=8090 ./setup.sh

# Удаленный Redis
REDIS_HOST=192.168.1.101 REDIS_PORT=6380 ./setup.sh

# Комбинация
POCKETBASE_HOST=10.0.0.5 POCKETBASE_PORT=8090 REDIS_HOST=10.0.0.6 ./setup.sh
```

## Помощь

```bash
./setup.sh --help
# или
./setup.sh -h
```

## Примеры сценариев

### Сценарий 1: Локальная разработка

```bash
./setup.sh
```

Ответы на вопросы:
- Хост PocketBase: `127.0.0.1` (Enter для дефолта)
- Порт PocketBase: `54739` (Enter)
- Email администратора: `admin@localhost`
- Пароль: `ваш_пароль`
- Хост Redis: `localhost` (Enter)
- Порт Redis: `6379` (Enter)
- База Redis: `0` (Enter)
- Все feature flags: `y` (Enter для всех)
- Режим: `development`
- Порт frontend: `3000` (Enter)
- Хост frontend: `0.0.0.0` (Enter)
- Установить зависимости: `y`
- Создать коллекции: `y`
- Тесты: `y`
- Systemd сервисы: `n`

### Сценарий 2: Production сервер

```bash
./setup.sh
```

Ответы:
- Хост PocketBase: `127.0.0.1` (Enter)
- Порт PocketBase: `54739` (Enter)
- Email администратора: `admin@yourdomain.com`
- Пароль: `сложный_пароль`
- Хост Redis: `localhost` (Enter)
- Порт Redis: `6379` (Enter)
- База Redis: `0` (Enter)
- Все feature flags: `y`
- Режим: `production` (Enter)
- Порт frontend: `3000` (Enter)
- Хост frontend: `0.0.0.0` (Enter)
- Установить зависимости: `y`
- Создать коллекции: `y`
- Тесты: `y`
- Systemd сервисы: `y` ← для автозапуска

### Сценарий 3: Микросервисная архитектура

```bash
# PocketBase на отдельном сервере
POCKETBASE_HOST=pocketbase.local POCKETBASE_PORT=8090 ./setup.sh
```

Ответы:
- Хост PocketBase: `pocketbase.local` (предзаполнено)
- Порт PocketBase: `8090` (предзаполнено)
- Email администратора: `admin@pocketbase.local`
- Пароль: `пароль`
- Хост Redis: `redis.local` (вводим вручную)
- Порт Redis: `6379` (Enter)
- ...остальное стандартно

### Сценарий 4: Только минимальные функции

```bash
./setup.sh
```

Ответы:
- ...стандартная настройка PocketBase/Redis
- E2EE: `y`
- Real-time: `y`
- Файлы: `n` ← отключаем
- Голос/видео: `n` ← отключаем
- Глаз Бога: `y`
- Достижения: `n` ← отключаем
- ...остальное стандартно

## После установки

### Запуск в режиме разработки

```bash
cd ..  # Вернуться в корень проекта
npm run dev
```

Откройте http://localhost:3000

### Сборка для production

```bash
npm run build
npm run preview
```

### Запуск с PM2

```bash
npm install -g pm2
pm2 start npm --name "konvert-chat" -- run preview
pm2 save
pm2 startup
```

### Использование systemd (если создали)

```bash
# Запуск
sudo systemctl start konvert-pocketbase
sudo systemctl start konvert-frontend

# Статус
sudo systemctl status konvert-pocketbase
sudo systemctl status konvert-frontend

# Логи
sudo journalctl -u konvert-pocketbase -f
sudo journalctl -u konvert-frontend -f

# Остановка
sudo systemctl stop konvert-frontend
sudo systemctl stop konvert-pocketbase
```

## Переустановка

Если нужно переустановить с другими настройками:

```bash
# Удалить .env файлы
rm -f backend-setup/.env
rm -f .env

# Запустить скрипт снова
./setup.sh
```

**Примечание:** Коллекции в PocketBase НЕ будут удалены, скрипт их пропустит.

## Troubleshooting

### Скрипт не запускается

```bash
# Сделать исполняемым
chmod +x setup.sh

# Проверить права
ls -la setup.sh

# Запустить с bash явно
bash setup.sh
```

### PocketBase не найден

```bash
# Установить PocketBase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.20.0/pocketbase_0.20.0_linux_amd64.zip
unzip pocketbase_0.20.0_linux_amd64.zip
sudo mkdir -p /opt/pocketbase
sudo mv pocketbase /opt/pocketbase/
sudo chmod +x /opt/pocketbase/pocketbase

# Запустить
cd /opt/pocketbase
./pocketbase serve --http=127.0.0.1:54739
```

### Redis не установлен

```bash
sudo apt update
sudo apt install redis-server -y
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Ошибка авторизации PocketBase

1. Убедитесь что создали администратора: http://127.0.0.1:54739/_/
2. Проверьте правильность email и пароля
3. Запустите скрипт снова

### NPM зависимости не устанавливаются

```bash
# Обновить NPM
npm install -g npm@latest

# Очистить кэш
npm cache clean --force

# Попробовать снова
cd backend-setup
npm install
```

## Дополнительная информация

- [QUICKSTART.md](../QUICKSTART.md) - Быстрый старт
- [INSTALL.md](../INSTALL.md) - Подробная установка
- [DEPLOY.md](../DEPLOY.md) - Production деплой
- [README.md](README.md) - Документация backend
