import * as kv from './kv_store.tsx';
import { User } from './auth.tsx';
import { Message } from './messages.tsx';

export interface DirectMessage {
  id: string; // формат: {userId1}:{userId2} где userId1 < userId2
  participants: [string, string]; // ID двух участников
  created_at: string;
  last_message?: {
    content: string;
    sender_id: string;
    sender_username: string;
    created_at: string;
  };
  last_activity?: string;
  unread_count?: Record<string, number>; // userId -> count непрочитанных
  last_read?: Record<string, string>; // userId -> timestamp последнего прочтения
}

// Создать ID для DM (всегда меньший ID первым для consistency)
export function createDMId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}:${sorted[1]}`;
}

// Получить или создать DM между двумя пользователями
export async function getOrCreateDM(userId1: string, userId2: string): Promise<{ data?: DirectMessage; error?: string }> {
  try {
    if (!userId1 || !userId2) {
      return { error: 'Некорректные параметры' };
    }

    if (userId1 === userId2) {
      return { error: 'Нельзя создать чат с самим собой' };
    }

    // Проверяем существование пользователей
    const user1 = await kv.get(`user:${userId1}`) as User;
    const user2 = await kv.get(`user:${userId2}`) as User;

    if (!user1 || user1.deleted) {
      return { error: 'Пользователь не найден' };
    }

    if (!user2 || user2.deleted) {
      return { error: 'Собеседник не найден' };
    }

    // Проверяем блокировку
    if (user1.blocked_users?.includes(userId2) || user2.blocked_users?.includes(userId1)) {
      return { error: 'Невозможно создать чат с этим пользователем' };
    }

    const dmId = createDMId(userId1, userId2);
    const dmKey = `dm:${dmId}`;
    
    // Проверяем, существует ли уже DM
    let dm = await kv.get(dmKey) as DirectMessage | null;

    if (dm) {
      return { data: dm };
    }

    // Создаем новый DM
    dm = {
      id: dmId,
      participants: [userId1, userId2].sort() as [string, string],
      created_at: new Date().toISOString(),
      unread_count: {},
      last_read: {}
    };

    await kv.set(dmKey, dm);
    return { data: dm };
  } catch (err: any) {
    console.error('Error in getOrCreateDM:', err);
    return { error: `Ошибка создания чата: ${err?.message || 'Unknown error'}` };
  }
}

// Получить все DM для пользователя
export async function getUserDMs(userId: string): Promise<DirectMessage[] | { error: string }> {
  try {
    const startTime = Date.now();
    console.log('getUserDMs called for user:', userId);
    
    if (!userId) {
      console.error('getUserDMs: userId is undefined or null');
      return [];
    }
    
    const user = await kv.get(`user:${userId}`) as User;
    if (!user || user.deleted) {
      console.log('getUserDMs: user not found or deleted:', userId);
      return [];
    }

    // Получаем все DM из базы (это может быть медленно, но пока нет альтернативы)
    const allDMs = await kv.getByPrefix('dm:');
    console.log(`getUserDMs: Total DMs in database: ${allDMs.length}, loaded in ${Date.now() - startTime}ms`);

    // Фильтруем только те, где пользователь является участником
    const userDMs = allDMs.filter((dm: DirectMessage) => 
      dm && dm.participants && Array.isArray(dm.participants) && dm.participants.includes(userId)
    );
    
    console.log(`getUserDMs: User DMs found: ${userDMs.length}`);

    // Фильтруем DM с заблокированными пользователями
    let filteredDMs = userDMs;
    if (user.blocked_users && user.blocked_users.length > 0) {
      filteredDMs = userDMs.filter((dm: DirectMessage) => {
        if (!dm || !dm.participants) return false;
        const otherUserId = dm.participants.find(id => id !== userId);
        return otherUserId && !user.blocked_users!.includes(otherUserId);
      });
      console.log(`getUserDMs: DMs after blocking filter: ${filteredDMs.length}`);
    }

    // Сортируем по последней активности
    filteredDMs.sort((a: DirectMessage, b: DirectMessage) => {
      const aTime = a.last_activity || a.created_at;
      const bTime = b.last_activity || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    console.log(`getUserDMs: Completed in ${Date.now() - startTime}ms`);
    return filteredDMs;
  } catch (err: any) {
    console.error('Error getting user DMs:', err);
    // Возвращаем пустой массив вместо ошибки для совместимости
    return [];
  }
}

// Отправить сообщение в DM
export async function sendDMMessage(
  dmId: string,
  userId: string,
  content: string,
  type: Message['type'] = 'text',
  replyTo?: string
): Promise<{ data?: Message; error?: string }> {
  try {
    console.log('sendDMMessage called:', { dmId, userId, type });
    
    if (!dmId || !userId || !content) {
      return { error: 'Некорректные параметры' };
    }
    
    const user = await kv.get(`user:${userId}`) as User;
    if (!user || user.deleted) {
      return { error: 'Пользователь не найден' };
    }

    // Проверяем, не забанен ли пользователь
    if (user.banned) {
      return { error: 'Вы заблокированы и не можете отправлять сообщения' };
    }

    // Проверяем, не в муте ли пользователь
    if (user.muted) {
      const mutedUntil = (user as any).muted_until;
      if (mutedUntil) {
        const now = new Date();
        const muteEnd = new Date(mutedUntil);
        if (now < muteEnd) {
          const minutesLeft = Math.ceil((muteEnd.getTime() - now.getTime()) / (1000 * 60));
          return { error: `Вы в муте. Осталось ${minutesLeft} мин.` };
        } else {
          // Мут истек, снимаем его
          user.muted = false;
          delete (user as any).muted_until;
          await kv.set(`user:${userId}`, user);
        }
      } else {
        return { error: 'Вы в муте' };
      }
    }

    const dmKey = `dm:${dmId}`;
    const dm = await kv.get(dmKey) as DirectMessage;
    
    if (!dm) {
      return { error: 'Чат не найден' };
    }

    // Проверяем, что пользователь является участником
    if (!dm.participants.includes(userId)) {
      return { error: 'Вы не являетесь участником чата' };
    }

    // Получаем ID собеседника
    const otherUserId = dm.participants.find(id => id !== userId);
    if (!otherUserId) {
      return { error: 'Собеседник не найден' };
    }

    // Проверяем блокировку
    const otherUser = await kv.get(`user:${otherUserId}`) as User;
    if (!otherUser || otherUser.deleted) {
      return { error: 'Собеседник не найден' };
    }

    if (user.blocked_users?.includes(otherUserId) || otherUser.blocked_users?.includes(userId)) {
      return { error: 'Невозможно отправить сообщение этому пользователю' };
    }

    // Создаем сообщение
    const messageId = crypto.randomUUID();
    const message: Message = {
      id: messageId,
      room_id: dmId, // Используем dmId как room_id для совместимости
      sender_id: userId,
      sender_username: user.username,
      sender_display_name: user.display_name,
      sender_avatar: (user as any).avatar,
      content,
      type,
      reply_to: replyTo,
      created_at: new Date().toISOString(),
      reactions: {}
    };

    await kv.set(`message:${messageId}`, message);
    
    // Добавляем в список сообщений DM
    const dmMessagesKey = `dm_messages:${dmId}`;
    const dmMessages = await kv.get(dmMessagesKey) || [];
    (dmMessages as string[]).push(messageId);
    await kv.set(dmMessagesKey, dmMessages);

    // Обновляем метаданные DM
    dm.last_activity = message.created_at;
    dm.last_message = {
      content: content.substring(0, 100),
      sender_id: userId,
      sender_username: user.display_name || user.username,
      created_at: message.created_at
    };

    // Обновляем счетчик непрочитанных для собеседника
    if (!dm.unread_count) {
      dm.unread_count = {};
    }
    dm.unread_count[otherUserId] = (dm.unread_count[otherUserId] || 0) + 1;

    await kv.set(dmKey, dm);

    console.log('DM message sent successfully:', messageId);
    return { data: message };
  } catch (err: any) {
    console.error('Error sending DM message:', err);
    return { error: `Ошибка отправки сообщения: ${err?.message || 'Unknown error'}` };
  }
}

// Получить сообщения из DM
export async function getDMMessages(dmId: string, userId: string, limit: number = 100): Promise<Message[]> {
  try {
    console.log('getDMMessages called:', { dmId, userId, limit });
    
    if (!dmId || !userId) {
      console.error('getDMMessages: missing dmId or userId');
      return [];
    }
    
    const dmKey = `dm:${dmId}`;
    const dm = await kv.get(dmKey) as DirectMessage;
    
    if (!dm) {
      console.log('DM not found:', dmId);
      return [];
    }

    // Проверяем, что пользователь является участником
    if (!dm.participants || !Array.isArray(dm.participants) || !dm.participants.includes(userId)) {
      console.log('User is not participant of DM:', userId);
      return [];
    }

    const dmMessagesKey = `dm_messages:${dmId}`;
    const messageIds = await kv.get(dmMessagesKey) || [];
    
    if (!Array.isArray(messageIds)) {
      console.error('getDMMessages: messageIds is not an array');
      return [];
    }
    
    console.log('DM message IDs count:', messageIds.length);
    
    const messages = await Promise.all(
      messageIds
        .slice(-limit)
        .map(async (id) => {
          try {
            return await kv.get(`message:${id}`);
          } catch (err) {
            console.error(`Error loading message ${id}:`, err);
            return null;
          }
        })
    );

    // Фильтруем null и удаленные сообщения
    const filteredMessages = messages.filter(
      m => m !== null && m !== undefined && !(m as Message).deleted
    ) as Message[];

    // Обогащаем сообщения актуальной информацией о пользователях
    const enrichedMessages = await Promise.all(
      filteredMessages.map(async (msg) => {
        try {
          const sender = await kv.get(`user:${msg.sender_id}`) as User;
          if (sender && !sender.deleted) {
            msg.sender_display_name = sender.display_name;
            msg.sender_username = sender.username;
            msg.sender_avatar = (sender as any).avatar;
          }
        } catch (err) {
          console.error(`Error loading sender ${msg.sender_id}:`, err);
        }
        return msg;
      })
    );
    
    console.log('DM messages returned:', enrichedMessages.length);
    return enrichedMessages;
  } catch (err: any) {
    console.error('Error getting DM messages:', err);
    return [];
  }
}

// Отметить DM как прочитанный
export async function markDMAsRead(dmId: string, userId: string): Promise<{ data?: { success: boolean }; error?: string }> {
  try {
    if (!dmId || !userId) {
      return { error: 'Некорректные параметры' };
    }
    
    const dmKey = `dm:${dmId}`;
    const dm = await kv.get(dmKey) as DirectMessage;
    
    if (!dm) {
      return { error: 'Чат не найден' };
    }

    // Проверяем, что пользователь является участником
    if (!dm.participants.includes(userId)) {
      return { error: 'Вы не являетесь участником чата' };
    }

    // Сбрасываем счетчик непрочитанных
    if (!dm.unread_count) {
      dm.unread_count = {};
    }
    dm.unread_count[userId] = 0;

    // Обновляем время последнего прочтения
    if (!dm.last_read) {
      dm.last_read = {};
    }
    dm.last_read[userId] = new Date().toISOString();

    await kv.set(dmKey, dm);

    return { data: { success: true } };
  } catch (err: any) {
    console.error('Error marking DM as read:', err);
    return { error: `Ошибка отметки чата: ${err?.message || 'Unknown error'}` };
  }
}

// Удалить DM (мягкое удаление - скрывает для пользователя)
export async function deleteDM(dmId: string, userId: string): Promise<{ data?: { success: boolean }; error?: string }> {
  try {
    if (!dmId || !userId) {
      return { error: 'Некорректные параметры' };
    }
    
    const dmKey = `dm:${dmId}`;
    const dm = await kv.get(dmKey) as DirectMessage;
    
    if (!dm) {
      return { error: 'Чат не найден' };
    }

    // Проверяем, что пользователь является участником
    if (!dm.participants.includes(userId)) {
      return { error: 'Вы не являетесь участником чата' };
    }

    // Сохраняем информацию о том, что пользователь удалил чат
    const hiddenKey = `dm_hidden:${dmId}:${userId}`;
    await kv.set(hiddenKey, { hidden_at: new Date().toISOString() });

    return { data: { success: true } };
  } catch (err: any) {
    console.error('Error deleting DM:', err);
    return { error: `Ошибка удаления чата: ${err?.message || 'Unknown error'}` };
  }
}
