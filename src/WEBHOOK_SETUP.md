# 🔗 Настройка автоматического обновления через GitHub Webhook

## Обзор

GitHub Webhook позволяет автоматически обновлять приложение на сервере при каждом push в репозиторий. Это исключает необходимость вручную запускать `update.sh`.

## Архитектура

```
GitHub (push) → Webhook → Сервер (webhook-server.js) → update.sh → Обновление приложения
```

---

## 🚀 Метод 1: Простой (без webhook сервера)

### Используйте cron для периодического обновления

```bash
# Редактируйте crontab
crontab -e

# Добавьте (обновление каждые 5 минут)
*/5 * * * * cd /var/www/Convert/src && ./update.sh --force >> /var/log/convert-auto-update.log 2>&1
```

**Плюсы:** Простота, не требует дополнительных сервисов  
**Минусы:** Задержка до 5 минут, лишние проверки

---

## 🎯 Метод 2: Webhook сервер (рекомендуется)

### Шаг 1: Установка зависимостей

```bash
cd /var/www/Convert/src

# Установите express (если еще не установлен)
npm install express
```

### Шаг 2: Генерация секретного ключа

```bash
# Сгенерируйте случайный secret
openssl rand -hex 32

# Сохраните его - понадобится для GitHub и сервера
# Пример: a7f3d8e9c2b1f4e6a8d9c7b2e1f9a8c6d5e4f3b2a1c0d9e8f7a6b5c4d3e2f1a0
```

### Шаг 3: Настройка webhook сервера

```bash
# Отредактируйте webhook-server.service
sudo nano /var/www/Convert/src/webhook-server.service

# Замените WEBHOOK_SECRET на ваш секрет
Environment="WEBHOOK_SECRET=a7f3d8e9c2b1f4e6a8d9c7b2e1f9a8c6d5e4f3b2a1c0d9e8f7a6b5c4d3e2f1a0"
```

### Шаг 4: Установка systemd сервиса

```bash
# Скопируйте service файл
sudo cp /var/www/Convert/src/webhook-server.service /etc/systemd/system/

# Сделайте скрипты исполняемыми
chmod +x /var/www/Convert/src/webhook-server.js
chmod +x /var/www/Convert/src/webhook-update.sh

# Создайте лог файлы
sudo touch /var/log/convert-webhook.log
sudo touch /var/log/convert-webhook-error.log
sudo chown www-data:www-data /var/log/convert-webhook*.log

# Перезагрузите systemd
sudo systemctl daemon-reload

# Запустите сервис
sudo systemctl start convert-webhook

# Включите автозапуск
sudo systemctl enable convert-webhook

# Проверьте статус
sudo systemctl status convert-webhook
```

### Шаг 5: Настройка Nginx (reverse proxy)

```bash
sudo nano /etc/nginx/sites-available/convert-webhook
```

Добавьте:
```nginx
server {
    listen 80;
    server_name webhook.your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Активируйте конфигурацию
sudo ln -s /etc/nginx/sites-available/convert-webhook /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезагрузите nginx
sudo systemctl reload nginx
```

### Шаг 6: Настройка SSL (рекомендуется)

```bash
# Установите certbot если еще не установлен
sudo apt install certbot python3-certbot-nginx

# Получите SSL сертификат
sudo certbot --nginx -d webhook.your-domain.com

# Certbot автоматически настроит HTTPS
```

### Шаг 7: Настройка firewall

```bash
# Откройте порт для webhook (через nginx - 80/443)
sudo ufw allow 'Nginx Full'

# Проверьте статус
sudo ufw status
```

### Шаг 8: Тестирование

```bash
# Проверьте health endpoint
curl http://localhost:9000/health

# Или через nginx
curl https://webhook.your-domain.com/health

# Должен вернуть:
# {"status":"ok","timestamp":"...","uptime":...}
```

### Шаг 9: Настройка GitHub Webhook

1. Откройте репозиторий на GitHub: https://github.com/aibro-ctrl/Convert
2. Перейдите в **Settings** → **Webhooks** → **Add webhook**
3. Заполните форму:

   - **Payload URL:** `https://webhook.your-domain.com/webhook`
   - **Content type:** `application/json`
   - **Secret:** Ваш сгенерированный секрет из Шага 2
   - **Which events:** Выберите "Just the push event"
   - **Active:** ✅ Включено

