#!/bin/bash

# Скрипт для инициализации git репозитория в существующем проекте
# Использование: ./init-git.sh

set -e

# Цвета
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Инициализация Git репозитория для приложения Конверт║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка наличия git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Git не установлен. Установка...${NC}"
    sudo apt update
    sudo apt install -y git
fi

# Проверка, не является ли уже git репозиторием
if [ -d ".git" ]; then
    echo -e "${GREEN}Директория уже является git репозиторием${NC}"
    echo -e "${BLUE}Текущий remote:${NC}"
    git remote -v
    echo ""
    echo -ne "${YELLOW}Переинициализировать? (y/n): ${NC}"
    read -r confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Отменено пользователем"
        exit 0
    fi
    rm -rf .git
fi

# Инициализация репозитория
echo -e "${BLUE}Инициализация git репозитория...${NC}"
git init

# Настройка remote
echo -e "${BLUE}Добавление remote репозитория...${NC}"
git remote add origin https://github.com/aibro-ctrl/Convert.git

# Настройка пользователя (если нужно)
if [ -z "$(git config user.name)" ]; then
    echo -ne "${YELLOW}Введите ваше имя для Git: ${NC}"
    read -r git_name
    git config user.name "$git_name"
fi

if [ -z "$(git config user.email)" ]; then
    echo -ne "${YELLOW}Введите ваш email для Git: ${NC}"
    read -r git_email
    git config user.email "$git_email"
fi

# Создание первого коммита (если файлы еще не закоммичены)
echo -e "${BLUE}Проверка статуса файлов...${NC}"
git add .gitignore update.sh init-git.sh UPDATE_GUIDE.md 2>/dev/null || true

if git diff --staged --quiet; then
    echo -e "${GREEN}Нет изменений для коммита${NC}"
else
    echo -e "${BLUE}Создание начального коммита...${NC}"
    git commit -m "Initial commit: Add update scripts and documentation"
fi

# Получение последней версии из GitHub
echo -e "${BLUE}Получение последней версии из GitHub...${NC}"
git fetch origin main

# Проверка, есть ли конфликты
echo -e "${BLUE}Синхронизация с GitHub...${NC}"
git branch -M main
git reset --hard origin/main

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Git репозиторий успешно настроен!             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Теперь вы можете использовать:${NC}"
echo "  • ./update.sh           - для обновления приложения"
echo "  • ./update.sh --dry-run - для проверки изменений"
echo "  • git status            - для проверки статуса"
echo "  • git log               - для просмотра истории"
echo ""
echo -e "${YELLOW}Важно:${NC} Файлы .env и backend-setup/ не отслеживаются git"
echo ""
