import * as kv from './kv_store.tsx';
import { User } from './auth.tsx';

export interface Room {
  id: string;
  name: string;
  type: 'public' | 'private' | 'dm'; // добавили тип 'dm' для приватных сообщений
  created_by: string;
  created_at: string;
  members: string[]; // user IDs
  pinned_message_id?: string;
  dm_participants?: string[]; // Для DM комнат - ID двух участников
  unread_mentions?: Record<string, number>; // userId -> count
  unread_reactions?: Record<string, number>; // userId -> count
  unread_count?: Record<string, number>; // userId -> count непрочитанных сообщений
  last_read?: Record<string, string>; // userId -> timestamp последнего прочтения
  last_activity?: string; // Время последней активности (последнее сообщение)
  last_message?: {
    content: string;
    sender_username: string;
    created_at: string;
  };
  deleted?: boolean; // Флаг мягкого удаления
  deleted_at?: string; // Дата удаления
  deleted_by?: string; // Кто удалил
}

export async function createRoom(
  name: string, 
  type: 'public' | 'private', 
  userId: string
) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    // Только админ может создавать публичные комнаты
    if (type === 'public' && user?.role !== 'admin') {
      return { error: 'Только администратор может создавать публичные комнаты' };
    }

    const roomId = crypto.randomUUID();
    const room: Room = {
      id: roomId,
      name,
      type,
      created_by: userId,
      created_at: new Date().toISOString(),
      members: [userId]
    };

    await kv.set(`room:${roomId}`, room);
    return { data: room };
  } catch (err: any) {
    return { error: `Ошибка создания комнаты: ${err.message}` };
  }
}

export async function getRooms(userId: string, godModeEnabled: boolean = false) {
  try {
    const startTime = Date.now();
    console.log('getRooms called for user:', userId, 'godMode:', godModeEnabled);
    
    const user = await kv.get(`user:${userId}`) as User;
    console.log('getRooms - user loaded:', user?.username);
    
    const allRooms = await kv.getByPrefix('room:');
    console.log(`getRooms - total rooms loaded: ${allRooms.length} in ${Date.now() - startTime}ms`);
    
    // Фильтруем удаленные комнаты
    const activeRooms = allRooms.filter((room: Room) => !room.deleted);
    console.log('getRooms - active rooms:', activeRooms.length);
    
    // Забаненные пользователи видят ТОЛЬКО Азкабан
    if (user?.banned) {
      console.log('User is banned - showing only Azkaban');
      const azkaban = activeRooms.find((room: Room) => room.name === '🔒 Азкабан');
      
      if (azkaban) {
        // Автоматически добавляем пользователя в Азкабан, если его там нет
        if (!azkaban.members.includes(userId)) {
          azkaban.members.push(userId);
          await kv.set(`room:${azkaban.id}`, azkaban);
        }
        return [azkaban];
      }
      
      // Если Азкабан не найден, возвращаем пустой список
      console.error('Azkaban room not found!');
      return [];
    }
    
    // Режим "Глаз Бога" - только первый пользователь iBro может включить
    if (user?.username === 'iBro' && godModeEnabled) {
      console.log('God Mode enabled for iBro - showing all rooms except favorites');
      // Исключаем комнаты "Избранное" из режима Глаз Бога
      const filteredGodModeRooms = activeRooms.filter((room: Room) => 
        !room.name.includes('⭐ Избранное') && !room.name.includes('Избранное')
      );
      return filteredGodModeRooms.map((room: Room) => ({
        ...room,
        isGodMode: !room.members.includes(userId)
      }));
    }

    // Обычные пользователи (и админы без режима Глаза Бога) видят публичные комнаты и свои приватные/DM
    let filteredRooms = activeRooms.filter((room: Room) => 
      room.type === 'public' || room.members.includes(userId)
    );
    
    // Фильтруем DM с заблокированными пользователями
    if (user?.blocked_users && user.blocked_users.length > 0) {
      filteredRooms = filteredRooms.filter((room: Room) => {
        // Если это DM комната
        if (room.type === 'dm' && room.dm_participants) {
          // Проверяем, есть ли среди участников заблокированные
          const otherParticipant = room.dm_participants.find(id => id !== userId);
          if (otherParticipant && user.blocked_users!.includes(otherParticipant)) {
            return false; // Исключаем этот чат
          }
        }
        return true;
      });
    }
    
    console.log('getRooms - filtered rooms for user:', filteredRooms.length);
    
    return filteredRooms;
  } catch (err: any) {
    console.error('Error getting rooms:', err);
    console.error('getRooms error stack:', err?.stack);
    return [];
  }
}

