#!/bin/bash

###############################################################################
# Скрипт настройки окружения для backend
###############################################################################

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

echo ""
echo "=================================="
echo "  Настройка Backend окружения"
echo "=================================="
echo ""

# Определение директории скрипта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# Проверка существующего .env
if [ -f "$ENV_FILE" ]; then
    print_warning "Файл .env уже существует"
    echo ""
    cat "$ENV_FILE"
    echo ""
    read -p "Перезаписать? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Отменено"
        exit 0
    fi
fi

# Получение параметров
echo ""
print_info "Введите настройки (или нажмите Enter для значений по умолчанию):"
echo ""

read -p "PocketBase URL [http://127.0.0.1:54739]: " POCKETBASE_URL
POCKETBASE_URL=${POCKETBASE_URL:-http://127.0.0.1:54739}

read -p "Redis Host [localhost]: " REDIS_HOST
REDIS_HOST=${REDIS_HOST:-localhost}

read -p "Redis Port [6379]: " REDIS_PORT
REDIS_PORT=${REDIS_PORT:-6379}

read -p "Redis DB [0]: " REDIS_DB
REDIS_DB=${REDIS_DB:-0}

# Создание .env файла
cat > "$ENV_FILE" << EOF
# PocketBase Configuration
VITE_POCKETBASE_URL=$POCKETBASE_URL

# Redis Configuration
VITE_REDIS_HOST=$REDIS_HOST
VITE_REDIS_PORT=$REDIS_PORT
VITE_REDIS_DB=$REDIS_DB
EOF

print_success "Файл .env создан: $ENV_FILE"
echo ""
cat "$ENV_FILE"
echo ""

# Проверка подключения
print_info "Проверка подключения к PocketBase..."
if curl -s "$POCKETBASE_URL/api/health" > /dev/null 2>&1; then
    print_success "PocketBase доступен на $POCKETBASE_URL"
else
    print_warning "PocketBase не доступен на $POCKETBASE_URL"
    print_info "Убедитесь что PocketBase запущен"
fi

print_info "Проверка подключения к Redis..."
if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    print_success "Redis доступен на $REDIS_HOST:$REDIS_PORT"
else
    print_warning "Redis не доступен на $REDIS_HOST:$REDIS_PORT"
    print_info "Убедитесь что Redis запущен"
fi

echo ""
print_success "Настройка завершена!"
echo ""
print_info "Теперь можно запустить:"
echo "  node create-collections.js"
echo "  node test-connection.js"
echo ""
