#!/bin/bash

# Webhook handler для автоматического обновления при push в GitHub
# Этот скрипт вызывается через webhook сервис

set -e

# Конфигурация
APP_DIR="/var/www/Convert/src"
LOG_FILE="/var/log/convert-webhook-update.log"
LOCK_FILE="/tmp/convert-update.lock"

# Функция логирования
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Проверка lock файла (предотвращение одновременных обновлений)
if [ -f "$LOCK_FILE" ]; then
    log "ERROR: Обновление уже выполняется (найден lock файл)"
    exit 1
fi

# Создание lock файла
touch "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

log "=========================================="
log "Запуск автоматического обновления по webhook"
log "=========================================="

# Переход в директорию приложения
cd "$APP_DIR" || {
    log "ERROR: Не удалось перейти в директорию $APP_DIR"
    exit 1
}

# Запуск обновления
log "Выполнение update.sh --force..."
if ./update.sh --force >> "$LOG_FILE" 2>&1; then
    log "SUCCESS: Обновление завершено успешно"
    
    # Перезагрузка веб-сервера
    log "Перезагрузка nginx..."
    if sudo systemctl reload nginx >> "$LOG_FILE" 2>&1; then
        log "SUCCESS: Nginx перезагружен"
    else
        log "WARNING: Не удалось перезагрузить nginx"
    fi
    
    exit 0
else
    log "ERROR: Обновление завершилось с ошибкой"
    exit 1
fi
