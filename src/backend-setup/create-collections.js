#!/usr/bin/env node

/**
 * Скрипт создания коллекций PocketBase для чата "Конверт"
 * Запускается автоматически из setup.sh
 */

const PocketBase = require('pocketbase').default || require('pocketbase');
require('dotenv').config();

const POCKETBASE_URL = process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:54739';

// Определение коллекций
const COLLECTIONS = [
  {
    name: 'users',
    type: 'auth',
    options: {
      allowEmailAuth: true,
      allowUsernameAuth: true,
      requireEmail: true,
    },
    schema: [
      { name: 'username', type: 'text', required: true, options: { min: 3, max: 50 } },
      { name: 'display_name', type: 'text', required: false, options: { max: 100 } },
      { name: 'role', type: 'select', required: true, options: { 
        maxSelect: 1,
        values: ['admin', 'moderator', 'vip', 'user']
      }},
      { name: 'avatar', type: 'file', required: false, options: { 
        maxSelect: 1,
        maxSize: 5242880, // 5MB
        mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      }},
      { name: 'status', type: 'select', required: false, options: {
        maxSelect: 1,
        values: ['online', 'offline', 'away', 'busy']
      }},
      { name: 'last_activity', type: 'date', required: false },
      { name: 'banned', type: 'bool', required: false },
      { name: 'ban_until', type: 'date', required: false },
      { name: 'muted', type: 'bool', required: false },
      { name: 'mute_until', type: 'date', required: false },
      { name: 'friends', type: 'json', required: false },
      { name: 'blocked_users', type: 'json', required: false },
      { name: 'public_key', type: 'text', required: false, options: { max: 10000 } },
      { name: 'room_keys', type: 'json', required: false },
    ],
    indexes: [
      'CREATE INDEX idx_users_username ON users (username)',
      'CREATE INDEX idx_users_email ON users (email)',
      'CREATE INDEX idx_users_status ON users (status)',
    ],
  },
  {
    name: 'rooms',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true, options: { min: 1, max: 100 } },
      { name: 'type', type: 'select', required: true, options: {
        maxSelect: 1,
        values: ['public', 'private', 'dm']
      }},
      { name: 'created_by', type: 'relation', required: true, options: {
        collectionId: '_pb_users_auth_',
        cascadeDelete: false,
        maxSelect: 1,
        displayFields: ['username']
      }},
      { name: 'members', type: 'json', required: false },
      { name: 'pinned_message_id', type: 'text', required: false },
      { name: 'dm_participants', type: 'json', required: false },
      { name: 'unread_mentions', type: 'json', required: false },
      { name: 'unread_reactions', type: 'json', required: false },
      { name: 'unread_count', type: 'json', required: false },
      { name: 'last_message', type: 'json', required: false },
      { name: 'last_activity', type: 'date', required: false },
      { name: 'last_read', type: 'json', required: false },
    ],
    indexes: [
      'CREATE INDEX idx_rooms_type ON rooms (type)',
      'CREATE INDEX idx_rooms_created_by ON rooms (created_by)',
      'CREATE INDEX idx_rooms_last_activity ON rooms (last_activity)',
    ],
  },
  {
    name: 'messages',
    type: 'base',
    schema: [
      { name: 'room_id', type: 'relation', required: true, options: {
        collectionId: '', // Will be set dynamically
        cascadeDelete: true,
        maxSelect: 1,
      }},
      { name: 'sender_id', type: 'relation', required: true, options: {
        collectionId: '_pb_users_auth_',
        cascadeDelete: false,
        maxSelect: 1,
        displayFields: ['username']
      }},
      { name: 'sender_username', type: 'text', required: false },
      { name: 'sender_display_name', type: 'text', required: false },
      { name: 'sender_avatar', type: 'text', required: false },
      { name: 'content', type: 'text', required: true, options: { max: 50000 } },
      { name: 'type', type: 'select', required: true, options: {
        maxSelect: 1,
        values: ['text', 'audio', 'video', 'poll', 'voice', 'image', 'file']
      }},
      { name: 'reply_to', type: 'text', required: false },
      { name: 'reactions', type: 'json', required: false },
      { name: 'forwarded', type: 'bool', required: false },
      { name: 'mentions', type: 'json', required: false },
      { name: 'edited', type: 'bool', required: false },
      { name: 'edited_at', type: 'date', required: false },
    ],
    indexes: [
      'CREATE INDEX idx_messages_room_id ON messages (room_id)',
      'CREATE INDEX idx_messages_sender_id ON messages (sender_id)',
      'CREATE INDEX idx_messages_created ON messages (created)',
    ],
  },
  {
    name: 'achievements',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true, options: { max: 100 } },
      { name: 'description', type: 'text', required: false, options: { max: 500 } },
      { name: 'icon', type: 'text', required: false, options: { max: 100 } },
      { name: 'rarity', type: 'select', required: true, options: {
        maxSelect: 1,
        values: ['common', 'rare', 'epic', 'legendary']
      }},
    ],
    indexes: [],
  },
  {
    name: 'user_achievements',
    type: 'base',
    schema: [
      { name: 'user_id', type: 'relation', required: true, options: {
        collectionId: '_pb_users_auth_',
        cascadeDelete: true,
        maxSelect: 1,
      }},
      { name: 'achievement_id', type: 'relation', required: true, options: {
        collectionId: '', // Will be set dynamically
        cascadeDelete: true,
        maxSelect: 1,
      }},
      { name: 'unlocked_at', type: 'date', required: false },
    ],
    indexes: [
      'CREATE INDEX idx_user_achievements_user ON user_achievements (user_id)',
      'CREATE INDEX idx_user_achievements_achievement ON user_achievements (achievement_id)',
    ],
  },
  {
    name: 'friend_requests',
    type: 'base',
    schema: [
      { name: 'from_user', type: 'relation', required: true, options: {
        collectionId: '_pb_users_auth_',
        cascadeDelete: true,
        maxSelect: 1,
      }},
      { name: 'to_user', type: 'relation', required: true, options: {
        collectionId: '_pb_users_auth_',
        cascadeDelete: true,
        maxSelect: 1,
      }},
      { name: 'status', type: 'select', required: true, options: {
        maxSelect: 1,
        values: ['pending', 'accepted', 'rejected']
      }},
    ],
    indexes: [
      'CREATE INDEX idx_friend_requests_from ON friend_requests (from_user)',
      'CREATE INDEX idx_friend_requests_to ON friend_requests (to_user)',
      'CREATE INDEX idx_friend_requests_status ON friend_requests (status)',
    ],
  },
  {
    name: 'files',
    type: 'base',
    schema: [
      { name: 'file', type: 'file', required: true, options: {
        maxSelect: 1,
        maxSize: 52428800, // 50MB
      }},
      { name: 'uploaded_by', type: 'relation', required: false, options: {
        collectionId: '_pb_users_auth_',
        cascadeDelete: false,
        maxSelect: 1,
      }},
      { name: 'file_type', type: 'text', required: false },
      { name: 'file_size', type: 'number', required: false },
    ],
    indexes: [
      'CREATE INDEX idx_files_uploaded_by ON files (uploaded_by)',
    ],
  },
];

