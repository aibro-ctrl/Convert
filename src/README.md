# 📨 Конверт - Защищенный чат с E2EE шифрованием

Современное приложение для обмена сообщениями с end-to-end шифрованием, системой ролей и расширенным функционалом.

## ✨ Основные возможности

### 🔐 Безопасность
- **End-to-End шифрование** (RSA-OAEP для личных сообщений, AES-GCM для групповых)
- Четырехуровневая система ролей (Админ, Модератор, VIP, Пользователь)
- JWT аутентификация
- Защита конфиденциальности

### 💬 Чаты
- Личные (DM) и групповые чаты
- Публичные и приватные комнаты
- Real-time обновления через WebSocket
- Система упоминаний (@username, @admin, @moder)

### 📎 Медиа
- Загрузка изображений, документов
- Голосовые и видео сообщения
- Автоматическая компрессия

### ⚡ Интерактивность
- Реакции на сообщения (эмодзи)
- Закрепление сообщений
- Опросы в чатах
- Система достижений

### 🛠️ Модерация
- Бан/мут пользователей
- Управление правами
- Режим "Глаз Бога" (только для iBro)

### 🔍 Удобство
- Поиск по сообщениям и пользователям
- Уведомления о новых сообщениях
- Адаптивный дизайн
- Темная/светлая темы

---

## 🚀 Быстрый старт

### Требования

- **Node.js** 18+ и npm
- **PocketBase** (для базы данных)
- **Redis** (для кэширования)
- **Git**
- **Ubuntu** 20.04+ (или другой Linux)

### Установка

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/aibro-ctrl/Convert.git
cd Convert/src

# 2. Установите зависимости
npm install

# 3. Настройте окружение
cp .env.example .env
nano .env  # Настройте переменные

# 4. Настройте бэкенд (PocketBase + Redis)
cd backend-setup
npm install
./setup.sh

# 5. Вернитесь в корень и соберите приложение
cd ..
npm run build

# 6. Запустите для разработки
npm run dev
```

Подробная инструкция: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🔄 Автоматическое обновление

### Метод 1: Скрипт обновления (рекомендуется)

```bash
# Сделайте скрипт исполняемым
chmod +x update.sh

# Обновите приложение
./update.sh
```

**Возможности:**
- ✅ Автоматическая проверка изменений в GitHub
- ✅ Бэкап важных файлов
- ✅ Установка новых зависимостей
- ✅ Автоматическая сборка

**Опции:**
```bash
./update.sh --dry-run    # Проверить без обновления
./update.sh --force      # Принудительное обновление
./update.sh --no-build   # Обновить без сборки
```

### Метод 2: GitHub Webhook (автоматическое обновление при push)

Настройте webhook для автоматического обновления при каждом push в репозиторий.

```bash
# Установите webhook сервер
npm install express
chmod +x webhook-server.js webhook-update.sh

# Настройте systemd
sudo cp webhook-server.service /etc/systemd/system/
sudo systemctl enable convert-webhook
sudo systemctl start convert-webhook
```

Подробная инструкция: [WEBHOOK_SETUP.md](WEBHOOK_SETUP.md)

### Метод 3: Cron (периодическое обновление)

```bash
crontab -e

# Добавьте (обновление каждый день в 3:00 AM):
0 3 * * * cd /var/www/Convert/src && ./update.sh --force >> /var/log/convert-update.log 2>&1
```

---

## 📚 Документация

| Документ | Описание |
|----------|----------|
| [QUICK_UPDATE.md](QUICK_UPDATE.md) | Шпаргалка по обновлению |
| [UPDATE_GUIDE.md](UPDATE_GUIDE.md) | Полное руководство по обновлению |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Развертывание и настройка |
| [WEBHOOK_SETUP.md](WEBHOOK_SETUP.md) | Настройка автоматического обновления |
| [MIGRATION_COMPLETE.md](MIGRATION_COMPLETE.md) | Документация миграции на PocketBase |
| [backend-setup/README.md](backend-setup/README.md) | Настройка бэкенда |

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                     │
│  • TypeScript + Vite                                    │
│  • Tailwind CSS                                         │
│  • WebSocket для real-time                             │
│  • Web Crypto API для E2EE                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 Backend (PocketBase)                    │
│  • REST API                                             │
│  • WebSocket/SSE для real-time                         │
│  • File storage                                         │
│  • SQLite база данных                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Redis (Кэш)                           │
│  • Кэширование данных                                   │
│  • Сессии                                               │
└─────────────────────────────────────────────────────────┘
```

### Технологии

**Frontend:**
- React 18
- TypeScript
- Vite
- Tailwind CSS 4
- Lucide React (иконки)
- Recharts (графики)
- Motion (анимации)

**Backend:**
- PocketBase (база данных + API)
- Redis (кэширование)

