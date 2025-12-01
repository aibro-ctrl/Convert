#!/usr/bin/env node

/**
 * Простой webhook сервер для автоматического обновления при push в GitHub
 * 
 * Установка:
 * 1. npm install express
 * 2. Создайте secret в GitHub webhook settings
 * 3. Добавьте secret в переменные окружения: WEBHOOK_SECRET=your-secret
 * 4. Запустите: node webhook-server.js
 * 
 * Или используйте systemd для автозапуска (см. webhook-server.service)
 */

const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Конфигурация
const PORT = process.env.WEBHOOK_PORT || 9000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const UPDATE_SCRIPT = path.join(__dirname, 'webhook-update.sh');
const LOG_FILE = '/var/log/convert-webhook.log';

// Проверка конфигурации
if (!WEBHOOK_SECRET) {
    console.error('ERROR: WEBHOOK_SECRET не установлен!');
    console.error('Установите переменную окружения: export WEBHOOK_SECRET=your-secret');
    process.exit(1);
}

const app = express();
app.use(express.json());

// Функция логирования
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    console.log(logMessage.trim());
    fs.appendFileSync(LOG_FILE, logMessage);
}

// Проверка подписи GitHub
function verifySignature(payload, signature) {
    if (!signature) {
        return false;
    }
    
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    
    log(`Получен webhook: event=${event}, signature=${signature ? 'present' : 'missing'}`);
    
    // Проверка подписи
    if (!verifySignature(req.body, signature)) {
        log('ERROR: Неверная подпись webhook');
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Обработка только push событий
    if (event !== 'push') {
        log(`INFO: Игнорируем событие ${event}`);
        return res.json({ message: `Event ${event} ignored` });
    }
    
    // Проверка ветки
    const branch = req.body.ref?.split('/').pop();
    if (branch !== 'main') {
        log(`INFO: Игнорируем push в ветку ${branch}`);
        return res.json({ message: `Branch ${branch} ignored` });
    }
    
    const pusher = req.body.pusher?.name || 'unknown';
    const commits = req.body.commits?.length || 0;
    
    log(`Push от ${pusher}: ${commits} коммитов в ветку ${branch}`);
    
    // Отправляем ответ сразу
    res.json({ 
        message: 'Webhook received, update started',
        pusher,
        commits,
        branch
    });
    
    // Запускаем обновление асинхронно
    log('Запуск скрипта обновления...');
    
    exec(`bash ${UPDATE_SCRIPT}`, (error, stdout, stderr) => {
        if (error) {
            log(`ERROR: Ошибка обновления: ${error.message}`);
            log(`STDERR: ${stderr}`);
            return;
        }
        
        log('SUCCESS: Обновление выполнено успешно');
        if (stdout) {
            log(`STDOUT: ${stdout}`);
        }
    });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    log(`ERROR: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    log(`╔════════════════════════════════════════════════════════╗`);
    log(`║  Webhook сервер запущен на порту ${PORT}               ║`);
    log(`╚════════════════════════════════════════════════════════╝`);
    log(`Endpoints:`);
    log(`  • POST http://localhost:${PORT}/webhook - GitHub webhook`);
    log(`  • GET  http://localhost:${PORT}/health  - Health check`);
    log('');
    log('Ожидание webhook событий от GitHub...');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('Получен сигнал SIGTERM, завершение...');
    process.exit(0);
});

process.on('SIGINT', () => {
    log('Получен сигнал SIGINT, завершение...');
    process.exit(0);
});
