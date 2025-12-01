#!/usr/bin/env node

/**
 * Скрипт проверки доступности админ-панели PocketBase
 */

const PocketBase = require('pocketbase').default || require('pocketbase');
require('dotenv').config();

const POCKETBASE_URL = process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:54739';

async function checkAdmin() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Проверка PocketBase Admin Panel      ║');
  console.log('╚════════════════════════════════════════╝\n');

  const pb = new PocketBase(POCKETBASE_URL);

  // 1. Проверка доступности API
  console.log('1️⃣  Проверка API...');
  try {
    await pb.health.check();
    console.log('   ✓ API доступен: ' + POCKETBASE_URL + '/api/health\n');
  } catch (error) {
    console.error('   ✗ API недоступен:', error.message);
    console.error('   ✗ Убедитесь что PocketBase запущен\n');
    process.exit(1);
  }

  // 2. Попытка получить список админов (проверка создан ли администратор)
  console.log('2️⃣  Проверка наличия администратора...');
  
  // Пробуем авторизоваться с тестовыми данными
  try {
    // Если это вызовет ошибку 404 - администратора нет
    // Если 400/401 - администратор есть, но данные неверные
    await pb.collection('_superusers').authWithPassword('test@test.com', 'test12345678');
    console.log('   ⚠️  Неожиданно: авторизация прошла с тестовыми данными!');
    console.log('   ⚠️  Измените пароль администратора!\n');
  } catch (error) {
    if (error.status === 404 || error.message.includes("wasn't found")) {
      console.log('   ✗ Администратор НЕ СОЗДАН');
      console.log('');
      console.log('   📝 Как создать администратора:');
      console.log('   ┌─────────────────────────────────────────┐');
      console.log('   │ 1. Откройте в браузере:                 │');
      console.log('   │    ' + POCKETBASE_URL + '/_/                      │');
      console.log('   │                                         │');
      console.log('   │ 2. Заполните форму:                     │');
      console.log('   │    Email: admin@localhost               │');
      console.log('   │    Password: (минимум 8 символов)       │');
      console.log('   │                                         │');
      console.log('   │ 3. Нажмите "Create admin"               │');
      console.log('   └─────────────────────────────────────────┘');
      console.log('');
      console.log('   💡 После создания запустите setup.sh снова\n');
      process.exit(1);
    } else if (error.status === 400 || error.status === 401) {
      console.log('   ✓ Администратор СОЗДАН (требуется авторизация)\n');
    } else {
      console.log('   ⚠️  Неизвестная ошибка:', error.message);
      console.log('   Status:', error.status);
      console.log('');
    }
  }

  // 3. Проверка с реальными учетными данными
  if (process.env.POCKETBASE_ADMIN_EMAIL && process.env.POCKETBASE_ADMIN_PASSWORD) {
    console.log('3️⃣  Проверка учетных данных из .env...');
    console.log('   Email: ' + process.env.POCKETBASE_ADMIN_EMAIL);
    
    try {
      await pb.collection('_superusers').authWithPassword(
        process.env.POCKETBASE_ADMIN_EMAIL,
        process.env.POCKETBASE_ADMIN_PASSWORD
      );
      console.log('   ✓ Авторизация успешна!');
      console.log('   ✓ Учетные данные в .env корректны\n');
      
      // Получаем информацию об админе
      const admin = pb.authStore.model;
      console.log('   Информация об администраторе:');
      console.log('   - ID: ' + admin.id);
      console.log('   - Email: ' + admin.email);
      console.log('   - Создан: ' + admin.created);
      console.log('');
      
      return true;
    } catch (error) {
      console.log('   ✗ Авторизация не удалась:', error.message);
      console.log('');
      console.log('   ⚠️  Проблема с учетными данными в .env:');
      console.log('   - Проверьте POCKETBASE_ADMIN_EMAIL');
      console.log('   - Проверьте POCKETBASE_ADMIN_PASSWORD');
      console.log('   - Убедитесь что email валиден');
      console.log('   - Пароль должен быть минимум 8 символов\n');
      
      return false;
    }
  } else {
    console.log('3️⃣  Учетные данные в .env не заданы');
    console.log('   Скрипт setup.sh запросит их интерактивно\n');
  }

  console.log('╔════════════════════════════════════════╗');
  console.log('║  ✓ Проверка завершена                  ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log('📝 Следующие шаги:');
  console.log('   1. Создайте администратора: ' + POCKETBASE_URL + '/_/');
  console.log('   2. Запустите: ./setup.sh');
  console.log('   3. Введите учетные данные администратора\n');
}

// Запуск
checkAdmin().catch(error => {
  console.error('\n❌ Ошибка:', error);
  process.exit(1);
});