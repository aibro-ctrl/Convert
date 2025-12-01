#!/usr/bin/env node
/**
 * Скрипт миграции данных из Supabase в PocketBase
 * 
 * Использование:
 *   npm run migrate:export  - экспорт из Supabase
 *   npm run migrate:import  - импорт в PocketBase
 *   npm run migrate:auto    - полная автоматическая миграция
 */

import { createClient } from '@supabase/supabase-js';
import PocketBase from 'pocketbase';
import * as fs from 'fs';
import * as path from 'path';

// Конфигурация
const EXPORT_PATH = path.join(__dirname, 'data', 'export.json');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const POCKETBASE_URL = process.env.VITE_POCKETBASE_URL || 'http://localhost:8090';
const POCKETBASE_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@konvert.chat';
const POCKETBASE_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || '';

interface ExportData {
  users: any[];
  rooms: any[];
  messages: any[];
  achievements: any[];
  friend_requests: any[];
  timestamp: string;
  version: string;
}

/**
 * Экспорт данных из Supabase
 */
async function exportFromSupabase(): Promise<ExportData> {
  console.log('🔄 Connecting to Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('📦 Exporting users...');
  const users = await exportKVData(supabase, 'user:');

  console.log('📦 Exporting rooms...');
  const rooms = await exportKVData(supabase, 'room:');

  console.log('📦 Exporting messages...');
  const messages = await exportKVData(supabase, 'message:');

  console.log('📦 Exporting achievements...');
  const achievements = await exportKVData(supabase, 'achievement:');

  console.log('📦 Exporting friend requests...');
  const friend_requests = await exportKVData(supabase, 'friend_request:');

  const exportData: ExportData = {
    users,
    rooms,
    messages,
    achievements,
    friend_requests,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };

  console.log('✅ Export complete!');
  console.log(`   Users: ${users.length}`);
  console.log(`   Rooms: ${rooms.length}`);
  console.log(`   Messages: ${messages.length}`);
  console.log(`   Achievements: ${achievements.length}`);
  console.log(`   Friend Requests: ${friend_requests.length}`);

  return exportData;
}

/**
 * Экспорт данных из KV store
 */
async function exportKVData(supabase: any, prefix: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('kv_store_b0f1e6d5')
    .select('*')
    .like('key', `${prefix}%`);

  if (error) {
    throw new Error(`Failed to export ${prefix}: ${error.message}`);
  }

  return data.map((item: any) => ({
    key: item.key,
    value: item.value,
  }));
}

/**
 * Сохранение экспорта в файл
 */
async function saveExport(data: ExportData): Promise<void> {
  const dir = path.dirname(EXPORT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(EXPORT_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`💾 Export saved to: ${EXPORT_PATH}`);
  
  const stats = fs.statSync(EXPORT_PATH);
  console.log(`   File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * Загрузка экспорта из файла
 */
async function loadExport(): Promise<ExportData> {
  if (!fs.existsSync(EXPORT_PATH)) {
    throw new Error(`Export file not found: ${EXPORT_PATH}`);
  }

  const content = fs.readFileSync(EXPORT_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Импорт данных в PocketBase
 */
async function importToPocketBase(data: ExportData): Promise<void> {
  console.log('🔄 Connecting to PocketBase...');
  const pb = new PocketBase(POCKETBASE_URL);

  console.log('🔐 Authenticating...');
  await pb.admins.authWithPassword(POCKETBASE_EMAIL, POCKETBASE_PASSWORD);

  // Создаем коллекции если их нет
  console.log('📋 Creating collections...');
  await createCollections(pb);

  console.log('👥 Importing users...');
  await importUsers(pb, data.users);

  console.log('🏠 Importing rooms...');
  await importRooms(pb, data.rooms);

  console.log('💬 Importing messages...');
  await importMessages(pb, data.messages);

  console.log('🏆 Importing achievements...');
  await importAchievements(pb, data.achievements);

  console.log('🤝 Importing friend requests...');
  await importFriendRequests(pb, data.friend_requests);

  console.log('✅ Import complete!');
}

/**
 * Создание коллекций в PocketBase
 */
async function createCollections(pb: PocketBase): Promise<void> {
  const collections = [
    {
      name: 'users',
      type: 'auth',
      schema: [
        { name: 'username', type: 'text', required: true },
        { name: 'display_name', type: 'text' },
        { name: 'role', type: 'select', options: ['admin', 'moderator', 'vip', 'user'] },
        { name: 'avatar', type: 'file', maxSelect: 1 },
        { name: 'status', type: 'select', options: ['online', 'offline'] },
        { name: 'last_activity', type: 'date' },
        { name: 'banned', type: 'bool' },
        { name: 'ban_until', type: 'date' },
        { name: 'muted', type: 'bool' },
        { name: 'mute_until', type: 'date' },
        { name: 'friends', type: 'json' },
        { name: 'blocked_users', type: 'json' },
        { name: 'public_key', type: 'text' },
        { name: 'room_keys', type: 'json' },
      ],
    },
    {
      name: 'rooms',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true },
        { name: 'type', type: 'select', options: ['public', 'private', 'dm'], required: true },
        { name: 'created_by', type: 'relation', options: { collectionId: 'users' } },
        { name: 'members', type: 'json' },
        { name: 'pinned_message_id', type: 'text' },
        { name: 'isGodMode', type: 'bool' },
        { name: 'dm_participants', type: 'json' },
        { name: 'unread_mentions', type: 'json' },
        { name: 'unread_reactions', type: 'json' },
        { name: 'unread_count', type: 'json' },
        { name: 'last_message', type: 'json' },
        { name: 'last_activity', type: 'date' },
        { name: 'last_read', type: 'json' },
      ],
    },
    {
      name: 'messages',
      type: 'base',
      schema: [
        { name: 'room_id', type: 'relation', options: { collectionId: 'rooms' }, required: true },
        { name: 'sender_id', type: 'relation', options: { collectionId: 'users' }, required: true },
        { name: 'sender_username', type: 'text' },
        { name: 'sender_display_name', type: 'text' },
        { name: 'sender_avatar', type: 'text' },
        { name: 'content', type: 'text', required: true },
        { name: 'type', type: 'select', options: ['text', 'audio', 'video', 'poll', 'voice', 'image', 'file'] },
        { name: 'reply_to', type: 'text' },
        { name: 'reactions', type: 'json' },
        { name: 'forwarded', type: 'bool' },
        { name: 'mentions', type: 'json' },
        { name: 'edited', type: 'bool' },
        { name: 'edited_at', type: 'date' },
      ],
    },
    {
      name: 'achievements',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'icon', type: 'text' },
        { name: 'rarity', type: 'select', options: ['common', 'rare', 'epic', 'legendary'] },
      ],
    },
    {
      name: 'user_achievements',
      type: 'base',
      schema: [
        { name: 'user_id', type: 'relation', options: { collectionId: 'users' }, required: true },
        { name: 'achievement_id', type: 'relation', options: { collectionId: 'achievements' }, required: true },
        { name: 'unlocked_at', type: 'date' },
      ],
    },
    {
      name: 'friend_requests',
      type: 'base',
      schema: [
        { name: 'from_user', type: 'relation', options: { collectionId: 'users' }, required: true },
        { name: 'to_user', type: 'relation', options: { collectionId: 'users' }, required: true },
        { name: 'status', type: 'select', options: ['pending', 'accepted', 'rejected'] },
      ],
    },
    {
      name: 'files',
      type: 'base',
      schema: [
        { name: 'file', type: 'file', required: true },
        { name: 'uploaded_by', type: 'relation', options: { collectionId: 'users' } },
      ],
    },
  ];

  for (const collectionConfig of collections) {
    try {
      // Проверяем существование коллекции
      await pb.collections.getOne(collectionConfig.name);
      console.log(`   ✓ Collection "${collectionConfig.name}" exists`);
    } catch (e) {
      // Коллекция не существует, создаем
      try {
        await pb.collections.create(collectionConfig as any);
        console.log(`   ✓ Created collection "${collectionConfig.name}"`);
      } catch (error: any) {
        console.error(`   ✗ Failed to create collection "${collectionConfig.name}":`, error.message);
      }
    }
  }
}

/**
 * Импорт пользователей
 */
async function importUsers(pb: PocketBase, users: any[]): Promise<void> {
  let imported = 0;
  let skipped = 0;

  for (const item of users) {
    try {
      const user = item.value;
      const userId = item.key.replace('user:', '');

      // Проверяем существование
      try {
        await pb.collection('users').getOne(userId);
        skipped++;
        continue;
      } catch (e) {
        // Пользователь не существует, создаем
      }

      await pb.collection('users').create({
        id: userId,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        role: user.role || 'user',
        status: user.status || 'offline',
        last_activity: user.last_activity,
        banned: user.banned || false,
        ban_until: user.ban_until,
        muted: user.muted || false,
        mute_until: user.mute_until,
        friends: user.friends || [],
        blocked_users: user.blocked_users || [],
        public_key: user.public_key,
        room_keys: user.room_keys || {},
        password: 'temp_password_' + Math.random().toString(36).substring(7), // Временный пароль
        passwordConfirm: 'temp_password_' + Math.random().toString(36).substring(7),
      });

      imported++;
    } catch (error: any) {
      console.error(`   ✗ Failed to import user ${item.key}:`, error.message);
    }
  }

  console.log(`   ✓ Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Импорт комнат
 */
async function importRooms(pb: PocketBase, rooms: any[]): Promise<void> {
  let imported = 0;
  let skipped = 0;

  for (const item of rooms) {
    try {
      const room = item.value;
      const roomId = item.key.replace('room:', '');

      // Проверяем существование
      try {
        await pb.collection('rooms').getOne(roomId);
        skipped++;
        continue;
      } catch (e) {
        // Комната не существует, создаем
      }

      await pb.collection('rooms').create({
        id: roomId,
        name: room.name,
        type: room.type || 'public',
        created_by: room.created_by,
        members: room.members || [],
        pinned_message_id: room.pinned_message_id,
        isGodMode: room.isGodMode || false,
        dm_participants: room.dm_participants,
        unread_mentions: room.unread_mentions || {},
        unread_reactions: room.unread_reactions || {},
        unread_count: room.unread_count || {},
        last_message: room.last_message,
        last_activity: room.last_activity || new Date().toISOString(),
        last_read: room.last_read || {},
      });

      imported++;
    } catch (error: any) {
      console.error(`   ✗ Failed to import room ${item.key}:`, error.message);
    }
  }

  console.log(`   ✓ Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Импорт сообщений
 */
async function importMessages(pb: PocketBase, messages: any[]): Promise<void> {
  let imported = 0;
  let skipped = 0;

  for (const item of messages) {
    try {
      const message = item.value;
      const messageId = item.key.replace('message:', '');

      // Проверяем существование
      try {
        await pb.collection('messages').getOne(messageId);
        skipped++;
        continue;
      } catch (e) {
        // Сообщение не существует, создаем
      }

      await pb.collection('messages').create({
        id: messageId,
        room_id: message.room_id,
        sender_id: message.sender_id,
        sender_username: message.sender_username,
        sender_display_name: message.sender_display_name,
        sender_avatar: message.sender_avatar,
        content: message.content,
        type: message.type || 'text',
        reply_to: message.reply_to,
        reactions: message.reactions || {},
        forwarded: message.forwarded || false,
        mentions: message.mentions || [],
        edited: message.edited || false,
        edited_at: message.edited_at,
      });

      imported++;
    } catch (error: any) {
      console.error(`   ✗ Failed to import message ${item.key}:`, error.message);
    }
  }

  console.log(`   ✓ Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Импорт достижений
 */
async function importAchievements(pb: PocketBase, achievements: any[]): Promise<void> {
  let imported = 0;
  let skipped = 0;

  for (const item of achievements) {
    try {
      const achievement = item.value;
      const achievementId = item.key.replace('achievement:', '');

      // Проверяем существование
      try {
        await pb.collection('achievements').getOne(achievementId);
        skipped++;
        continue;
      } catch (e) {
        // Достижение не существует, создаем
      }

      await pb.collection('achievements').create({
        id: achievementId,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        rarity: achievement.rarity || 'common',
      });

      imported++;
    } catch (error: any) {
      console.error(`   ✗ Failed to import achievement ${item.key}:`, error.message);
    }
  }

  console.log(`   ✓ Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Импорт запросов дружбы
 */
async function importFriendRequests(pb: PocketBase, friendRequests: any[]): Promise<void> {
  let imported = 0;
  let skipped = 0;

  for (const item of friendRequests) {
    try {
      const request = item.value;
      const requestId = item.key.replace('friend_request:', '');

      // Проверяем существование
      try {
        await pb.collection('friend_requests').getOne(requestId);
        skipped++;
        continue;
      } catch (e) {
        // Запрос не существует, создаем
      }

      await pb.collection('friend_requests').create({
        id: requestId,
        from_user: request.from,
        to_user: request.to,
        status: request.status || 'pending',
      });

      imported++;
    } catch (error: any) {
      console.error(`   ✗ Failed to import friend request ${item.key}:`, error.message);
    }
  }

  console.log(`   ✓ Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Главная функция
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'export':
        console.log('🚀 Starting export from Supabase...\n');
        const exportData = await exportFromSupabase();
        await saveExport(exportData);
        console.log('\n✨ Export completed successfully!');
        break;

      case 'import':
        console.log('🚀 Starting import to PocketBase...\n');
        const importData = await loadExport();
        await importToPocketBase(importData);
        console.log('\n✨ Import completed successfully!');
        break;

      case 'auto':
        console.log('🚀 Starting automatic migration...\n');
        console.log('Step 1/2: Exporting from Supabase...\n');
        const autoExportData = await exportFromSupabase();
        await saveExport(autoExportData);
        console.log('\nStep 2/2: Importing to PocketBase...\n');
        await importToPocketBase(autoExportData);
        console.log('\n✨ Migration completed successfully!');
        break;

      default:
        console.log('Usage:');
        console.log('  npm run migrate:export  - Export from Supabase');
        console.log('  npm run migrate:import  - Import to PocketBase');
        console.log('  npm run migrate:auto    - Automatic migration');
        process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main();
}

export { exportFromSupabase, importToPocketBase, saveExport, loadExport };