// Дефолтные достижения
const DEFAULT_ACHIEVEMENTS = [
  {
    name: '🎉 Первое сообщение',
    description: 'Отправьте первое сообщение в чате',
    icon: '🎉',
    rarity: 'common',
  },
  {
    name: '🌙 Полуночник',
    description: 'Отправьте сообщение между 00:00 и 05:00',
    icon: '🌙',
    rarity: 'rare',
  },
  {
    name: '💬 Болтун',
    description: 'Отправьте 100 сообщений',
    icon: '💬',
    rarity: 'common',
  },
  {
    name: '🔥 На огне',
    description: 'Отправьте 1000 сообщений',
    icon: '🔥',
    rarity: 'epic',
  },
  {
    name: '⚡ Скорострел',
    description: 'Отправьте 10 сообщений за 15 секунд',
    icon: '⚡',
    rarity: 'rare',
  },
  {
    name: '🎄 Новогоднее чудо',
    description: 'Отправьте сообщение 1 января',
    icon: '🎄',
    rarity: 'legendary',
  },
  {
    name: '👥 Социальная бабочка',
    description: 'Добавьте 10 друзей',
    icon: '👥',
    rarity: 'rare',
  },
  {
    name: '❤️ Популярный',
    description: 'Получите 100 реакций на сообщения',
    icon: '❤️',
    rarity: 'epic',
  },
];

