#!/bin/bash

# Скрипт для исправления TypeScript ошибок в проекте Конверт

echo "🔧 Исправление TypeScript ошибок..."

# 1. Добавить недостающие пакеты
echo "📦 Установка недостающих пакетов..."
npm install --save \
  @radix-ui/react-accordion \
  @radix-ui/react-alert-dialog \
  @radix-ui/react-aspect-ratio \
  @radix-ui/react-collapsible \
  @radix-ui/react-context-menu \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-hover-card \
  @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu \
  @radix-ui/react-radio-group \
  @radix-ui/react-scroll-area \
  @radix-ui/react-separator \
  @radix-ui/react-slot \
  @radix-ui/react-toggle \
  @radix-ui/react-toggle-group \
  @radix-ui/react-tooltip \
  class-variance-authority \
  lucide-react \
  embla-carousel-react \
  recharts \
  cmdk \
  vaul \
  input-otp \
  react-resizable-panels \
  react-day-picker \
  react-hook-form

echo "✅ Пакеты установлены"
echo "🔨 Запуск TypeScript сборки..."
npm run build

echo "✅ Готово!"
