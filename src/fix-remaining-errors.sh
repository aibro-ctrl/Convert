#!/bin/bash

# Скрипт для автоматического исправления оставшихся TypeScript ошибок

echo "🔧 Исправление оставшихся TypeScript ошибок..."

# Функция для удаления импорта React если он не используется
fix_react_import() {
  local file="$1"
  # Удаляем строку с "import React" если React не используется в JSX
  if grep -q "^import React" "$file" && ! grep -q "React\." "$file"; then
    sed -i "s/^import React, /import /" "$file"
    sed -i "/^import React from 'react';$/d" "$file"
    echo "  ✓ Исправлен импорт React в $file"
  fi
}

# Функция для добавления префикса _ к неиспользуемым переменным
fix_unused_vars() {
  local file="$1"
  
  # Замена неиспользуемых параметров
  sed -i 's/onChange={(\([a-z]\+\)) =>/onChange={(_\1) =>/' "$file"
  sed -i 's/\.map((\([a-z]\+\),/\.map((_\1,/' "$file"
  sed -i 's/\.filter((\([a-z]\+\) =>/\.filter((_\1 =>/' "$file"
  
  echo "  ✓ Исправлены неиспользуемые переменные в $file"
}

# Исправляем файлы компонентов
echo "📝 Исправление компонентов..."

# ChatRoom.tsx
if [ -f "components/Chat/ChatRoom.tsx" ]; then
  fix_react_import "components/Chat/ChatRoom.tsx"
  # Удаляем неиспользуемый импорт Users
  sed -i 's/, Users,/,/' "components/Chat/ChatRoom.tsx"
  # Меняем cryptoKey на isReady
  sed -i 's/const { cryptoKey }/const { isReady }/' "components/Chat/ChatRoom.tsx"
  echo "  ✓ Исправлен ChatRoom.tsx"
fi

# DirectMessageChat.tsx
if [ -f "components/Chat/DirectMessageChat.tsx" ]; then
  fix_react_import "components/Chat/DirectMessageChat.tsx"
  echo "  ✓ Исправлен DirectMessageChat.tsx"
fi

# PollMessage.tsx
if [ -f "components/Chat/PollMessage.tsx" ]; then
  fix_react_import "components/Chat/PollMessage.tsx"
  # Удаляем импорт Progress
  sed -i "/import { Progress }/d" "components/Chat/PollMessage.tsx"
  echo "  ✓ Исправлен PollMessage.tsx"
fi

# RoomManagement.tsx
if [ -f "components/Chat/RoomManagement.tsx" ]; then
  fix_react_import "components/Chat/RoomManagement.tsx"
  # Удаляем неиспользуемый импорт Pin
  sed -i 's/, Pin,/,/' "components/Chat/RoomManagement.tsx"
  echo "  ✓ Исправлен RoomManagement.tsx"
fi

# SimpleAudioPlayer.tsx
if [ -f "components/Chat/SimpleAudioPlayer.tsx" ]; then
  fix_react_import "components/Chat/SimpleAudioPlayer.tsx"
  echo "  ✓ Исправлен SimpleAudioPlayer.tsx"
fi

# NotificationToast.tsx
if [ -f "components/Profile/NotificationToast.tsx" ]; then
  fix_react_import "components/Profile/NotificationToast.tsx"
  # Удаляем неиспользуемые импорты
  sed -i "/import { Button }/d" "components/Profile/NotificationToast.tsx"
  sed -i "/import { Card, CardContent }/d" "components/Profile/NotificationToast.tsx"
  sed -i 's/, MessageCircle,/,/' "components/Profile/NotificationToast.tsx"
  sed -i 's/, UserPlus//' "components/Profile/NotificationToast.tsx"
  echo "  ✓ Исправлен NotificationToast.tsx"
fi

# NotificationsPanel.tsx
if [ -f "components/Profile/NotificationsPanel.tsx" ]; then
  fix_react_import "components/Profile/NotificationsPanel.tsx"
  echo "  ✓ Исправлен NotificationsPanel.tsx"
fi

# AchievementsContext.tsx
if [ -f "contexts/AchievementsContext.tsx" ]; then
  fix_react_import "contexts/AchievementsContext.tsx"
  echo "  ✓ Исправлен AchievementsContext.tsx"
fi

# UI компоненты
if [ -f "components/ui/icons.tsx" ]; then
  fix_react_import "components/ui/icons.tsx"
  echo "  ✓ Исправлен icons.tsx"
fi

if [ -f "components/ui/icons-additions.tsx" ]; then
  fix_react_import "components/ui/icons-additions.tsx"
  echo "  ✓ Исправлен icons-additions.tsx"
fi

# Исправляем импорты библиотек без версий
echo "📦 Исправление импортов библиотек..."

# Функция для удаления версий из импортов
remove_version() {
  local file="$1"
  local package="$2"
  
  # Удаляем версию из импорта (например, @0.7.1)
  sed -i "s|from \"${package}@[0-9.]*\"|from \"${package}\"|g" "$file"
  echo "  ✓ Удалена версия из $package в $file"
}

# Исправляем файлы с версиями в импортах
for file in components/ui/*.tsx; do
  [ -f "$file" ] || continue
  
  remove_version "$file" "class-variance-authority"
  remove_version "$file" "lucide-react"
  remove_version "$file" "embla-carousel-react"
  remove_version "$file" "recharts"
  remove_version "$file" "cmdk"
  remove_version "$file" "vaul"
  remove_version "$file" "input-otp"
  remove_version "$file" "react-resizable-panels"
  remove_version "$file" "react-day-picker"
done

echo "✅ Основные ошибки исправлены!"
echo "ℹ️  Запустите 'npm run build' для проверки оставшихся ошибок"