**Безопасность:**
- RSA-OAEP 2048-bit (личные сообщения)
- AES-GCM 256-bit (групповые чаты)
- JWT токены
- PBKDF2 для хеширования паролей

---

## 🔧 Разработка

### Локальный запуск

```bash
# Dev сервер с hot reload
npm run dev

# Сборка для продакшена
npm run build

# Превью продакшен сборки
npm run preview
```

### Структура проекта

```
Convert/src/
├── components/          # React компоненты
│   ├── Auth/           # Аутентификация
│   ├── Chat/           # Чаты и сообщения
│   ├── Profile/        # Профиль и настройки
│   └── ui/             # UI компоненты
├── contexts/           # React контексты
├── utils/              # Утилиты
│   ├── pocketbase/    # PocketBase клиент
│   ├── crypto.ts      # Шифрование
│   └── api.ts         # API типы
├── styles/             # Стили
├── backend-setup/      # Скрипты настройки бэкенда
├── backend-adapter/    # Адаптер PocketBase
├── App.tsx            # Главный компонент
├── main.tsx           # Точка входа
└── index.html         # HTML шаблон
```

### Переменные окружения

```env
# .env
VITE_POCKETBASE_URL=http://127.0.0.1:54739
VITE_E2EE_ENABLED=true
VITE_REALTIME_ENABLED=true
VITE_FILE_UPLOAD_ENABLED=true
VITE_VOICE_VIDEO_ENABLED=true
VITE_GOD_MODE_ENABLED=true
VITE_ACHIEVEMENTS_ENABLED=true
```

См. [.env.example](.env.example) для всех опций.

---

## 👥 Система ролей

| Роль | Права |
|------|-------|
| **Админ** | Полный доступ, управление пользователями, модераторами, создание комнат |
| **Модератор** | Бан/мут пользователей, удаление сообщений, модерация комнат |
| **VIP** | Приоритетная поддержка, доступ к VIP функциям |
| **Пользователь** | Базовые функции чата |

**Особый пользователь iBro:**
- Единственный с доступом к режиму "Глаз Бога"
- Невозможно убрать роль администратора
- Автоматически создается при первой установке

---

## 🔒 Безопасность

### Шифрование

**Личные сообщения:**
1. Генерация RSA ключевой пары (2048-bit)
2. Публичный ключ хранится на сервере
3. Приватный ключ хранится локально (IndexedDB)
4. Сообщение шифруется публичным ключом получателя
5. Расшифровка приватным ключом получателя

**Групповые чаты:**
1. Генерация случайного AES-256 ключа для комнаты
2. AES ключ шифруется RSA для каждого участника
3. Сообщения шифруются AES-GCM
4. Каждый участник расшифровывает AES ключ своим RSA приватным ключом

### Рекомендации

- ✅ Регулярно меняйте пароли
- ✅ Используйте HTTPS в продакшене
- ✅ Делайте бэкапы базы данных
- ✅ Мониторьте логи на подозрительную активность
- ✅ Обновляйте зависимости

---

## 📊 Мониторинг

### Логи

```bash
# Логи обновлений
tail -f /var/log/convert-update.log

# Логи webhook (если настроен)
tail -f /var/log/convert-webhook.log

# Логи PocketBase
tail -f /var/www/Convert/src/pocketbase/pb_logs.txt

# Логи Redis
sudo journalctl -u redis -f
```

### Статус сервисов

```bash
# PocketBase
sudo systemctl status pocketbase

# Redis
sudo systemctl status redis

# Webhook сервер (если настроен)
sudo systemctl status convert-webhook

# Nginx
sudo systemctl status nginx
```

---

## 🆘 Поддержка

### Частые проблемы

**Ошибка сборки TypeScript:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Проблемы с PocketBase:**
```bash
cd backend-setup
./test-connection.js
```

**Проблемы с Redis:**
```bash
redis-cli ping  # Должен вернуть PONG
```

### Восстановление

**Откат к предыдущей версии:**
```bash
git log --oneline -10
git reset --hard <commit-hash>
npm install
npm run build
```

**Восстановление из бэкапа:**
```bash
ls -la backups/
cp backups/update-YYYYMMDD-HHMMSS/.env .env
```

---

## 🤝 Вклад в проект

Мы приветствуем вклад в развитие проекта! Пожалуйста:

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

---

## 📄 Лицензия

MIT License - см. [LICENSE](LICENSE) файл для деталей.

---

## 🙏 Благодарности

- [PocketBase](https://pocketbase.io/) - Бэкенд
- [React](https://react.dev/) - UI framework
- [Tailwind CSS](https://tailwindcss.com/) - Стили
- [Lucide](https://lucide.dev/) - Иконки

---

## 📞 Контакты

- GitHub: [@aibro-ctrl](https://github.com/aibro-ctrl)
- Репозиторий: [Convert](https://github.com/aibro-ctrl/Convert)

---

**Сделано с ❤️ для безопасного общения**
