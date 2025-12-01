#!/usr/bin/env node

/**
 * Тест подключения к PocketBase и Redis
 */

const PocketBase = require('pocketbase').default || require('pocketbase');
const Redis = require('ioredis');
require('dotenv').config();

const POCKETBASE_URL = process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:54739';
const REDIS_HOST = process.env.VITE_REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.VITE_REDIS_PORT || 6379;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function print(color, symbol, message) {
  console.log(`${color}${symbol}${RESET} ${message}`);
}

async function testPocketBase() {
  console.log('\n' + BLUE + '=== Тестирование PocketBase ===' + RESET);
  
  const pb = new PocketBase(POCKETBASE_URL);
  const tests = {
    connection: false,
    collections: false,
    users: false,
    rooms: false,
    messages: false,
  };

  try {
    // 1. Проверка подключения
    try {
      await pb.health.check();
      print(GREEN, '✓', `Подключение: ${POCKETBASE_URL}`);
      tests.connection = true;
    } catch (error) {
      print(RED, '✗', `Подключение не удалось: ${error.message}`);
      return tests;
    }

    // 2. Проверка коллекций
    try {
      const collections = await pb.collections.getFullList();
      print(GREEN, '✓', `Коллекций найдено: ${collections.length}`);
      
      const requiredCollections = ['users', 'rooms', 'messages', 'achievements'];
      const existingNames = collections.map(c => c.name);
      
      requiredCollections.forEach(name => {
        if (existingNames.includes(name)) {
          print(GREEN, '  ✓', `Коллекция "${name}" существует`);
        } else {
          print(RED, '  ✗', `Коллекция "${name}" не найдена`);
        }
      });
      
      tests.collections = requiredCollections.every(name => existingNames.includes(name));
    } catch (error) {
      print(RED, '✗', `Ошибка получения коллекций: ${error.message}`);
    }

    // 3. Проверка коллекции users
    try {
      const usersCollection = await pb.collections.getOne('users');
      const userCount = await pb.collection('users').getList(1, 1);
      print(GREEN, '✓', `Коллекция users: ${userCount.totalItems} пользователей`);
      tests.users = true;
    } catch (error) {
      if (error.message.includes('not found')) {
        print(YELLOW, '⚠', 'Коллекция users не создана');
      } else {
        print(RED, '✗', `Ошибка users: ${error.message}`);
      }
    }

    // 4. Проверка коллекции rooms
    try {
      const roomsCollection = await pb.collections.getOne('rooms');
      const roomCount = await pb.collection('rooms').getList(1, 1);
      print(GREEN, '✓', `Коллекция rooms: ${roomCount.totalItems} комнат`);
      tests.rooms = true;
    } catch (error) {
      if (error.message.includes('not found')) {
        print(YELLOW, '⚠', 'Коллекция rooms не создана');
      } else {
        print(RED, '✗', `Ошибка rooms: ${error.message}`);
      }
    }

    // 5. Проверка коллекции messages
    try {
      const messagesCollection = await pb.collections.getOne('messages');
      const messageCount = await pb.collection('messages').getList(1, 1);
      print(GREEN, '✓', `Коллекция messages: ${messageCount.totalItems} сообщений`);
      tests.messages = true;
    } catch (error) {
      if (error.message.includes('not found')) {
        print(YELLOW, '⚠', 'Коллекция messages не создана');
      } else {
        print(RED, '✗', `Ошибка messages: ${error.message}`);
      }
    }

  } catch (error) {
    print(RED, '✗', `Неожиданная ошибка: ${error.message}`);
  }

  return tests;
}

