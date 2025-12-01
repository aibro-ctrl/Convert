#!/bin/bash

###############################################################################
# Установочный скрипт для чата "Конверт"
# Автоматическая установка PocketBase + Redis + Frontend
###############################################################################

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для цветного вывода
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_header() { echo -e "\n${BLUE}===${NC} $1 ${BLUE}===${NC}\n"; }

# Проверка операционной системы
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

print_header "Установка чата 'Конверт'"
print_info "Операционная система: $MACHINE"

# Проверка Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker не установлен!"
        print_info "Установите Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker установлен"

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose не установлен!"
        print_info "Установите Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    print_success "Docker Compose установлен"
}

# Создание .env файла
setup_env() {
    print_header "Настройка конфигурации"

    if [ -f .env ]; then
        print_warning ".env файл уже существует"
        read -p "Перезаписать? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Пропускаем создание .env"
            return
        fi
    fi

    cp .env.example .env
    print_success ".env файл создан"

    # Генерация случайных ключей
    JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    REDIS_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/")
    POCKETBASE_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/")

    # Обновляем .env
    sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i.bak "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
    sed -i.bak "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" .env
    sed -i.bak "s/POCKETBASE_ADMIN_PASSWORD=.*/POCKETBASE_ADMIN_PASSWORD=$POCKETBASE_PASSWORD/" .env

    rm -f .env.bak

    print_success "Сгенерированы случайные ключи безопасности"
    print_warning "Сохраните эти данные:"
    echo ""
    echo "PocketBase Admin Email: admin@konvert.chat"
    echo "PocketBase Admin Password: $POCKETBASE_PASSWORD"
    echo "Redis Password: $REDIS_PASSWORD"
    echo ""
}

# Запуск Docker Compose
start_docker() {
    print_header "Запуск сервисов"

    print_info "Создание директорий..."
    mkdir -p pb_data pb_migrations backups data

    print_info "Запуск Docker Compose..."
    docker-compose up -d

    print_success "Сервисы запущены!"
}

# Ожидание готовности сервисов
wait_for_services() {
    print_header "Ожидание готовности сервисов"

    print_info "Ожидание PocketBase..."
    for i in {1..30}; do
        if curl -s http://localhost:8090/api/health > /dev/null 2>&1; then
            print_success "PocketBase готов"
            break
        fi
        echo -n "."
        sleep 2
    done

    print_info "Ожидание Redis..."
    for i in {1..30}; do
        if docker exec konvert_redis redis-cli ping > /dev/null 2>&1; then
            print_success "Redis готов"
            break
        fi
        echo -n "."
        sleep 2
    done
}

# Инициализация PocketBase
init_pocketbase() {
    print_header "Инициализация PocketBase"

    # Ждем немного дольше для полной инициализации
    sleep 5

    print_info "Создание схемы базы данных..."
    # Схема создается автоматически при первом запуске

    print_success "PocketBase инициализирован"
}

# Миграция данных (опционально)
migrate_data() {
    print_header "Миграция данных"

    read -p "Мигрировать данные из Supabase? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ ! -f package.json ]; then
            print_error "package.json не найден"
            print_info "Установите зависимости: npm install"
            return
        fi

        print_info "Установка зависимостей..."
        npm install

        print_info "Запуск миграции..."
        npm run migrate:auto

        print_success "Миграция завершена"
    else
        print_info "Пропускаем миграцию"
    fi
}

# Вывод итоговой информации
print_summary() {
    print_header "Установка завершена!"

    echo ""
    print_success "Сервисы запущены:"
    echo ""
    echo "  📦 PocketBase Admin: http://localhost:8090/_/"
    echo "  🔴 Redis: localhost:6379"
    echo ""
    
    print_info "Учетные данные:"
    echo ""
    echo "  Email: admin@konvert.chat"
    echo "  Password: (смотрите выше или в .env файле)"
    echo ""

    print_info "Полезные команды:"
    echo ""
    echo "  docker-compose ps       - Статус сервисов"
    echo "  docker-compose logs -f  - Просмотр логов"
    echo "  docker-compose stop     - Остановить сервисы"
    echo "  docker-compose down     - Удалить сервисы"
    echo ""

    print_warning "Важно:"
    echo "  1. Сохраните пароли из .env файла"
    echo "  2. Настройте HTTPS для продакшена"
    echo "  3. Измените пароли перед деплоем"
    echo ""
}

# Главная функция
main() {
    check_docker
    setup_env
    start_docker
    wait_for_services
    init_pocketbase
    migrate_data
    print_summary
}

# Обработка ошибок
trap 'print_error "Произошла ошибка! Проверьте логи: docker-compose logs"' ERR

# Запуск
main "$@"
