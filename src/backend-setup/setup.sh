#!/bin/bash

###############################################################################
# Интерактивный скрипт установки backend для чата "Конверт"
# Для Ubuntu сервера с PocketBase и Redis (БЕЗ Docker)
###############################################################################

set -e

# Показать помощь
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    cat << EOF
Интерактивный скрипт установки Konvert Chat

ИСПОЛЬЗОВАНИЕ:
    ./setup.sh

ОПИСАНИЕ:
    Скрипт автоматически:
    - Проверит PocketBase и Redis
    - Запросит все необходимые настройки
    - Создаст .env файлы
    - Установит зависимости
    - Создаст коллекции в PocketBase
    - Протестирует подключения

ТРЕБОВАНИЯ:
    - Node.js 18+
    - PocketBase (должен быть установлен)
    - Redis (должен быть установлен)

ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (опционально):
    POCKETBASE_HOST     - Хост PocketBase (по умолчанию: 127.0.0.1)
    POCKETBASE_PORT     - Порт PocketBase (по умолчанию: 54739)
    REDIS_HOST          - Хост Redis (по умолчанию: localhost)
    REDIS_PORT          - Порт Redis (по умолчанию: 6379)

ПРИМЕРЫ:
    # Обычная установка
    ./setup.sh

    # С переменными окружения
    POCKETBASE_PORT=8090 ./setup.sh

ДОКУМЕНТАЦИЯ:
    Подробнее: https://github.com/your-username/konvert-chat

EOF
    exit 0
fi

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_header() { echo -e "\n${MAGENTA}╔════════════════════════════════════════════════════╗${NC}"; echo -e "${MAGENTA}║${NC}  $1"; echo -e "${MAGENTA}╚════════════════════════════════════════════════════╝${NC}\n"; }
print_step() { echo -e "\n${CYAN}▶${NC} ${BLUE}$1${NC}\n"; }

# Функция для чтения пользовательского ввода с дефолтным значением
read_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local is_password="$4"
    
    if [ -n "$default" ]; then
        prompt="$prompt [${GREEN}$default${NC}]"
    fi
    
    echo -ne "${CYAN}?${NC} $prompt: "
    
    if [ "$is_password" = "password" ]; then
        read -s input
        echo ""
    else
        read input
    fi
    
    if [ -z "$input" ]; then
        eval "$var_name='$default'"
    else
        eval "$var_name='$input'"
    fi
}

# Функция для подтверждения
confirm() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "$default" = "y" ]; then
        prompt="$prompt [${GREEN}Y${NC}/n]"
    else
        prompt="$prompt [y/${RED}N${NC}]"
    fi
    
    echo -ne "${CYAN}?${NC} $prompt: "
    read -r response
    
    if [ -z "$response" ]; then
        response="$default"
    fi
    
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# Генерация случайного ключа
generate_random() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Баннер
clear
echo -e "${MAGENTA}"
cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██╗  ██╗ ██████╗ ███╗   ██╗██╗   ██╗███████╗██████╗ ████████╗
║   ██║ ██╔╝██╔═══██╗████╗  ██║██║   ██║██╔════╝██╔══██╗╚══██╔══╝
║   █████╔╝ ██║   ██║██╔██╗ ██║██║   ██║█████╗  ██████╔╝   ██║   
║   ██╔═██╗ ██║   ██║██║╚██╗██║╚██╗ ██╔╝██╔══╝  ██╔══██╗   ██║   
║   ██║  ██╗╚██████╔╝██║ ╚████║ ╚████╔╝ ███████╗██║  ██║   ██║   
║   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝   
║                                                              ║
║                  Интерактивная установка                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_info "Этот скрипт поможет вам настроить backend для чата Конверт"
print_info "Путь к приложению: ${CYAN}$APP_DIR${NC}"
echo ""

# ============================================================================
# ШАГ 1: Сбор информации о PocketBase
# ============================================================================
print_header "Шаг 1: Настройка PocketBase"

read_input "Хост PocketBase" "${POCKETBASE_HOST:-127.0.0.1}" POCKETBASE_HOST
read_input "Порт PocketBase" "${POCKETBASE_PORT:-54739}" POCKETBASE_PORT
POCKETBASE_URL="http://${POCKETBASE_HOST}:${POCKETBASE_PORT}"

print_info "Проверка доступности PocketBase на ${CYAN}$POCKETBASE_URL${NC}..."

if curl -s -f "$POCKETBASE_URL/api/health" > /dev/null 2>&1; then
    print_success "PocketBase доступен"
    POCKETBASE_RUNNING=true