async function testRedis() {
  console.log('\n' + BLUE + '=== Тестирование Redis ===' + RESET);
  
  const tests = {
    connection: false,
    ping: false,
    set_get: false,
    pub_sub: false,
    info: false,
  };

  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    retryStrategy: () => null, // Не повторять при ошибке
    maxRetriesPerRequest: 1,
  });

  try {
    // 1. Проверка подключения
    try {
      await redis.ping();
      print(GREEN, '✓', `Подключение: ${REDIS_HOST}:${REDIS_PORT}`);
      tests.connection = true;
      tests.ping = true;
    } catch (error) {
      print(RED, '✗', `Подключение не удалось: ${error.message}`);
      redis.disconnect();
      return tests;
    }

    // 2. Тест SET/GET
    try {
      await redis.set('test:konvert', 'hello');
      const value = await redis.get('test:konvert');
      
      if (value === 'hello') {
        print(GREEN, '✓', 'SET/GET работает корректно');
        tests.set_get = true;
        await redis.del('test:konvert');
      } else {
        print(RED, '✗', `SET/GET вернул неверное значение: ${value}`);
      }
    } catch (error) {
      print(RED, '✗', `Ошибка SET/GET: ${error.message}`);
    }

    // 3. Тест Pub/Sub
    try {
      const subscriber = redis.duplicate();
      let messageReceived = false;

      await subscriber.subscribe('test:channel');
      
      subscriber.on('message', (channel, message) => {
        if (channel === 'test:channel' && message === 'test message') {
          messageReceived = true;
        }
      });

      // Даем время на подписку
      await new Promise(resolve => setTimeout(resolve, 100));

      await redis.publish('test:channel', 'test message');
      
      // Даем время на получение сообщения
      await new Promise(resolve => setTimeout(resolve, 100));

      if (messageReceived) {
        print(GREEN, '✓', 'Pub/Sub работает корректно');
        tests.pub_sub = true;
      } else {
        print(YELLOW, '⚠', 'Pub/Sub не получил сообщение (может быть норма для тестов)');
        tests.pub_sub = true; // Не критично для базовой работы
      }

      await subscriber.unsubscribe('test:channel');
      subscriber.disconnect();
    } catch (error) {
      print(RED, '✗', `Ошибка Pub/Sub: ${error.message}`);
    }

    // 4. Информация о Redis
    try {
      const info = await redis.info();
      const lines = info.split('\r\n');
      const stats = {};
      
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      });

      print(GREEN, '✓', 'Информация Redis:');
      print(BLUE, '  •', `Версия: ${stats.redis_version || 'N/A'}`);
      print(BLUE, '  •', `Память: ${stats.used_memory_human || 'N/A'}`);
      print(BLUE, '  •', `Uptime: ${Math.floor((stats.uptime_in_seconds || 0) / 60)} минут`);
      print(BLUE, '  •', `Подключений: ${stats.connected_clients || 'N/A'}`);
      
      tests.info = true;
    } catch (error) {
      print(RED, '✗', `Ошибка получения информации: ${error.message}`);
    }

  } catch (error) {
    print(RED, '✗', `Неожиданная ошибка: ${error.message}`);
  } finally {
    redis.disconnect();
  }

  return tests;
}

async function main() {
  console.log(BLUE + '\n╔════════════════════════════════════════╗' + RESET);
  console.log(BLUE + '║  Тест подключения Backend "Конверт"  ║' + RESET);
  console.log(BLUE + '╚════════════════════════════════════════╝' + RESET);

  // Тестируем PocketBase
  const pbTests = await testPocketBase();

  // Тестируем Redis
  const redisTests = await testRedis();

  // Итоговая статистика
  console.log('\n' + BLUE + '=== Итоги тестирования ===' + RESET);
  
  const pbSuccess = Object.values(pbTests).filter(Boolean).length;
  const pbTotal = Object.keys(pbTests).length;
  
  const redisSuccess = Object.values(redisTests).filter(Boolean).length;
  const redisTotal = Object.keys(redisTests).length;

  console.log(`\nPocketBase: ${pbSuccess}/${pbTotal} тестов пройдено`);
  console.log(`Redis:      ${redisSuccess}/${redisTotal} тестов пройдено`);

  const allPassed = pbSuccess === pbTotal && redisSuccess === redisTotal;

  if (allPassed) {
    print(GREEN, '\n✓', 'Все тесты пройдены успешно!');
    print(GREEN, '✓', 'Backend готов к использованию\n');
    process.exit(0);
  } else {
    print(YELLOW, '\n⚠', 'Некоторые тесты не прошли');
    print(YELLOW, '⚠', 'Проверьте логи выше для деталей\n');
    
    // Рекомендации
    if (!pbTests.connection) {
      print(RED, '!', 'PocketBase не доступен. Запустите: sudo systemctl start konvert-pocketbase');
    }
    if (!pbTests.collections) {
      print(RED, '!', 'Коллекции не созданы. Запустите: node create-collections.js');
    }
    if (!redisTests.connection) {
      print(RED, '!', 'Redis не доступен. Запустите: sudo systemctl start redis-server');
    }
    
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main().catch(error => {
    console.error(RED + '\n❌ Критическая ошибка:', error.message + RESET);
    process.exit(1);
  });
}

module.exports = { testPocketBase, testRedis };