async function createCollections() {
  console.log('🔄 Подключение к PocketBase...');
  const pb = new PocketBase(POCKETBASE_URL);

  try {
    // Проверяем доступность
    await pb.health.check();
    console.log('✓ PocketBase доступен\n');
  } catch (error) {
    console.error('✗ PocketBase недоступен:', error.message);
    console.error('  Убедитесь что PocketBase запущен на', POCKETBASE_URL);
    process.exit(1);
  }

  // Авторизация администратора
  console.log('🔐 Авторизация администратора...');
  
  let email, password;
  
  // Проверяем переменные окружения
  if (process.env.POCKETBASE_ADMIN_EMAIL && process.env.POCKETBASE_ADMIN_PASSWORD) {
    email = process.env.POCKETBASE_ADMIN_EMAIL;
    password = process.env.POCKETBASE_ADMIN_PASSWORD;
    console.log('Используются учетные данные из .env файла');
  } else {
    // Интерактивный ввод
    console.log('Введите email и пароль администратора PocketBase');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    email = await new Promise(resolve => {
      rl.question('Email администратора: ', resolve);
    });

    password = await new Promise(resolve => {
      rl.question('Пароль: ', (answer) => {
        resolve(answer);
      });
    });

    rl.close();
  }

  try {
    // В новых версиях PocketBase используется другой endpoint
    await pb.collection('_superusers').authWithPassword(email, password);
    console.log('✓ Авторизация успешна\n');
  } catch (error) {
    console.error('✗ Ошибка авторизации:', error.message);
    
    // Детальная диагностика
    if (error.status === 404 || error.message.includes("wasn't found")) {
      console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА: Администратор PocketBase не создан!\n');
      console.error('📝 Как создать администратора:');
      console.error('  1. Откройте в браузере:');
      console.error('     ' + POCKETBASE_URL + '/_/');
      console.error('');
      console.error('  2. Если видите форму создания администратора:');
      console.error('     - Заполните Email');
      console.error('     - Введите пароль (минимум 8 символов)');
      console.error('     - Нажмите "Create admin"');
      console.error('');
      console.error('  3. Если видите форму входа - администратор уже создан:');
      console.error('     - Проверьте правильность email и пароля');
      console.error('     - Email должен быть валидным (например: admin@localhost)');
      console.error('');
      console.error('  4. Запустите этот скрипт снова\n');
    } else if (error.status === 400) {
      console.error('\n❌ Неверный email или пароль!\n');
      console.error('  - Проверьте правильность учетных данных');
      console.error('  - Email должен быть валидным');
      console.error('  - Пароль должен быть минимум 8 символов\n');
    } else if (error.status === 401 || error.status === 403) {
      console.error('\n❌ Неверные учетные данные!\n');
      console.error('  - Email: ' + email);
      console.error('  - Проверьте пароль\n');
    } else {
      console.error('\n❌ Неизвестная ошибка:\n');
      console.error('  Status:', error.status);
      console.error('  Message:', error.message);
      if (error.response) {
        console.error('  Response:', JSON.stringify(error.response, null, 2));
      }
      console.error('\n💡 Попробуйте:');
      console.error('  1. Открыть ' + POCKETBASE_URL + '/_/');
      console.error('  2. Убедиться что администратор создан');
      console.error('  3. Проверить email и пароль');
      console.error('  4. Запустить скрипт снова\n');
    }
    
    process.exit(1);
  }

  let created = 0;
  let exists = 0;
  let errors = 0;

  // Получаем список существующих коллекций
  console.log('📋 Получение списка коллекций...');
  const existingCollections = await pb.collections.getFullList();
  const existingNames = existingCollections.map(c => c.name);

  // Создаем коллекции
  for (const collection of COLLECTIONS) {
    try {
      if (existingNames.includes(collection.name)) {
        console.log(`⏭️  Коллекция "${collection.name}" уже существует`);
        exists++;
        continue;
      }

      console.log(`📦 Создание коллекции "${collection.name}"...`);

      // Для relations нужно установить правильные ID коллекций
      if (collection.name === 'messages') {
        const roomsCollection = existingCollections.find(c => c.name === 'rooms');
        if (roomsCollection) {
          collection.schema[0].options.collectionId = roomsCollection.id;
        }
      }

      if (collection.name === 'user_achievements') {
        const achievementsCollection = existingCollections.find(c => c.name === 'achievements');
        if (achievementsCollection) {
          collection.schema[1].options.collectionId = achievementsCollection.id;
        }
      }

      const newCollection = await pb.collections.create({
        name: collection.name,
        type: collection.type,
        schema: collection.schema,
        options: collection.options || {},
      });

      console.log(`✓ Коллекция "${collection.name}" создана (ID: ${newCollection.id})`);
      created++;

      // Создаем индексы (если поддерживается)
      if (collection.indexes && collection.indexes.length > 0) {
        console.log(`  Создание ${collection.indexes.length} индексов...`);
        // Note: PocketBase API может не поддерживать прямое создание индексов
        // В этом случае индексы нужно создавать вручную через Admin UI
      }

    } catch (error) {
      console.error(`✗ Ошибка создания коллекции "${collection.name}":`, error.message);
      errors++;
    }
  }

  // Создаем дефолтные достижения
  console.log('\n🏆 Создание дефолтных достижений...');
  
  const achievementsCollection = existingCollections.find(c => c.name === 'achievements');
  if (achievementsCollection) {
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      try {
        // Проверяем существует ли
        const existing = await pb.collection('achievements').getFirstListItem(`name="${achievement.name}"`).catch(() => null);
        
        if (existing) {
          console.log(`  ⏭️  "${achievement.name}" уже существует`);
          continue;
        }

        await pb.collection('achievements').create(achievement);
        console.log(`  ✓ Создано: ${achievement.icon} ${achievement.name}`);
      } catch (error) {
        console.log(`  ⚠️  Не удалось создать "${achievement.name}"`);
      }
    }
  }

  // Итоги
  console.log('\n' + '='.repeat(50));
  console.log('✅ Создание коллекций завершено!');
  console.log('='.repeat(50));
  console.log(`Создно:     ${created}`);
  console.log(`Существует:  ${exists}`);
  console.log(`Ошибок:      ${errors}`);
  console.log('='.repeat(50) + '\n');

  // Рекомендации
  console.log('📝 Следующие шаги:');
  console.log('  1. Откройте PocketBase Admin UI: ' + POCKETBASE_URL + '/_/');
  console.log('  2. Создайте первого администратора');
  console.log('  3. Настройте правила доступа для коллекций');
  console.log('  4. (Опционально) Создайте индексы вручную для оптимизации\n');

  return { created, exists, errors };
}

// Запуск
if (require.main === module) {
  createCollections()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('\n❌ Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = { createCollections, COLLECTIONS, DEFAULT_ACHIEVEMENTS };