#!/bin/bash

###############################################################################
# Скрипт полной установки backend для чата "Конверт"
# Для Ubuntu сервера с PocketBase и Redis (БЕЗ Docker)
###############################################################################

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_header() { echo -e "\n${BLUE}===${NC} $1 ${BLUE}===${NC}\n"; }

# Конфигурация (можно изменить)
POCKETBASE_DIR="${POCKETBASE_DIR:-/opt/pocketbase}"
POCKETBASE_PORT="${POCKETBASE_PORT:-54739}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_header "🚀 Установка Backend для чата 'Конверт'"
echo "PocketBase: $POCKETBASE_DIR"
echo "Redis: $REDIS_HOST:$REDIS_PORT"
echo "App: $APP_DIR"
echo ""

# Проверка прав
if [ "$EUID" -ne 0 ]; then 
    print_warning "Скрипт запущен без sudo, некоторые операции могут потребовать пароль"
fi

# 1. Проверка установки PocketBase
print_header "1. Проверка PocketBase"

if [ ! -f "$POCKETBASE_DIR/pocketbase" ]; then
    print_error "PocketBase не найден в $POCKETBASE_DIR"
    print_info "Установите PocketBase:"
    echo "  wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_linux_amd64.zip"
    echo "  unzip pocketbase_0.22.0_linux_amd64.zip -d $POCKETBASE_DIR"
    exit 1
fi
print_success "PocketBase найден"

# Проверка запущен ли PocketBase
if pgrep -x "pocketbase" > /dev/null; then
    print_success "PocketBase уже запущен"
    POCKETBASE_RUNNING=true
else
    print_warning "PocketBase не запущен"
    POCKETBASE_RUNNING=false
fi

# 2. Проверка Redis
print_header "2. Проверка Redis"

if ! command -v redis-cli &> /dev/null; then
    print_error "Redis CLI не найден"
    print_info "Установите Redis:"
    echo "  sudo apt update"
    echo "  sudo apt install redis-server"
    exit 1
fi
print_success "Redis CLI установлен"

# Проверка работает ли Redis
if redis-cli -h $REDIS_HOST -p $REDIS_PORT ping &> /dev/null; then
    print_success "Redis работает"
else
    print_error "Redis не отвечает на $REDIS_HOST:$REDIS_PORT"
    print_info "Запустите Redis:"
    echo "  sudo systemctl start redis-server"
    exit 1
fi

# 3. Генерация конфигурации
print_header "3. Генерация конфигурации"

# Генерация случайных ключей
generate_random() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

JWT_SECRET=$(generate_random)
ENCRYPTION_KEY=$(generate_random)

# Создание .env файла
cat > "$APP_DIR/.env" << EOF
# ============================================
# Backend Configuration for "Конверт" Chat
# Generated: $(date)
# ============================================

# Backend Type
VITE_BACKEND_TYPE=pocketbase

# PocketBase Configuration
VITE_POCKETBASE_URL=http://localhost:$POCKETBASE_PORT

# Redis Configuration
VITE_REDIS_HOST=$REDIS_HOST
VITE_REDIS_PORT=$REDIS_PORT
VITE_REDIS_DB=0

# Security
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Feature Flags
VITE_E2EE_ENABLED=true
VITE_REALTIME_ENABLED=true
VITE_FILE_UPLOAD_ENABLED=true
VITE_VOICE_VIDEO_ENABLED=true
VITE_GOD_MODE_ENABLED=true
VITE_ACHIEVEMENTS_ENABLED=true

# Application Settings
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
EOF

print_success "Конфигурация создана: $APP_DIR/.env"
print_warning "Сохраните эти ключи безопасности:"
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""

# 4. Запуск PocketBase (если не запущен)
print_header "4. Запуск PocketBase"

if [ "$POCKETBASE_RUNNING" = false ]; then
    print_info "Запуск PocketBase на порту $POCKETBASE_PORT..."
    
    cd $POCKETBASE_DIR
    nohup ./pocketbase serve --http="0.0.0.0:$POCKETBASE_PORT" > pocketbase.log 2>&1 &
    POCKETBASE_PID=$!
    
    print_success "PocketBase запущен (PID: $POCKETBASE_PID)"
    
    # Ждем пока PocketBase запустится
    print_info "Ожидание готовности PocketBase..."
    for i in {1..30}; do
        if curl -s http://localhost:$POCKETBASE_PORT/api/health > /dev/null 2>&1; then
            print_success "PocketBase готов"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
fi

# 5. Установка зависимостей (ПЕРЕД созданием коллекций)
print_header "5. Установка зависимостей"

cd "$APP_DIR"

