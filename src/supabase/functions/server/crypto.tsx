/**
 * E2EE Server Endpoints
 * Обработка публичных ключей и зашифрованных ключей комнат
 */

import * as kv from './kv_store.tsx';
import { User } from './auth.tsx';

/**
 * Обновление публичного ключа пользователя
 */
export async function updatePublicKey(userId: string, publicKey: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    user.public_key = publicKey;
    await kv.set(`user:${userId}`, user);

    return { data: { success: true } };
  } catch (err: any) {
    console.error('Error updating public key:', err);
    return { error: `Ошибка обновления ключа: ${err.message}` };
  }
}

/**
 * Получение зашифрованного ключа комнаты для текущего пользователя
 */
export async function getRoomKey(userId: string, roomId: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    const encryptedKey = user.room_keys?.[roomId];
    
    if (!encryptedKey) {
      return { data: { encryptedKey: null } };
    }

    return { data: { encryptedKey } };
  } catch (err: any) {
    console.error('Error getting room key:', err);
    return { error: `Ошибка получения ключа комнаты: ${err.message}` };
  }
}

/**
 * Сохранение зашифрованных ключей комнаты для участников
 */
export async function saveRoomKeys(userId: string, roomId: string, encryptedKeys: { [userId: string]: string }) {
  try {
    // Проверяем права (создатель комнаты или администратор)
    const room = await kv.get(`room:${roomId}`);
    const currentUser = await kv.get(`user:${userId}`) as User;
    
    if (!room) {
      return { error: 'Комната не найдена' };
    }

    // Только создатель комнаты, админ или модератор может управлять ключами
    const isAuthorized = 
      room.created_by === userId || 
      ['admin', 'moderator'].includes(currentUser?.role);

    if (!isAuthorized) {
      return { error: 'Недостаточно прав для управления ключами комнаты' };
    }

    // Сохраняем зашифрованные ключи для каждого пользователя
    for (const [targetUserId, encryptedKey] of Object.entries(encryptedKeys)) {
      const targetUser = await kv.get(`user:${targetUserId}`) as User;
      
      if (targetUser) {
        if (!targetUser.room_keys) {
          targetUser.room_keys = {};
        }
        
        targetUser.room_keys[roomId] = encryptedKey;
        await kv.set(`user:${targetUserId}`, targetUser);
      }
    }

    return { data: { success: true } };
  } catch (err: any) {
    console.error('Error saving room keys:', err);
    return { error: `Ошибка сохранения ключей комнаты: ${err.message}` };
  }
}

/**
 * Удаление ключа комнаты у пользователя (при выходе из комнаты)
 */
export async function removeRoomKey(userId: string, roomId: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    if (user.room_keys && user.room_keys[roomId]) {
      delete user.room_keys[roomId];
      await kv.set(`user:${userId}`, user);
    }

    return { data: { success: true } };
  } catch (err: any) {
    console.error('Error removing room key:', err);
    return { error: `Ошибка удаления ключа комнаты: ${err.message}` };
  }
}
