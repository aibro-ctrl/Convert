#!/usr/bin/env node

/**
 * Скрипт валидации учетных данных администратора PocketBase
 * Использование: node validate-admin.js <email> <password> <url>
 */

const PocketBase = require('pocketbase').default || require('pocketbase');

async function validateAdmin(email, password, url) {
  const pb = new PocketBase(url);

  try {
    // Попытка авторизации с использованием нового endpoint
    const authData = await pb.collection('_superusers').authWithPassword(email, password);
    
    // Если авторизация успешна
    console.log('SUCCESS');
    console.log(JSON.stringify({
      id: authData.record.id,
      email: authData.record.email,
      created: authData.record.created
    }));
    process.exit(0);
  } catch (error) {
    // Авторизация не удалась
    console.log('FAILED');
    console.log(JSON.stringify({
      status: error.status,
      message: error.message,
      data: error.data
    }));
    process.exit(1);
  }
}

// Получаем аргументы командной строки
const email = process.argv[2];
const password = process.argv[3];
const url = process.argv[4] || 'http://127.0.0.1:54739';

if (!email || !password) {
  console.error('ERROR: Missing arguments');
  console.error('Usage: node validate-admin.js <email> <password> [url]');
  process.exit(2);
}

// Запускаем валидацию
validateAdmin(email, password, url).catch(error => {
  console.log('ERROR');
  console.log(JSON.stringify({
    message: error.message || 'Unknown error'
  }));
  process.exit(3);
});