else
    print_warning "PocketBase не отвечает на $POCKETBASE_URL"
    POCKETBASE_RUNNING=false
    
    if confirm "Хотите указать путь к директории PocketBase для автозапуска?" "y"; then
        read_input "Путь к директории PocketBase" "/opt/pocketbase" POCKETBASE_DIR
        
        if [ -f "$POCKETBASE_DIR/pocketbase" ]; then
            print_success "PocketBase найден в $POCKETBASE_DIR"
            
            if confirm "Запустить PocketBase сейчас?" "y"; then
                print_info "Запуск PocketBase..."
                cd "$POCKETBASE_DIR"
                nohup ./pocketbase serve --http="${POCKETBASE_HOST}:${POCKETBASE_PORT}" > pocketbase.log 2>&1 &
                POCKETBASE_PID=$!
                print_success "PocketBase запущен (PID: $POCKETBASE_PID)"
                
                # Ждем запуска
                print_info "Ожидание готовности PocketBase..."
                for i in {1..30}; do
                    if curl -s -f "$POCKETBASE_URL/api/health" > /dev/null 2>&1; then
                        print_success "PocketBase готов к работе"
                        POCKETBASE_RUNNING=true
                        break
                    fi
                    echo -n "."
                    sleep 1
                done
                echo ""
            fi
        else
            print_error "PocketBase не найден в $POCKETBASE_DIR"
            print_info "Установите PocketBase и запустите скрипт снова"
            exit 1
        fi
    else
        print_warning "Убедитесь что PocketBase запущен перед продолжением"
        if ! confirm "Продолжить установку?" "y"; then
            exit 0
        fi
    fi
fi

# ============================================================================
# ШАГ 2: Авторизация в PocketBase
# ============================================================================
print_header "Шаг 2: Авторизация в PocketBase"

print_info "Для создания коллекций требуется администратор PocketBase"
print_info "Если вы еще не создали администратора, откройте:"
print_info "${CYAN}$POCKETBASE_URL/_/${NC}"
echo ""

# Проверяем наличие администратора
if [ -f "$APP_DIR/backend-setup/node_modules/pocketbase/package.json" ]; then
    print_info "Проверка наличия администратора..."
    cd "$APP_DIR/backend-setup"
    
    if node check-admin.js 2>&1 | grep -q "Администратор СОЗДАН"; then
        print_success "Администратор уже создан"
        ADMIN_EXISTS=true
    else
        print_warning "Администратор не создан"
        ADMIN_EXISTS=false
    fi
else
    ADMIN_EXISTS=false
fi

if [ "$ADMIN_EXISTS" = false ]; then
    print_warning "Необходимо создать администратора PocketBase"
    print_info "Откройте ${CYAN}$POCKETBASE_URL/_/${NC} в браузере"
    
    if confirm "Открыть URL в браузере? (требует xdg-open)" "n"; then
        xdg-open "$POCKETBASE_URL/_/" 2>/dev/null || print_warning "Не удалось открыть браузер"
    fi
    
    echo ""
    read -p "Нажмите Enter после создания администратора..."
fi

