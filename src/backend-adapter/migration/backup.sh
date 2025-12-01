#!/bin/bash

###############################################################################
# Скрипт резервного копирования для чата "Конверт"
# Создает бэкапы PocketBase и Redis данных
###############################################################################

set -e

# Конфигурация
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Создание директории бэкапов
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting backup: $DATE"

# Проверка Docker
if ! docker ps | grep konvert_pocketbase > /dev/null 2>&1; then
    print_error "PocketBase container not running!"
    exit 1
fi

# Backup PocketBase
echo "📦 Backing up PocketBase..."
if tar -czf "$BACKUP_DIR/pocketbase_$DATE.tar.gz" -C "$PROJECT_DIR" pb_data 2>/dev/null; then
    print_success "PocketBase backup created"
    SIZE=$(du -h "$BACKUP_DIR/pocketbase_$DATE.tar.gz" | cut -f1)
    echo "   Size: $SIZE"
else
    print_error "PocketBase backup failed!"
fi

# Backup Redis
echo "📦 Backing up Redis..."
if docker exec konvert_redis redis-cli SAVE > /dev/null 2>&1; then
    # Копируем RDB файл
    docker cp konvert_redis:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb" 2>/dev/null
    if [ $? -eq 0 ]; then
        print_success "Redis backup created"
        SIZE=$(du -h "$BACKUP_DIR/redis_$DATE.rdb" | cut -f1)
        echo "   Size: $SIZE"
    else
        print_warning "Redis backup file not found, skipping"
    fi
else
    print_error "Redis backup failed!"
fi

# Backup конфигурации
echo "📦 Backing up configuration..."
if tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    -C "$PROJECT_DIR" \
    .env docker-compose.yml nginx.conf 2>/dev/null; then
    print_success "Configuration backup created"
else
    print_warning "Configuration backup failed (some files may be missing)"
fi

# Создание манифеста
echo "📝 Creating backup manifest..."
cat > "$BACKUP_DIR/manifest_$DATE.json" << EOF
{
  "date": "$DATE",
  "timestamp": "$(date -Iseconds)",
  "files": {
    "pocketbase": "pocketbase_$DATE.tar.gz",
    "redis": "redis_$DATE.rdb",
    "config": "config_$DATE.tar.gz"
  },
  "sizes": {
    "pocketbase": "$(du -h "$BACKUP_DIR/pocketbase_$DATE.tar.gz" 2>/dev/null | cut -f1)",
    "redis": "$(du -h "$BACKUP_DIR/redis_$DATE.rdb" 2>/dev/null | cut -f1)",
    "config": "$(du -h "$BACKUP_DIR/config_$DATE.tar.gz" 2>/dev/null | cut -f1)"
  }
}
EOF
print_success "Manifest created"

# Удаление старых бэкапов
echo "🗑️  Cleaning old backups (>$RETENTION_DAYS days)..."
DELETED=$(find "$BACKUP_DIR" -name "*.tar.gz" -o -name "*.rdb" -o -name "manifest_*.json" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    print_success "Deleted $DELETED old files"
else
    echo "   No old files to delete"
fi

# Статистика
echo ""
echo "📊 Backup statistics:"
echo "   Location: $BACKUP_DIR"
echo "   Total size: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "   Files count: $(ls -1 "$BACKUP_DIR" | wc -l)"
echo ""

print_success "Backup completed: $DATE"

# Опционально: загрузка в облако
if [ -n "$S3_BUCKET" ]; then
    echo "☁️  Uploading to S3..."
    if command -v aws &> /dev/null; then
        aws s3 cp "$BACKUP_DIR/pocketbase_$DATE.tar.gz" "s3://$S3_BUCKET/backups/" 2>/dev/null && \
        print_success "Uploaded to S3"
    else
        print_warning "AWS CLI not found, skipping S3 upload"
    fi
fi

exit 0
