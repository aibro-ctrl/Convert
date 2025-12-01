# Быстрый деплой

## Подготовка сервера

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установить Redis
sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Установить PocketBase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.20.0/pocketbase_0.20.0_linux_amd64.zip
unzip pocketbase_0.20.0_linux_amd64.zip
sudo mkdir -p /opt/pocketbase
sudo mv pocketbase /opt/pocketbase/
sudo chmod +x /opt/pocketbase/pocketbase
```

## Клонирование и настройка

```bash
# Клонировать
cd /var/www
git clone https://github.com/your-username/konvert-chat.git
cd konvert-chat/src

# Backend setup
cd backend-setup
cp .env.example .env
# Отредактируйте .env если нужно
npm install
node create-collections.js
cd ..

# Frontend setup
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)" >> .env
npm install
npm run build
```

## Создание сервисов

### PocketBase сервис

```bash
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

sudo systemctl daemon-reload
sudo systemctl enable pocketbase
sudo systemctl start pocketbase
```

### Node.js сервис (PM2)

```bash
sudo npm install -g pm2
cd /var/www/konvert-chat/src
pm2 start npm --name "konvert" -- run preview
pm2 startup
pm2 save
```

## Nginx

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

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
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/konvert /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d your-domain.com
```

## Первый запуск

1. Откройте http://your-domain.com:54739/_/
2. Создайте администратора PocketBase
3. Откройте http://your-domain.com
4. Зарегистрируйтесь как первый пользователь (будет admin с "Глаз Бога")

## Обновление

```bash
cd /var/www/konvert-chat/src
git pull
npm install
npm run build
pm2 restart konvert
```