#!/usr/bin/env node

/**
 * Быстрый тест импорта модулей
 */

console.log('🧪 Тестирование импорта модулей...\n');

try {
  console.log('1. Проверка PocketBase...');
  const PocketBase = require('pocketbase').default || require('pocketbase');
  console.log('   ✓ PocketBase импортирован:', typeof PocketBase);
  
  if (typeof PocketBase !== 'function') {
    throw new Error('PocketBase должен быть функцией-конструктором!');
  }
  
  console.log('   ✓ PocketBase это конструктор\n');
} catch (error) {
  console.error('   ✗ Ошибка импорта PocketBase:', error.message);
  console.error('   Установите: npm install pocketbase\n');
  process.exit(1);
}

try {
  console.log('2. Проверка ioredis...');
  const Redis = require('ioredis');
  console.log('   ✓ Redis импортирован:', typeof Redis);
  
  if (typeof Redis !== 'function') {
    throw new Error('Redis должен быть функцией-конструктором!');
  }
  
  console.log('   ✓ Redis это конструктор\n');
} catch (error) {
  console.error('   ✗ Ошибка импорта ioredis:', error.message);
  console.error('   Установите: npm install ioredis\n');
  process.exit(1);
}

try {
  console.log('3. Проверка dotenv...');
  const dotenv = require('dotenv');
  console.log('   ✓ dotenv импортирован:', typeof dotenv);
  console.log('   ✓ dotenv это объект\n');
} catch (error) {
  console.error('   ✗ Ошибка импорта dotenv:', error.message);
  console.error('   Установите: npm install dotenv\n');
  process.exit(1);
}

console.log('✅ Все модули импортированы корректно!');
console.log('✅ Можно запускать create-collections.js и test-connection.js\n');
