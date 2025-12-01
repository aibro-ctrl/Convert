#!/bin/bash

# Скрипт автоматического обновления фронтенд приложения Конверт из GitHub
# Использование: ./update.sh [--force] [--no-build] [--dry-run]

set -e  # Остановка при ошибках

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
GITHUB_REPO="https://github.com/aibro-ctrl/Convert.git"
GITHUB_BRANCH="main"
APP_DIR="/var/www/Convert/src"
TMP_DIR="/tmp/convert-update-$(date +%s)"
BACKUP_DIR="$APP_DIR/backups/update-$(date +%Y%m%d-%H%M%S)"

# Файлы и директории, которые НЕ нужно обновлять (локальные конфигурации)
EXCLUDE_PATTERNS=(
    "backend-setup"
    "backend-adapter"
    "node_modules"
    "dist"
    ".env"
    ".env.local"
    ".env.production"
    "backups"
    "pocketbase"
    "pb_data"
    "update.sh"
)

# Файлы, которые нужно обязательно сохранить
PRESERVE_FILES=(
    ".env"
    ".env.local"
    ".env.production"
)

# Флаги
FORCE_UPDATE=false
NO_BUILD=false
DRY_RUN=false

# Парсинг аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_UPDATE=true
            shift
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "Использование: ./update.sh [опции]"
            echo ""
            echo "Опции:"
            echo "  --force      Принудительное обновление без проверки изменений"
            echo "  --no-build   Пропустить сборку после обновления"
            echo "  --dry-run    Показать что будет обновлено, без реального обновления"
            echo "  -h, --help   Показать эту справку"
            exit 0
            ;;
        *)
            echo -e "${RED}Неизвестная опция: $1${NC}"
            exit 1
            ;;
    esac
done

# Функция для логирования
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Функция очистки
cleanup() {
    if [ -d "$TMP_DIR" ]; then
        log_info "Очистка временных файлов..."
        rm -rf "$TMP_DIR"
    fi
}

# Установка обработчика для очистки при выходе
trap cleanup EXIT

# Проверка наличия git
if ! command -v git &> /dev/null; then
    log_error "Git не установлен. Установите git и повторите попытку."
    exit 1
fi

# Проверка наличия директории приложения
if [ ! -d "$APP_DIR" ]; then
    log_error "Директория приложения не найдена: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

log_info "╔════════════════════════════════════════════════════════╗"
log_info "║   Обновление фронтенд приложения Конверт из GitHub    ║"
log_info "╚════════════════════════════════════════════════════════╝"
echo ""
log_info "Репозиторий: $GITHUB_REPO"
log_info "Ветка: $GITHUB_BRANCH"
log_info "Директория: $APP_DIR"
echo ""

# Проверка изменений в репозитории
log_info "Проверка доступности репозитория..."
if ! git ls-remote "$GITHUB_REPO" &> /dev/null; then
    log_error "Не удалось подключиться к репозиторию: $GITHUB_REPO"
    exit 1
fi

# Клонирование репозитория во временную директорию
log_info "Клонирование репозитория во временную директорию..."
git clone --depth 1 --branch "$GITHUB_BRANCH" "$GITHUB_REPO" "$TMP_DIR" > /dev/null 2>&1

if [ ! -d "$TMP_DIR" ]; then
    log_error "Не удалось клонировать репозиторий"
    exit 1
fi

# Получение хеша последнего коммита
REMOTE_COMMIT=$(cd "$TMP_DIR" && git rev-parse HEAD)
log_info "Последний коммит в GitHub: ${REMOTE_COMMIT:0:7}"

# Проверка наличия .git в текущей директории
if [ -d ".git" ]; then
    LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    log_info "Текущий коммит: ${LOCAL_COMMIT:0:7}"
    
    if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ] && [ "$FORCE_UPDATE" = false ]; then
        log_success "Приложение уже обновлено до последней версии!"
        exit 0
    fi
else
    log_warning "Директория не является git репозиторием. Инициализация..."
    git init > /dev/null
    git remote add origin "$GITHUB_REPO" 2>/dev/null || git remote set-url origin "$GITHUB_REPO"
fi

# Создание бэкапа важных файлов
log_info "Создание бэкапа текущих файлов..."
mkdir -p "$BACKUP_DIR"

for file in "${PRESERVE_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/"
        log_info "  ✓ Сохранен: $file"
    fi
done

# Подсчет изменений (dry-run)
log_info "Анализ изменений..."
CHANGED_FILES=0
NEW_FILES=0
DELETED_FILES=0

# Функция для проверки, нужно ли исключить файл
should_exclude() {
    local file="$1"
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        if [[ "$file" == *"$pattern"* ]]; then
            return 0
        fi
    done
    return 1
}