export async function joinRoom(roomId: string, userId: string, godModeEnabled: boolean = false) {
  try {
    console.log(`joinRoom: user ${userId} joining room ${roomId}, godMode: ${godModeEnabled}`);
    const room = await kv.get(`room:${roomId}`) as Room;
    if (!room) {
      console.log(`joinRoom: room ${roomId} not found`);
      return { error: 'Комната не найдена' };
    }

    console.log(`joinRoom: room found - ${room.name} (${room.type}), members: ${room.members.length}`);

    // Нельзя присоединиться к удаленной комнате
    if (room.deleted) {
      console.log(`joinRoom: room ${roomId} is deleted`);
      return { error: 'Комната удалена' };
    }

    // Пользователь iBro в режиме "Глаз Бога" не должен быть добавлен в список участников
    const user = await kv.get(`user:${userId}`) as User;
    const isGodModeUser = user?.username === 'iBro' && godModeEnabled;
    console.log(`joinRoom: user ${user?.username}, godModeUser: ${isGodModeUser}`);

    // Проверяем, является ли комната Азкабаном (может быть public или private)
    const isAzkaban = room.name === '🔒 Азкабан';
    
    // Если пользователь забанен и это НЕ Азкабан, запрещаем вход
    if (user?.banned && !isAzkaban && !isGodModeUser) {
      console.log(`joinRoom: banned user ${userId} trying to join non-Azkaban room`);
      return { error: 'Забаненные пользователи могут находиться только в Азкабане' };
    }

    // Если не в режиме Глаз Бога или это публичная комната, добавляем в участники
    const wasAlreadyMember = room.members.includes(userId);
    if (!isGodModeUser && !wasAlreadyMember) {
      room.members.push(userId);
      await kv.set(`room:${roomId}`, room);
      console.log(`joinRoom: added user ${userId} to room ${roomId}, new members count: ${room.members.length}`);
    } else {
      console.log(`joinRoom: user ${userId} already member of room ${roomId} or godMode`);
    }

    return { data: room };
  } catch (err: any) {
    console.error(`joinRoom error:`, err);
    return { error: `Ошибка входа в комнату: ${err.message}` };
  }
}

export async function leaveRoom(roomId: string, userId: string) {
  try {
    const room = await kv.get(`room:${roomId}`) as Room;
    if (!room) {
      return { error: 'Комната не найдена' };
    }

    // Проверяем, не является ли это Азкабаном
    const isAzkaban = room.name === '🔒 Азкабан' && room.type === 'public';
    
    // Проверяем, не забанен ли пользователь
    const user = await kv.get(`user:${userId}`) as User;
    
    // Если пользователь забанен и это Азкабан, запрещаем выход
    if (user?.banned && isAzkaban) {
      return { error: 'Забаненные пользователи не могут покинуть Азкабан' };
    }

    room.members = room.members.filter(id => id !== userId);
    await kv.set(`room:${roomId}`, room);

    return { data: room };
  } catch (err: any) {
    return { error: `Ошибка выхода из комнаты: ${err.message}` };
  }
}

export async function inviteToRoom(roomId: string, invitedUserId: string, inviterId: string) {
  try {
    const room = await kv.get(`room:${roomId}`) as Room;
    if (!room) {
      return { error: 'Комната не найдена' };
    }

    // Нельзя приглашать в удаленную комнату
    if (room.deleted) {
      return { error: 'Комната удалена' };
    }

    // Проверка что приглашающий - участник комнаты
    if (!room.members.includes(inviterId)) {
      return { error: 'Вы не являетесь участником этой комнаты' };
    }

    // Проверка что приглашаемый пользователь не удален
    const invitedUser = await kv.get(`user:${invitedUserId}`) as User;
    if (!invitedUser || invitedUser.deleted) {
      return { error: 'Пользователь не найден' };
    }

    if (!room.members.includes(invitedUserId)) {
      room.members.push(invitedUserId);
      await kv.set(`room:${roomId}`, room);
    }

    return { data: room };
  } catch (err: any) {
    return { error: `Ошибка приглашения: ${err.message}` };
  }
}

export async function pinMessage(roomId: string, messageId: string, userId: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    // Только админ, модератор и VIP могут закреплять
    if (!['admin', 'moderator', 'vip'].includes(user?.role)) {
      return { error: 'Недостаточно прав для закрепления' };
    }

    const room = await kv.get(`room:${roomId}`) as Room;
    if (!room) {
      return { error: 'Комната не найдена' };
    }

    // Нельзя закреплять сообщения в удаленной комнате
    if (room.deleted) {
      return { error: 'Комната удалена' };
    }

    // Проверяем, что сообщение не удалено
    const message = await kv.get(`message:${messageId}`);
    if (!message || (message as any).deleted) {
      return { error: 'Сообщение не найдено или удалено' };
    }

    room.pinned_message_id = messageId;
    await kv.set(`room:${roomId}`, room);

    return { data: room };
  } catch (err: any) {
    return { error: `Ошибка закрепления: ${err.message}` };
  }
}

export async function unpinMessage(roomId: string, userId: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!['admin', 'moderator', 'vip'].includes(user?.role)) {
      return { error: 'Недостаточно прав' };
    }

    const room = await kv.get(`room:${roomId}`) as Room;
    if (!room) {
      return { error: 'Комната не найдена' };
    }

    delete room.pinned_message_id;
    await kv.set(`room:${roomId}`, room);

    return { data: room };
  } catch (err: any) {
    return { error: `Ошибка открепления: ${err.message}` };
  }
}