4. Нажмите **Add webhook**

### Шаг 10: Тестирование автообновления

```bash
# Следите за логами
sudo tail -f /var/log/convert-webhook.log

# В другом терминале следите за логами обновления
tail -f /var/log/convert-webhook-update.log
```

Теперь сделайте push в репозиторий:
```bash
# На вашем компьютере
echo "test" >> README.md
git add README.md
git commit -m "Test webhook"
git push origin main
```

Вы должны увидеть в логах:
1. Получение webhook от GitHub
2. Запуск обновления
3. Успешное завершение

---

## 🔍 Мониторинг

### Проверка статуса сервиса
```bash
sudo systemctl status convert-webhook
```

### Просмотр логов
```bash
# Логи webhook сервера
sudo tail -f /var/log/convert-webhook.log

# Логи обновлений
sudo tail -f /var/log/convert-webhook-update.log

# Системные логи сервиса
sudo journalctl -u convert-webhook -f
```

### Проверка последнего обновления
```bash
cat /var/www/Convert/src/update-info.txt
```

---

## 🛠️ Управление сервисом

```bash
# Запуск
sudo systemctl start convert-webhook

# Остановка
sudo systemctl stop convert-webhook

# Перезапуск
sudo systemctl restart convert-webhook

# Перезагрузка конфигурации
sudo systemctl reload convert-webhook

# Включить автозапуск
sudo systemctl enable convert-webhook

# Отключить автозапуск
sudo systemctl disable convert-webhook
```

---

## 🐛 Устранение проблем

### Webhook не срабатывает

1. **Проверьте логи GitHub:**
   - Settings → Webhooks → Recent Deliveries
   - Проверьте Response (должен быть 200 OK)

2. **Проверьте сервис:**
   ```bash
   sudo systemctl status convert-webhook
   ```

3. **Проверьте секрет:**
   ```bash
   # Проверьте что секрет совпадает в:
   # - /etc/systemd/system/convert-webhook.service
   # - GitHub webhook settings
   ```

4. **Проверьте firewall:**
   ```bash
   sudo ufw status
   # Должен быть открыт Nginx Full
   ```

### Ошибка 401 (Invalid signature)

```bash
# Секрет не совпадает - проверьте:
sudo nano /etc/systemd/system/convert-webhook.service

# После изменения:
sudo systemctl daemon-reload
sudo systemctl restart convert-webhook
```

### Webhook получен, но обновление не происходит

```bash
# Проверьте права доступа
ls -la /var/www/Convert/src/webhook-update.sh

# Должен быть исполняемым
chmod +x /var/www/Convert/src/webhook-update.sh

# Проверьте логи обновления
tail -f /var/log/convert-webhook-update.log
```

### Ошибка при перезагрузке nginx

```bash
# Убедитесь что у www-data есть права на sudo для nginx
sudo visudo

# Добавьте:
www-data ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
```

---

## 🔒 Безопасность

### Рекомендации

1. ✅ **Всегда используйте HTTPS** для webhook URL
2. ✅ **Используйте сильный секрет** (минимум 32 символа)
3. ✅ **Ограничьте доступ** к webhook endpoint через firewall
4. ✅ **Мониторьте логи** на подозрительную активность
5. ✅ **Регулярно обновляйте** секрет webhook

### Ограничение доступа по IP (опционально)

Если знаете IP GitHub серверов, можно ограничить доступ:

```nginx
location /webhook {
    # Разрешить только IP GitHub
    # https://api.github.com/meta (webhooks IP ranges)
    allow 140.82.112.0/20;
    allow 185.199.108.0/22;
    deny all;
    
    proxy_pass http://127.0.0.1:9000;
}
```

---

## 📊 Альтернативы

### Использование GitHub Actions + SSH

Вместо webhook можно использовать GitHub Actions:

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Server

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/Convert/src
            ./update.sh --force
```

---

## 📚 Дополнительные ресурсы

- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [EXPRESS.js Documentation](https://expressjs.com/)
- [Systemd Service Documentation](https://www.freedesktop.org/software/systemd/man/systemd.service.html)

---

**🎉 Готово!** Теперь ваше приложение будет автоматически обновляться при каждом push в GitHub!