# Функция для ввода и валидации учетных данных администратора
validate_and_input_admin_credentials() {
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if [ $attempt -gt 1 ]; then
            print_warning "Попытка $attempt из $max_attempts"
        fi
        
        read_input "Email администратора" "" ADMIN_EMAIL
        read_input "Пароль администратора" "" ADMIN_PASSWORD "password"
        
        # Проверяем что NPM пакеты установлены
        if [ ! -d "$APP_DIR/backend-setup/node_modules/pocketbase" ]; then
            print_info "Установка pocketbase для валидации..."
            cd "$APP_DIR/backend-setup"
            npm install --no-save pocketbase 2>&1 | grep -v "npm WARN" || true
        fi
        
        # Валидация учетных данных
        print_info "Проверка учетных данных..."
        
        cd "$APP_DIR/backend-setup"
        local validation_result
        validation_result=$(node validate-admin.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$POCKETBASE_URL" 2>&1)
        local validation_status=$?
        
        if echo "$validation_result" | grep -q "SUCCESS"; then
            print_success "✓ Авторизация успешна!"
            
            # Показываем информацию об администраторе
            local admin_info
            admin_info=$(echo "$validation_result" | tail -n 1)
            local admin_id
            admin_id=$(echo "$admin_info" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
            
            if [ -n "$admin_id" ]; then
                print_info "ID администратора: ${CYAN}${admin_id}${NC}"
            fi
            
            ADMIN_CONFIGURED=true
            return 0
        else
            print_error "✗ Авторизация не удалась"
            
            # Показываем детали ошибки
            if echo "$validation_result" | grep -q "FAILED"; then
                local error_msg
                error_msg=$(echo "$validation_result" | tail -n 1 | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
                
                if [ -n "$error_msg" ]; then
                    print_error "Ошибка: $error_msg"
                fi
            fi
            
            print_warning "Проверьте правильность email и пароля"
            print_info "Email должен быть валидным (например: admin@localhost)"
            print_info "Пароль должен быть минимум 8 символов"
            
            attempt=$((attempt + 1))
            
            if [ $attempt -le $max_attempts ]; then
                echo ""
                if ! confirm "Попробовать снова?" "y"; then
                    print_error "Невозможно продолжить без валидных учетных данных администратора"
                    exit 1
                fi
            else
                print_error "Превышено максимальное количество попыток ($max_attempts)"
                print_info "Убедитесь что администратор создан: ${CYAN}$POCKETBASE_URL/_/${NC}"
                exit 1
            fi
        fi
    done
}

if confirm "Вы уже создали администратора PocketBase?" "y"; then
    validate_and_input_admin_credentials
else
    print_warning "Создайте администратора перед продолжением"
    print_info "Откройте ${CYAN}$POCKETBASE_URL/_/${NC} в браузере"
    
    if confirm "Открыть URL в браузере? (требует xdg-open)" "n"; then
        xdg-open "$POCKETBASE_URL/_/" 2>/dev/null || print_warning "Не удалось открыть браузер"
    fi
    
    echo ""
    read -p "Нажмите Enter после создания администратора..."
    
    validate_and_input_admin_credentials
fi

# ============================================================================
# ШАГ 3: Настройка Redis
# ============================================================================
print_header "Шаг 3: Настройка Redis"

read_input "Хост Redis" "${REDIS_HOST:-localhost}" REDIS_HOST
read_input "Порт Redis" "${REDIS_PORT:-6379}" REDIS_PORT
read_input "База данных Redis" "0" REDIS_DB

print_info "Проверка подключения к Redis..."

if command -v redis-cli &> /dev/null; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
        print_success "Redis доступен на ${REDIS_HOST}:${REDIS_PORT}"
        REDIS_RUNNING=true
    else
        print_error "Redis не отвечает на ${REDIS_HOST}:${REDIS_PORT}"
        print_info "Запустите Redis: sudo systemctl start redis-server"
        REDIS_RUNNING=false
        
        if ! confirm "Продолжить без Redis? (не рекомендуется)" "n"; then
            exit 1
        fi
    fi
else
    print_warning "redis-cli не установлен"
    print_info "Установите Redis: sudo apt install redis-server"
    REDIS_RUNNING=false
fi

# ============================================================================
# ШАГ 4: Feature Flags
# ============================================================================
print_header "Шаг 4: Настройка функционала"

print_info "Включите нужные функции (по умолчанию все включены):"
echo ""

confirm "Включить E2EE шифрование?" "y" && E2EE_ENABLED=true || E2EE_ENABLED=false
confirm "Включить real-time обновления?" "y" && REALTIME_ENABLED=true || REALTIME_ENABLED=false
confirm "Включить загрузку файлов?" "y" && FILE_UPLOAD_ENABLED=true || FILE_UPLOAD_ENABLED=false
confirm "Включить голосовые/видео сообщения?" "y" && VOICE_VIDEO_ENABLED=true || VOICE_VIDEO_ENABLED=false
confirm "Включить режим 'Глаз Бога' (только для первого пользователя)?" "y" && GOD_MODE_ENABLED=true || GOD_MODE_ENABLED=false
confirm "Включить систему достижений?" "y" && ACHIEVEMENTS_ENABLED=true || ACHIEVEMENTS_ENABLED=false

# ============================================================================
# ШАГ 5: Генерация ключей безопасности
# ============================================================================
print_header "Шаг 5: Генерация ключей безопасности"

print_info "Генерация JWT и ключей шифрования..."

JWT_SECRET=$(generate_random)
ENCRYPTION_KEY=$(generate_random)

print_success "JWT Secret сгенерирован: ${GREEN}${JWT_SECRET:0:10}...${NC}"
print_success "Encryption Key сгенерирован: ${GREEN}${ENCRYPTION_KEY:0:10}...${NC}"

# ============================================================================
# ШАГ 6: Настройка приложения
# ============================================================================
print_header "Шаг 6: Настройка приложения"

read_input "Режим работы" "production" NODE_ENV
read_input "Порт frontend приложения" "3000" APP_PORT
read_input "Хост frontend приложения" "0.0.0.0" APP_HOST

# ============================================================================
# РЕЗЮМЕ
# ============================================================================
print_header "Резюме конфигурации"

echo -e "${BLUE}PocketBase:${NC}"
echo -e "  URL: ${CYAN}$POCKETBASE_URL${NC}"
echo -e "  Администратор: ${CYAN}$ADMIN_EMAIL${NC}"
echo ""

echo -e "${BLUE}Redis:${NC}"
echo -e "  Хост: ${CYAN}$REDIS_HOST${NC}"
echo -e "  Порт: ${CYAN}$REDIS_PORT${NC}"
echo -e "  База: ${CYAN}$REDIS_DB${NC}"
echo ""

echo -e "${BLUE}Приложение:${NC}"
echo -e "  Порт: ${CYAN}$APP_PORT${NC}"
echo -e "  Хост: ${CYAN}$APP_HOST${NC}"
echo -e "  Режим: ${CYAN}$NODE_ENV${NC}"
echo ""

echo -e "${BLUE}Функции:${NC}"
echo -e "  E2EE: $([ "$E2EE_ENABLED" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo -e "  Real-time: $([ "$REALTIME_ENABLED" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo -e "  Загрузка файлов: $([ "$FILE_UPLOAD_ENABLED" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo -e "  Голос/видео: $([ "$VOICE_VIDEO_ENABLED" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo -e "  Глаз Бога: $([ "$GOD_MODE_ENABLED" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo -e "  Достижения: $([ "$ACHIEVEMENTS_ENABLED" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo ""

if ! confirm "Продолжить установку с этими настройками?" "y"; then
    print_warning "Установка отменена"
    exit 0
fi

# ============================================================================
# УСТАНОВКА
# ============================================================================

# Создание .env для backend
print_step "Создание backend-setup/.env"

cat > "$APP_DIR/backend-setup/.env" << EOF
# ============================================
# Backend Configuration for "Конверт" Chat
# Generated: $(date)
# ============================================

# PocketBase Configuration
VITE_POCKETBASE_URL=$POCKETBASE_URL

# Redis Configuration
VITE_REDIS_HOST=$REDIS_HOST
VITE_REDIS_PORT=$REDIS_PORT
VITE_REDIS_DB=$REDIS_DB

# Admin Credentials (for setup only)
POCKETBASE_ADMIN_EMAIL=$ADMIN_EMAIL
POCKETBASE_ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

print_success "backend-setup/.env создан"

# Создание .env для frontend
print_step "Создание .env для frontend"

cat > "$APP_DIR/.env" << EOF
# ============================================
# Frontend Configuration for "Конверт" Chat
# Generated: $(date)
# ============================================

# Backend Type
VITE_BACKEND_TYPE=pocketbase

# PocketBase Configuration
VITE_POCKETBASE_URL=$POCKETBASE_URL

# Redis Configuration
VITE_REDIS_HOST=$REDIS_HOST
VITE_REDIS_PORT=$REDIS_PORT
VITE_REDIS_DB=$REDIS_DB

# Security
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Feature Flags
VITE_E2EE_ENABLED=$E2EE_ENABLED
VITE_REALTIME_ENABLED=$REALTIME_ENABLED
VITE_FILE_UPLOAD_ENABLED=$FILE_UPLOAD_ENABLED
VITE_VOICE_VIDEO_ENABLED=$VOICE_VIDEO_ENABLED
VITE_GOD_MODE_ENABLED=$GOD_MODE_ENABLED
VITE_ACHIEVEMENTS_ENABLED=$ACHIEVEMENTS_ENABLED

# Application Settings
NODE_ENV=$NODE_ENV
PORT=$APP_PORT
HOST=$APP_HOST
EOF

print_success ".env создан"

# Установка зависимостей backend
print_step "Установка зависимостей backend"

cd "$APP_DIR/backend-setup"

if confirm "Установить NPM зависимости для backend?" "y"; then
    print_info "Установка пакетов..."
    npm install --no-save pocketbase ioredis dotenv 2>&1 | grep -v "npm WARN" || true
    print_success "Зависимости backend установлены"
fi

# Создание коллекций
if [ "$POCKETBASE_RUNNING" = true ] && [ "$ADMIN_CONFIGURED" = true ]; then
    print_step "Создание коллекций PocketBase"
    
    if confirm "Создать коллекции в PocketBase сейчас?" "y"; then
        cd "$APP_DIR/backend-setup"
        
        # Используем оригинальный скрипт create-collections.js
        # который уже использует правильный endpoint для PocketBase v0.20+
        # Учетные данные берутся из .env файла
        node create-collections.js
        
        if [ $? -eq 0 ]; then
            print_success "Коллекции созданы успешно"
        else
            print_error "Ошибка при создании коллекций"
            print_info "Попробуйте запустить вручную: cd backend-setup && node create-collections.js"
        fi
    else
        print_info "Запустите позже: cd backend-setup && node create-collections.js"
    fi
else
    print_warning "Пропуск создания коллекций (PocketBase недоступен или не настроен)"
    print_info "Запустите позже: cd backend-setup && node create-collections.js"
fi

# Установка зависимостей frontend
print_step "Установка зависимостей frontend"

cd "$APP_DIR"

if confirm "Установить NPM зависимости для frontend?" "y"; then
    print_info "Установка пакетов... (это может занять несколько минут)"
    npm install
    print_success "Зависимости frontend установлены"
fi

# Создание директорий
print_step "Создание необходимых директорий"

mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/uploads"
chmod 755 "$APP_DIR/logs"
chmod 755 "$APP_DIR/uploads"

print_success "Директории созданы"

# Тестирование
if [ "$POCKETBASE_RUNNING" = true ] && [ "$REDIS_RUNNING" = true ]; then
    print_step "Тестирование подключений"
    
    if confirm "Запустить тесты подключения?" "y"; then
        cd "$APP_DIR/backend-setup"
        node test-connection.js || print_warning "Некоторые тесты не прошли"
    fi
fi

# Создание systemd сервисов (опционально)
print_step "Создание systemd сервисов"

if confirm "Создать systemd сервис для автозапуска?" "n"; then
    # PocketBase service
    if [ -n "$POCKETBASE_DIR" ]; then
        sudo tee /etc/systemd/system/konvert-pocketbase.service > /dev/null << EOF
[Unit]
Description=Konvert PocketBase Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$POCKETBASE_DIR
ExecStart=$POCKETBASE_DIR/pocketbase serve --http=${POCKETBASE_HOST}:${POCKETBASE_PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable konvert-pocketbase
        print_success "PocketBase systemd сервис создан"
    fi
    
    # Frontend service
    sudo tee /etc/systemd/system/konvert-frontend.service > /dev/null << EOF
[Unit]
Description=Konvert Chat Frontend
After=network.target konvert-pocketbase.service redis-server.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm run preview
Restart=always
RestartSec=5
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    print_success "Frontend systemd сервис создан"
    
    print_info "Для запуска сервисов:"
    echo "  sudo systemctl start konvert-pocketbase"
    echo "  sudo systemctl start konvert-frontend"
fi

# ============================================================================
# ЗАВЕРШЕНИЕ
# ============================================================================
print_header "Установка завершена! 🎉"

echo -e "${GREEN}✓${NC} Конфигурация создана"
echo -e "${GREEN}✓${NC} Зависимости установлены"
[ "$POCKETBASE_RUNNING" = true ] && echo -e "${GREEN}✓${NC} PocketBase доступен"
[ "$REDIS_RUNNING" = true ] && echo -e "${GREEN}✓${NC} Redis доступен"
echo ""

print_info "Следующие шаги:"
echo ""
echo -e "  ${CYAN}1.${NC} Запустите приложение в режиме разработки:"
echo -e "     ${BLUE}cd $APP_DIR${NC}"
echo -e "     ${BLUE}npm run dev${NC}"
echo ""
echo -e "  ${CYAN}2.${NC} Или соберите для production:"
echo -e "     ${BLUE}npm run build${NC}"
echo -e "     ${BLUE}npm run preview${NC}"
echo ""
echo -e "  ${CYAN}3.${NC} Откройте в браузере:"
echo -e "     ${BLUE}http://localhost:$APP_PORT${NC}"
echo ""

print_info "Полезные ссылки:"
echo -e "  PocketBase Admin: ${CYAN}$POCKETBASE_URL/_/${NC}"
echo -e "  PocketBase API: ${CYAN}$POCKETBASE_URL/api/${NC}"
echo ""

print_warning "ВАЖНО: Сохраните эти учетные данные в безопасном месте!"
echo ""
echo -e "  ${YELLOW}JWT_SECRET${NC}=${JWT_SECRET}"
echo -e "  ${YELLOW}ENCRYPTION_KEY${NC}=${ENCRYPTION_KEY}"
echo -e "  ${YELLOW}PocketBase Admin${NC}=${ADMIN_EMAIL}"
echo ""

print_success "Готово! Приятного использования чата Конверт! 🚀"