// Создание или получение DM комнаты между двумя пользователями
export async function getOrCreateDM(userId1: string, userId2: string) {
  try {
    if (userId1 === userId2) {
      return { error: 'Нельзя создать DM с самим собой' };
    }

    // Проверяем блокировку
    const user1 = await kv.get(`user:${userId1}`) as User;
    const user2 = await kv.get(`user:${userId2}`) as User;

    if (!user1 || !user2) {
      return { error: 'Пользователь не найден' };
    }

    // Проверяем, не заблокировал ли один пользователь другого
    if (user1.blocked_users?.includes(userId2) || user2.blocked_users?.includes(userId1)) {
      return { error: 'Невозможно создать чат с этим пользователем' };
    }

    // Ищем существующую DM комнату (не удаленную)
    const allRooms = await kv.getByPrefix('room:');
    const existingDM = allRooms.find((room: Room) => 
      room.type === 'dm' &&
      !room.deleted &&
      room.dm_participants &&
      room.dm_participants.includes(userId1) &&
      room.dm_participants.includes(userId2)
    );

    if (existingDM) {
      return { data: existingDM };
    }

    // Создаем новую DM комнату
    const roomId = crypto.randomUUID();
    const room: Room = {
      id: roomId,
      name: `DM: ${user1.username} & ${user2.username}`,
      type: 'dm',
      created_by: userId1,
      created_at: new Date().toISOString(),
      members: [userId1, userId2],
      dm_participants: [userId1, userId2],
      unread_mentions: {},
      unread_reactions: {}
    };

    await kv.set(`room:${roomId}`, room);
    return { data: room };
  } catch (err: any) {
    return { error: `Ошибка создания DM: ${err.message}` };
  }
}

// Удаление комнаты (мягкое удаление)
export async function deleteRoom(roomId: string, userId: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    const room = await kv.get(`room:${roomId}`) as Room;
    
    if (!room) {
      return { error: 'Комната не найдена' };
    }

    if (room.deleted) {
      return { error: 'Комната уже удалена' };
    }

    // Может удалять: создатель комнаты, модератор или админ
    if (room.created_by !== userId && !['admin', 'moderator'].includes(user?.role)) {
      return { error: 'Недостаточно прав для удаления комнаты' };
    }

    // Мягкое удаление - помечаем комнату как удаленную
    room.deleted = true;
    room.deleted_at = new Date().toISOString();
    room.deleted_by = userId;
    
    await kv.set(`room:${roomId}`, room);

    return { data: { success: true } };
  } catch (err: any) {
    return { error: `Ошибка удаления комнаты: ${err.message}` };
  }
}

// Очистка дублирующих комнат Азкабан (оставляем только одну приватную)
export async function cleanupAzkabanRooms() {
  try {
    const allRooms = await kv.getByPrefix('room:');
    const azkabanRooms = allRooms.filter((r: Room) => r.name === '🔒 Азкабан');
    
    if (azkabanRooms.length <= 1) {
      return { data: { message: 'Нет дублирующих комнат' } };
    }
    
    // Находим приватную комнату Азкабан или создаем её
    let privateAzkaban = azkabanRooms.find((r: Room) => r.type === 'private');
    
    if (!privateAzkaban) {
      // Если нет приватной, берем первую и меняем тип
      privateAzkaban = azkabanRooms[0];
      privateAzkaban.type = 'private';
      await kv.set(`room:${privateAzkaban.id}`, privateAzkaban);
    }
    
    // Удаляем все остальные
    let deletedCount = 0;
    for (const room of azkabanRooms) {
      if (room.id !== privateAzkaban.id) {
        await kv.del(`room:${room.id}`);
        deletedCount++;
      }
    }
    
    return { data: { message: `Удалено ${deletedCount} дублирующих комнат`, azkaban: privateAzkaban } };
  } catch (err: any) {
    return { error: `Ошибка очистки: ${err.message}` };
  }
}

// Получить комнату по ID
export async function getRoom(roomId: string): Promise<Room | null> {
  try {
    const room = await kv.get(`room:${roomId}`) as Room;
    if (!room || room.deleted) {
      return null;
    }
    return room;
  } catch (err: any) {
    console.error('Error getting room:', err);
    return null;
  }
}

// Создание или получение комнаты избранного для пользователя
export async function getOrCreateFavorites(userId: string) {
  try {
    // Ищем существующую комнату избранного
    const allRooms = await kv.getByPrefix('room:');
    const existingFavorite = allRooms.find((room: Room) => 
      !room.deleted &&
      (room.name === `⭐ Избранное (${userId})` || room.name.includes(`Избранное`) && room.members.includes(userId) && room.type === 'private')
    );

    if (existingFavorite) {
      return { data: existingFavorite };
    }

    // Создаем новую комнату избранного
    const roomId = crypto.randomUUID();
    const room: Room = {
      id: roomId,
      name: `⭐ Избранное`,
      type: 'private',
      created_by: userId,
      created_at: new Date().toISOString(),
      members: [userId]
    };

    await kv.set(`room:${roomId}`, room);
    return { data: room };
  } catch (err: any) {
    return { error: `Ошибка создания избранного: ${err.message}` };
  }
}