# Подсчет изменений
while IFS= read -r -d '' file; do
    rel_path="${file#$TMP_DIR/}"
    
    if should_exclude "$rel_path"; then
        continue
    fi
    
    if [ ! -f "$APP_DIR/$rel_path" ]; then
        ((NEW_FILES++))
    elif ! cmp -s "$file" "$APP_DIR/$rel_path"; then
        ((CHANGED_FILES++))
    fi
done < <(find "$TMP_DIR" -type f -print0)

# Проверка удаленных файлов
while IFS= read -r -d '' file; do
    rel_path="${file#$APP_DIR/}"
    
    if should_exclude "$rel_path"; then
        continue
    fi
    
    if [ ! -f "$TMP_DIR/$rel_path" ]; then
        ((DELETED_FILES++))
    fi
done < <(find "$APP_DIR" -type f -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/backend-*/*" -not -path "*/.git/*" -print0)

echo ""
log_info "Найдено изменений:"
echo "  • Новых файлов: $NEW_FILES"
echo "  • Измененных файлов: $CHANGED_FILES"
echo "  • Удаленных файлов: $DELETED_FILES"
echo ""

if [ $NEW_FILES -eq 0 ] && [ $CHANGED_FILES -eq 0 ] && [ $DELETED_FILES -eq 0 ]; then
    log_success "Нет изменений для обновления!"
    exit 0
fi

if [ "$DRY_RUN" = true ]; then
    log_info "Режим --dry-run: обновление не будет выполнено"
    exit 0
fi

# Подтверждение обновления
if [ "$FORCE_UPDATE" = false ]; then
    echo -ne "${YELLOW}Продолжить обновление? (y/n): ${NC}"
    read -r confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log_warning "Обновление отменено пользователем"
        exit 0
    fi
fi

# Копирование файлов
log_info "Копирование обновленных файлов..."
rsync -av --delete \
    $(for pattern in "${EXCLUDE_PATTERNS[@]}"; do echo "--exclude=$pattern"; done) \
    "$TMP_DIR/" "$APP_DIR/" > /dev/null

log_success "Файлы успешно скопированы"

# Восстановление сохраненных файлов
log_info "Восстановление локальных конфигураций..."
for file in "${PRESERVE_FILES[@]}"; do
    if [ -f "$BACKUP_DIR/$file" ]; then
        cp "$BACKUP_DIR/$file" "$APP_DIR/$file"
        log_info "  ✓ Восстановлен: $file"
    fi
done

# Обновление git репозитория
log_info "Обновление git метаданных..."
git fetch origin "$GITHUB_BRANCH" > /dev/null 2>&1
git reset --hard "origin/$GITHUB_BRANCH" > /dev/null 2>&1

# Проверка package.json изменений
if [ -f "$BACKUP_DIR/package.json" ]; then
    if ! cmp -s "$BACKUP_DIR/../package.json" "package.json"; then
        log_warning "Обнаружены изменения в package.json"
        NEED_INSTALL=true
    else
        NEED_INSTALL=false
    fi
else
    NEED_INSTALL=true
fi

# Установка зависимостей
if [ "$NEED_INSTALL" = true ]; then
    log_info "Установка/обновление зависимостей..."
    npm install
    log_success "Зависимости обновлены"
else
    log_info "Зависимости не изменились, пропуск установки"
fi

# Сборка приложения
if [ "$NO_BUILD" = false ]; then
    log_info "Сборка приложения..."
    npm run build
    log_success "Приложение успешно собрано"
else
    log_warning "Сборка пропущена (флаг --no-build)"
fi

# Сохранение информации об обновлении
cat > "$APP_DIR/update-info.txt" << EOF
Последнее обновление: $(date '+%Y-%m-%d %H:%M:%S')
Коммит: $REMOTE_COMMIT
Репозиторий: $GITHUB_REPO
Ветка: $GITHUB_BRANCH
Новых файлов: $NEW_FILES
Измененных файлов: $CHANGED_FILES
Удаленных файлов: $DELETED_FILES
EOF

echo ""
log_success "╔════════════════════════════════════════════════════════╗"
log_success "║        Обновление успешно завершено!                  ║"
log_success "╚════════════════════════════════════════════════════════╝"
echo ""
log_info "Информация об обновлении сохранена в update-info.txt"
log_info "Бэкап сохранен в: $BACKUP_DIR"
echo ""

if [ "$NO_BUILD" = false ]; then
    log_info "Для применения изменений перезапустите веб-сервер (nginx/apache)"
    log_info "Или используйте: npm run preview (для тестирования)"
fi