if [ ! -f "package.json" ]; then
    print_warning "package.json не найден в $APP_DIR, используем backend-setup/package.json"
    cd "$APP_DIR/backend-setup"
fi

print_info "Установка NPM пакетов..."
npm install --no-save pocketbase ioredis dotenv 2>&1 | grep -v "npm WARN" || true

print_success "Зависимости установлены"

# 6. Создание коллекций PocketBase
print_header "6. Создание коллекций в PocketBase"

cd "$APP_DIR/backend-setup"
node create-collections.js

# 7. Создание systemd сервисов
print_header "7. Создание systemd сервисов"

# PocketBase service
sudo tee /etc/systemd/system/konvert-pocketbase.service > /dev/null << EOF
[Unit]
Description=Konvert PocketBase Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$POCKETBASE_DIR
ExecStart=$POCKETBASE_DIR/pocketbase serve --http=0.0.0.0:$POCKETBASE_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

print_success "Systemd service создан: konvert-pocketbase.service"

# Перезагрузка systemd
sudo systemctl daemon-reload
sudo systemctl enable konvert-pocketbase
print_success "PocketBase добавлен в автозагрузку"

# 8. Настройка Redis
print_header "8. Настройка Redis"

# Проверяем конфигурацию Redis
REDIS_CONF="/etc/redis/redis.conf"

if [ -f "$REDIS_CONF" ]; then
    print_info "Проверка конфигурации Redis..."
    
    # Рекомендуемые настройки
    print_info "Рекомендуемые настройки Redis:"
    echo "  maxmemory 256mb"
    echo "  maxmemory-policy allkeys-lru"
    echo "  appendonly yes"
    
    read -p "Применить рекомендуемые настройки Redis? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo cp $REDIS_CONF ${REDIS_CONF}.backup
        
        # Применяем настройки
        sudo sed -i 's/^# maxmemory .*/maxmemory 256mb/' $REDIS_CONF
        sudo sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' $REDIS_CONF
        sudo sed -i 's/^appendonly no/appendonly yes/' $REDIS_CONF
        
        sudo systemctl restart redis-server
        print_success "Redis настроен и перезапущен"
    fi
fi

# 9. Тестирование подключений
print_header "9. Тестирование подключений"

# Тест PocketBase
print_info "Тестирование PocketBase..."
if curl -s http://localhost:$POCKETBASE_PORT/api/health | grep -q "ok"; then
    print_success "PocketBase: OK"
else
    print_error "PocketBase: FAILED"
fi

# Тест Redis
print_info "Тестирование Redis..."
if echo "PING" | redis-cli -h $REDIS_HOST -p $REDIS_PORT | grep -q "PONG"; then
    print_success "Redis: OK"
else
    print_error "Redis: FAILED"
fi

# Тест Redis SET/GET
print_info "Тестирование Redis кэша..."
redis-cli -h $REDIS_HOST -p $REDIS_PORT SET test_key "test_value" > /dev/null
if [ "$(redis-cli -h $REDIS_HOST -p $REDIS_PORT GET test_key)" = "test_value" ]; then
    print_success "Redis кэш: OK"
    redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL test_key > /dev/null
else
    print_error "Redis кэш: FAILED"
fi

# 10. Финальная настройка
print_header "10. Финальная настройка"

# Создание директорий
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/uploads"
mkdir -p "$POCKETBASE_DIR/pb_data"

print_success "Директории созданы"

# Права доступа
chmod 755 "$APP_DIR/logs"
chmod 755 "$APP_DIR/uploads"

print_success "Права доступа установлены"

# 11. Итоги
print_header "✅ Установка завершена!"

echo ""
print_success "Backend сервисы:"
echo "  PocketBase: http://localhost:$POCKETBASE_PORT"
echo "  PocketBase Admin: http://localhost:$POCKETBASE_PORT/_/"
echo "  Redis: $REDIS_HOST:$REDIS_PORT"
echo ""

print_info "Полезные команды:"
echo "  sudo systemctl status konvert-pocketbase  # Статус PocketBase"
echo "  sudo systemctl restart konvert-pocketbase # Перезапуск PocketBase"
echo "  sudo systemctl status redis-server        # Статус Redis"
echo "  redis-cli monitor                          # Мониторинг Redis"
echo "  tail -f $POCKETBASE_DIR/pocketbase.log    # Логи PocketBase"
echo ""

print_info "Следующие шаги:"
echo "  1. Создайте первого администратора в PocketBase Admin UI"
echo "  2. Запустите frontend: cd $APP_DIR && npm run dev"
echo "  3. Откройте в браузере: http://localhost:3000"
echo ""

print_warning "ВАЖНО: Сохраните учетные данные из .env файла!"
echo ""

print_success "Backend готов к использованию! 🚀"