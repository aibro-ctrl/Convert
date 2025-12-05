#!/bin/bash
set -e

REMOTE_HOST="158.255.0.177"
REMOTE_USER="root"
REMOTE_TMP="/root/edge-deploy"
CONTAINER_NAME="supabase-edge-functions"
CONTAINER_TARGET_DIR="/home/functions"  # если у тебя другой путь – измени

LOCAL_PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_FUNCTIONS_DIR="$LOCAL_PROJECT_ROOT/src/supabase/functions/server"
ARCHIVE_NAME="edge-functions.tar.gz"

echo "==> Подготовка архива с функциями"
cd "$LOCAL_PROJECT_ROOT"
tar -czf "$ARCHIVE_NAME" -C "$LOCAL_FUNCTIONS_DIR" .

echo "==> Копирование архива на сервер $REMOTE_USER@$REMOTE_HOST (ssh спросит пароль)"
ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_TMP"
scp "$ARCHIVE_NAME" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_TMP/"

echo "==> Развёртывание архива внутри контейнера Docker"
ssh "$REMOTE_USER@$REMOTE_HOST" bash <<EOF
set -e

echo "-- Поиск контейнера $CONTAINER_NAME"
CONTAINER_ID=\$(docker ps --filter "name=$CONTAINER_NAME" --format "{{.ID}}")
if [ -z "\$CONTAINER_ID" ]; then
  echo "Контейнер $CONTAINER_NAME не найден. Проверь docker ps."
  exit 1
fi

echo "-- Копируем архив в контейнер"
docker cp "$REMOTE_TMP/$ARCHIVE_NAME" "\$CONTAINER_ID:/tmp/$ARCHIVE_NAME"

echo "-- Распаковываем код в \$CONTAINER_TARGET_DIR"
docker exec "\$CONTAINER_ID" sh -c "mkdir -p $CONTAINER_TARGET_DIR && tar -xzf /tmp/$ARCHIVE_NAME -C $CONTAINER_TARGET_DIR && rm /tmp/$ARCHIVE_NAME"

echo "-- Перезапускаем контейнер"
docker restart "\$CONTAINER_ID"

echo "-- Очистка временных файлов на сервере"
rm -f "$REMOTE_TMP/$ARCHIVE_NAME"

echo "Готово: Edge Functions задеплоены и контейнер перезапущен."
EOF

echo "==> Локальная очистка"
rm -f "$ARCHIVE_NAME"

echo "✅ Деплой завершён"