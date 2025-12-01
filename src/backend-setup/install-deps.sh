#!/bin/bash

###############################################################################
# Быстрая установка зависимостей для backend-setup
###############################################################################

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_info "Установка зависимостей для backend-setup..."
cd "$SCRIPT_DIR"

# Проверяем есть ли node_modules
if [ -d "node_modules" ]; then
    print_info "node_modules уже существует, обновляем..."
fi

# Устанавливаем зависимости
npm install pocketbase ioredis dotenv

print_success "Зависимости установлены!"
print_info "Установлено:"
echo "  - pocketbase"
echo "  - ioredis"
echo "  - dotenv"
echo ""
print_info "Теперь можно запустить:"
echo "  node create-collections.js"
echo "  node test-connection.js"
