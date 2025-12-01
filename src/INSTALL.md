# Установка на Ubuntu Server

Полная инструкция по установке чата "Конверт" на Ubuntu сервере.

## Вариант 1: Интерактивная установка (Рекомендуется) 🚀

```bash
# Клонировать репозиторий
git clone https://github.com/your-username/konvert-chat.git
cd konvert-chat

# Запустить интерактивный скрипт
cd backend-setup
chmod +x setup.sh
./setup.sh
```

Скрипт автоматически проверит все зависимости, запросит настройки и выполнит установку!

---

## Вариант 2: Ручная установка

## Требования

- Ubuntu Server 20.04+
- Node.js 18+
- PocketBase
- Redis

## Установка

### 1. Клонировать репозиторий

```bash
git clone https://github.com/your-username/konvert-chat.git
cd konvert-chat/src
```

**Важно:** Файл `.env` не включен в репозиторий (в .gitignore). Вы должны создать его самостоятельно на каждом сервере.

### 2. Установить PocketBase

```bash
# Скачать PocketBase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.20.0/pocketbase_0.20.0_linux_amd64.zip
unzip pocketbase_0.20.0_linux_amd64.zip
sudo mkdir -p /opt/pocketbase
sudo mv pocketbase /opt/pocketbase/
sudo chmod +x /opt/pocketbase/pocketbase

# Создать сервис
sudo tee /etc/systemd/system/pocketbase.service > /dev/null <<EOF
[Unit]
Description=PocketBase
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:54739
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Запустить
sudo systemctl daemon-reload
sudo systemctl enable pocketbase
sudo systemctl start pocketbase
```

### 3. Установить Redis

```bash
sudo apt update
sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 4. Настроить backend

```bash
cd backend-setup

# Создать .env
cat > .env <<EOF
VITE_POCKETBASE_URL=http://127.0.0.1:54739
VITE_REDIS_HOST=localhost
VITE_REDIS_PORT=6379
VITE_REDIS_DB=0
EOF

# Установить зависимости
npm install pocketbase ioredis dotenv
```

**ВАЖНО:** Перед следующим шагом откройте http://127.0.0.1:54739/_/ и создайте администратора PocketBase.

```bash
# Создать коллекции (потребует email и пароль администратора)
node create-collections.js
```

### 5. Настроить frontend

```bash
cd ..

# Создать .env
cat > .env <<EOF
VITE_BACKEND_TYPE=pocketbase
VITE_POCKETBASE_URL=http://127.0.0.1:54739
VITE_REDIS_HOST=localhost
VITE_REDIS_PORT=6379
VITE_REDIS_DB=0
VITE_E2EE_ENABLED=true
VITE_REALTIME_ENABLED=true
VITE_FILE_UPLOAD_ENABLED=true
VITE_VOICE_VIDEO_ENABLED=true
VITE_GOD_MODE_ENABLED=true
VITE_ACHIEVEMENTS_ENABLED=true
EOF

# Сгенерировать ключи
echo "JWT_SECRET=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)" >> .env

# Установить зависимости
npm install
```

### 6. Запустить приложение

```bash
# Development
npm run dev

# Production
npm run build
npm run preview
```

## Production с Nginx

```bash
# Установить Nginx
sudo apt install nginx -y

# Настроить
sudo tee /etc/nginx/sites-available/konvert <<EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:54739;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/konvert /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL (опционально)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Проверка

```bash
# PocketBase
curl http://127.0.0.1:54739/api/health

# Redis
redis-cli ping

# Backend
cd backend-setup
node test-connection.js
```

Готово! Откройте http://your-domain.com