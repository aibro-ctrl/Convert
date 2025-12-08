import * as kv from './kv_store.tsx';
import { User } from './auth.tsx';
import { Room } from './rooms.tsx';

// Проверка мута с учетом времени
async function checkMute(user: User, userId: string): Promise<{ muted: boolean; message?: string }> {
  if (!user.muted) {
    return { muted: false };
  }
  
  const mutedUntil = (user as any).muted_until;
  if (mutedUntil) {
    const now = new Date();
    const muteEnd = new Date(mutedUntil);
    if (now < muteEnd) {
      const minutesLeft = Math.ceil((muteEnd.getTime() - now.getTime()) / (1000 * 60));
      return { muted: true, message: `Вы в муте. Осталось ${minutesLeft} мин.` };
    } else {
      // Мут истек, снимаем его
      user.muted = false;
      delete (user as any).muted_until;
      await kv.set(`user:${userId}`, user);
      return { muted: false };
    }
  }
  
  return { muted: true, message: 'Вы в муте' };
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_username: string;
  sender_display_name?: string; // Отображаемое имя (может быть на русском)
  sender_avatar?: string;
  content: string;
  type: 'text' | 'audio' | 'video' | 'poll' | 'voice';
  reply_to?: string;
  created_at: string;
  reactions?: Record<string, string[]>; // emoji -> user IDs
  forwarded?: boolean;
  mentions?: string[]; // user IDs mentioned
  edited?: boolean;
  edited_at?: string;
  deleted?: boolean; // Флаг мягкого удаления
  deleted_at?: string; // Дата удаления
  deleted_by?: string; // Кто удалил
}

export interface Poll {
  id: string;
  message_id: string;
  question: string;
  options: string[];
  votes: Record<string, string[]>; // option index -> array of user IDs
  anonymous: boolean;
  created_by: string;
  created_at: string;
  deleted?: boolean; // Флаг мягкого удаления
  deleted_at?: string; // Дата удаления
  deleted_by?: string; // Кто удалил
}

export async function sendMessage(
  roomId: string,
  userId: string,
  content: string,
  type: Message['type'] = 'text',
  replyTo?: string
) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    if (user.deleted) {
      return { error: 'Пользователь удален' };
    }

    const room = await kv.get(`room:${roomId}`) as Room;
    
    if (!room) {
      return { error: 'Комната не найдена' };
    }

    if (room.deleted) {
      return { error: 'Комната удалена' };
    }

    const isAzkaban = room.name === '🔒 Азкабан';

    // Забаненные могут писать только в Азкабане
    if (user.banned && !isAzkaban) {
      return { error: 'Вы заблокированы' };
    }

    // Проверка мута работает везде, включая Азкабан
    const muteCheck = await checkMute(user, userId);
    if (muteCheck.muted) {
      return { error: muteCheck.message || 'Вы в муте' };
    }

    // Проверка участника комнаты
    // Если пользователь не является участником, автоматически добавляем его для публичных комнат
    console.log(`sendMessage: checking membership for user ${userId} in room ${roomId}`);
    console.log(`sendMessage: room type: ${room.type}, current members: ${room.members.length}`);
    console.log(`sendMessage: user is member: ${room.members.includes(userId)}`);
    
    // Для DM комнат проверяем также dm_participants
    const isMember = room.members.includes(userId) || 
                     (room.type === 'dm' && room.dm_participants?.includes(userId));
    
    if (!isMember) {
      if (room.type === 'public') {
        // Автоматически добавляем в публичную комнату
        room.members.push(userId);
        await kv.set(`room:${roomId}`, room);
        console.log(`Auto-joined user ${userId} to public room ${roomId} (sending message)`);
      } else if (room.type === 'dm' && room.dm_participants?.includes(userId)) {
        // Для DM комнат, если пользователь в dm_participants но не в members, добавляем в members
        room.members.push(userId);
        await kv.set(`room:${roomId}`, room);
        console.log(`Auto-added user ${userId} to DM room members ${roomId} (sending message)`);
      } else {
        // Для приватных комнат требуется быть участником
        console.log(`sendMessage: user ${userId} is not member of ${room.type} room ${roomId}`);
        return { error: 'Вы не являетесь участником комнаты' };
      }
    }

    // Если это опрос, создаем опрос автоматически
    if (type === 'poll') {
      // Парсим содержимое опроса
      console.log('Parsing poll content:', JSON.stringify(content));
      const lines = content.split('\n').filter(line => line.trim());
      console.log('Parsed lines:', lines);
      
      if (lines.length < 3) {
        console.error('Invalid poll format - not enough lines:', lines.length);
        return { error: 'Неверный формат опроса' };
      }
      
      const firstLine = lines[0];
      const isAnonymous = firstLine.includes('🔒');
      const question = firstLine.replace('📊 ', '').replace(' 🔒 [Анонимный]', '').trim();
      console.log('Poll question:', question, 'Anonymous:', isAnonymous);
      
      const options: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\d+)\.\s+(.+)$/);
        if (match) {
          options.push(match[2]);
        }
      }
      console.log('Poll options:', options);
      
      if (options.length < 2) {
        console.error('Invalid poll - not enough options:', options.length);
        return { error: 'Опрос должен содержать минимум 2 варианта' };
      }
      
      return await createPoll(roomId, userId, question, options, isAnonymous);
    }

    // Обработка упоминаний
    // Поддерживаем упоминания по username и display_name (с пробелами и Unicode символами)
    const mentions: string[] = [];
    // Регулярное выражение для упоминаний: @username или @display name (с пробелами)
    // Поддерживает Unicode символы, пробелы, но останавливается на знаках препинания
    // Используем более точное выражение: @ за которым следуют буквы/цифры/пробелы/Unicode, но не знаки препинания
    const mentionRegex = /@([^\s@.,!?;:()[\]{}'"]+[\w\s\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]*)/gu;
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionText = match[1].trim(); // Убираем пробелы в начале и конце
      
      if (!mentionText) continue;
      
      if (mentionText === 'admin') {
        const allUsers = await kv.getByPrefix('user:');
        const admins = allUsers.filter((u: User) => u.role === 'admin' && !u.deleted);
        mentions.push(...admins.map((u: User) => u.id));
      } else if (mentionText === 'moder') {
        const allUsers = await kv.getByPrefix('user:');
        const mods = allUsers.filter((u: User) => u.role === 'moderator' && !u.deleted);
        mentions.push(...mods.map((u: User) => u.id));
      } else {
        // Ищем по username или display_name (точное совпадение имеет приоритет)
        const allUsers = await kv.getByPrefix('user:');
        const query = mentionText.toLowerCase().trim();
        
        // Сначала ищем точное совпадение
        let mentionedUser = allUsers.find((u: User) => {
          if (u.deleted) return false;
          const username = u.username?.toLowerCase().trim() || '';
          const displayName = u.display_name?.toLowerCase().trim() || '';
          return username === query || displayName === query;
        });
        
        // Если точного совпадения нет, ищем частичное
        if (!mentionedUser) {
          mentionedUser = allUsers.find((u: User) => {
            if (u.deleted) return false;
            const username = u.username?.toLowerCase().trim() || '';
            const displayName = u.display_name?.toLowerCase().trim() || '';
            return username.includes(query) || displayName.includes(query);
          });
        }
        
        if (mentionedUser) {
          mentions.push(mentionedUser.id);
        }
      }
    }

    const messageId = crypto.randomUUID();
    const message: Message = {
      id: messageId,
      room_id: roomId,
      sender_id: userId,
      sender_username: user.username,
      sender_display_name: user.display_name,
      sender_avatar: (user as any).avatar,
      content,
      type,
      reply_to: replyTo,
      created_at: new Date().toISOString(),
      reactions: {},
      mentions: mentions.length > 0 ? mentions : undefined
    };

    await kv.set(`message:${messageId}`, message);
    
    // Добавляем в список сообщений комнаты
    const roomMessagesKey = `room_messages:${roomId}`;
    const roomMessages = await kv.get(roomMessagesKey) || [];
    (roomMessages as string[]).push(messageId);
    await kv.set(roomMessagesKey, roomMessages);

    // Инициализируем счетчики, если их нет
    if (!room.unread_mentions) {
      room.unread_mentions = {};
    }
    if (!room.unread_reactions) {
      room.unread_reactions = {};
    }
    if (!room.unread_count) {
      room.unread_count = {};
    }

    // Обновляем счетчики упоминаний в комнате
    if (mentions.length > 0) {
      mentions.forEach(mentionedUserId => {
        if (mentionedUserId !== userId) { // Не считаем упоминания себя
          room.unread_mentions![mentionedUserId] = (room.unread_mentions![mentionedUserId] || 0) + 1;
        }
      });
    }

    // Обновляем счетчик непрочитанных сообщений для всех участников кроме отправителя
    try {
      room.members.forEach(memberId => {
        if (memberId !== userId) {
          room.unread_count![memberId] = (room.unread_count![memberId] || 0) + 1;
        }
      });

      // Обновляем информацию о последнем сообщении и активности
      room.last_activity = message.created_at;
      room.last_message = {
        content: content.substring(0, 100), // Ограничиваем длину превью
        sender_username: user.display_name || user.username,
        created_at: message.created_at,
        type: message.type // Добавляем тип сообщения для правильного отображения в превью
      };

      // Сохраняем комнату с обновленными счетчиками в базу
      await kv.set(`room:${roomId}`, room);
      console.log(`Updated room ${roomId} counters: unread_mentions =`, room.unread_mentions, `unread_count =`, room.unread_count);
    } catch (roomUpdateError) {
      console.error('Error updating room counters:', roomUpdateError);
      // Не прерываем отправку сообщения, если не удалось обновить счетчики
    }

    return { data: message };
  } catch (err: any) {
    return { error: `Ошибка отправки сообщения: ${err.message}` };
  }
}

export async function getMessages(roomId: string, limit: number = 100) {
  try {
    const roomMessagesKey = `room_messages:${roomId}`;
    const messageIds = await kv.get(roomMessagesKey) || [];
    
    const messages = await Promise.all(
      (messageIds as string[])
        .slice(-limit)
        .map(id => kv.get(`message:${id}`))
    );

    // Фильтруем null и удаленные сообщения, и обогащаем актуальными данными пользователя
    const filteredMessages = messages.filter(m => m !== null && !(m as Message).deleted) as Message[];
    
    // Обогащаем сообщения актуальной информацией о пользователях
    const enrichedMessages = await Promise.all(
      filteredMessages.map(async (msg) => {
        const sender = await kv.get(`user:${msg.sender_id}`) as User;
        if (sender && !sender.deleted) {
          // Обновляем display_name и аватар из актуальных данных пользователя
          msg.sender_display_name = sender.display_name;
          msg.sender_username = sender.username;
          msg.sender_avatar = (sender as any).avatar;
        }
        return msg;
      })
    );
    
    return enrichedMessages;
  } catch (err: any) {
    console.error('Error getting messages:', err);
    return [];
  }
}

export async function addReaction(messageId: string, userId: string, emoji: string) {
  try {
    const message = await kv.get(`message:${messageId}`) as Message;
    if (!message) {
      return { error: 'Сообщение не найдено' };
    }

    // Нельзя реагировать на удаленные сообщения
    if (message.deleted) {
      return { error: 'Сообщение удалено' };
    }

    if (!message.reactions) {
      message.reactions = {};
    }

    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }

    if (!message.reactions[emoji].includes(userId)) {
      message.reactions[emoji].push(userId);
    }

    await kv.set(`message:${messageId}`, message);

    // Обновляем счетчик реакций в комнате для отправителя сообщения
    if (message.sender_id !== userId) { // Не считаем свои реакции
      const room = await kv.get(`room:${message.room_id}`) as Room;
      if (room) {
        if (!room.unread_reactions) {
          room.unread_reactions = {};
        }
        room.unread_reactions[message.sender_id] = (room.unread_reactions[message.sender_id] || 0) + 1;
        await kv.set(`room:${message.room_id}`, room);
      }
    }

    return { data: message };
  } catch (err: any) {
    return { error: `Ошибка добавления реакции: ${err.message}` };
  }
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  try {
    const message = await kv.get(`message:${messageId}`) as Message;
    if (!message) {
      return { error: 'Сообщение не найдено' };
    }

    // Нельзя убирать реакцию с удаленных сообщений
    if (message.deleted) {
      return { error: 'Сообщение удалено' };
    }

    // Если реакций нет или этой конкретной реакции нет - возвращаем успех (уже удалена)
    if (!message.reactions || !message.reactions[emoji]) {
      return { data: message }; // Возвращаем сообщение как есть, реакция уже удалена
    }
    
    // Проверяем, есть ли пользователь в списке реакций
    if (!message.reactions[emoji].includes(userId)) {
      return { data: message }; // Пользователь не ставил эту реакцию - возвращаем успех
    }

    // Удаляем пользователя из списка реакций
    message.reactions[emoji] = message.reactions[emoji].filter(id => id !== userId);

    // Если больше никто не поставил эту реакцию, удаляем её полностью
    if (message.reactions[emoji].length === 0) {
      delete message.reactions[emoji];
    }

    // Если реакций больше нет, удаляем объект reactions
    if (Object.keys(message.reactions).length === 0) {
      message.reactions = {};
    }

    await kv.set(`message:${messageId}`, message);
    return { data: message };
  } catch (err: any) {
    return { error: `Ошибка удаления реакции: ${err.message}` };
  }
}

export async function editMessage(messageId: string, userId: string, newContent: string) {
  try {
    const message = await kv.get(`message:${messageId}`) as Message;
    if (!message) {
      return { error: 'Сообщение не найдено' };
    }

    // Нельзя редактировать удаленные сообщения
    if (message.deleted) {
      return { error: 'Сообщение удалено' };
    }

    // Только автор может редактировать
    if (message.sender_id !== userId) {
      return { error: 'Только автор может редактировать сообщение' };
    }

    // Обновляем контент и упоминания
    const mentions: string[] = [];
    // Регулярное выражение для упоминаний: @username или @display name (с пробелами)
    // Поддерживает Unicode символы, пробелы, но останавливается на знаках препинания
    // Используем более точное выражение: @ за которым следуют буквы/цифры/пробелы/Unicode, но не знаки препинания
    const mentionRegex = /@([^\s@.,!?;:()[\]{}'"]+[\w\s\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]*)/gu;
    let match;
    
    while ((match = mentionRegex.exec(newContent)) !== null) {
      const mentionText = match[1].trim(); // Убираем пробелы в начале и конце
      
      if (!mentionText) continue;
      
      if (mentionText === 'admin') {
        const allUsers = await kv.getByPrefix('user:');
        const admins = allUsers.filter((u: User) => u.role === 'admin' && !u.deleted);
        mentions.push(...admins.map((u: User) => u.id));
      } else if (mentionText === 'moder') {
        const allUsers = await kv.getByPrefix('user:');
        const mods = allUsers.filter((u: User) => u.role === 'moderator' && !u.deleted);
        mentions.push(...mods.map((u: User) => u.id));
      } else {
        // Ищем по username или display_name (точное совпадение имеет приоритет)
        const allUsers = await kv.getByPrefix('user:');
        const query = mentionText.toLowerCase().trim();
        
        // Сначала ищем точное совпадение
        let mentionedUser = allUsers.find((u: User) => {
          if (u.deleted) return false;
          const username = u.username?.toLowerCase().trim() || '';
          const displayName = u.display_name?.toLowerCase().trim() || '';
          return username === query || displayName === query;
        });
        
        // Если точного совпадения нет, ищем частичное
        if (!mentionedUser) {
          mentionedUser = allUsers.find((u: User) => {
            if (u.deleted) return false;
            const username = u.username?.toLowerCase().trim() || '';
            const displayName = u.display_name?.toLowerCase().trim() || '';
            return username.includes(query) || displayName.includes(query);
          });
        }
        
        if (mentionedUser) {
          mentions.push(mentionedUser.id);
        }
      }
    }

    message.content = newContent;
    message.edited = true;
    message.edited_at = new Date().toISOString();
    message.mentions = mentions.length > 0 ? mentions : undefined;

    await kv.set(`message:${messageId}`, message);
    return { data: message };
  } catch (err: any) {
    return { error: `Ошибка редактирования сообщения: ${err.message}` };
  }
}

export async function deleteMessage(messageId: string, userId: string) {
  try {
    const message = await kv.get(`message:${messageId}`) as Message;
    if (!message) {
      return { error: 'Сообщение не найдено' };
    }

    if (message.deleted) {
      return { error: 'Сообщение уже удалено' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    
    // Может удалять: автор, модератор или админ
    if (message.sender_id !== userId && !['admin', 'moderator'].includes(user?.role)) {
      return { error: 'Недостаточно прав для удаления' };
    }

    // Мягкое удаление - помечаем сообщение как удаленное
    message.deleted = true;
    message.deleted_at = new Date().toISOString();
    message.deleted_by = userId;
    
    await kv.set(`message:${messageId}`, message);
    
    // Если это опрос, помечаем и его как удаленный
    const pollId = await kv.get(`poll_message:${messageId}`);
    if (pollId) {
      const poll = await kv.get(`poll:${pollId}`) as Poll;
      if (poll) {
        poll.deleted = true;
        poll.deleted_at = new Date().toISOString();
        poll.deleted_by = userId;
        await kv.set(`poll:${pollId}`, poll);
      }
    }

    return { data: { success: true } };
  } catch (err: any) {
    return { error: `Ошибка удаления сообщения: ${err.message}` };
  }
}

export async function searchMessages(roomId: string, query: string) {
  try {
    const messages = await getMessages(roomId, 1000);
    // getMessages уже фильтрует удаленные сообщения
    return messages.filter(msg => 
      msg.content.toLowerCase().includes(query.toLowerCase())
    );
  } catch (err: any) {
    console.error('Error searching messages:', err);
    return [];
  }
}

export async function createPoll(
  roomId: string,
  userId: string,
  question: string,
  options: string[],
  anonymous: boolean = false
) {
  try {
    console.log('createPoll called:', { roomId, userId, question, options, anonymous });
    
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    const room = await kv.get(`room:${roomId}`) as Room;
    if (!room) {
      return { error: 'Комната не найдена' };
    }

    const isAzkaban = room.name === '🔒 Азкабан';

    // Забаненные могут создавать опросы только в Азкабане
    if (user.banned && !isAzkaban) {
      return { error: 'Вы заблокированы' };
    }

    const muteCheck = await checkMute(user, userId);
    if (muteCheck.muted && !isAzkaban) {
      return { error: muteCheck.message || 'Вы в муте' };
    }

    // Проверка участника комнаты
    // Если пользователь не является участником, автоматически добавляем его для публичных комнат
    // Для DM комнат проверяем также dm_participants
    const isMember = room.members.includes(userId) || 
                     (room.type === 'dm' && room.dm_participants?.includes(userId));
    
    if (!isMember) {
      if (room.type === 'public') {
        // Автоматически добавляем в публичную комнату
        room.members.push(userId);
        await kv.set(`room:${roomId}`, room);
        console.log(`Auto-joined user ${userId} to public room ${roomId} (poll creation)`);
      } else if (room.type === 'dm' && room.dm_participants?.includes(userId)) {
        // Для DM комнат, если пользователь в dm_participants но не в members, добавляем в members
        room.members.push(userId);
        await kv.set(`room:${roomId}`, room);
        console.log(`Auto-added user ${userId} to DM room members ${roomId} (poll creation)`);
      } else {
        // Для приватных комнат требуется быть участником
        return { error: 'Вы не являетесь участником комнаты' };
      }
    }
    
    // Формируем текст опроса
    const anonymousTag = anonymous ? ' 🔒 [Анонимный]' : '';
    const pollText = `📊 ${question}${anonymousTag}

${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`;
    
    // Создаем сообщение напрямую (без вызова sendMessage чтобы избежать рекурсии)
    const messageId = crypto.randomUUID();
    const message: Message = {
      id: messageId,
      room_id: roomId,
      sender_id: userId,
      sender_username: user.username,
      sender_display_name: user.display_name,
      sender_avatar: (user as any).avatar,
      content: pollText,
      type: 'poll',
      created_at: new Date().toISOString(),
      reactions: {}
    };

    await kv.set(`message:${messageId}`, message);
    
    // Добавляем в список сообщений комнаты
    const roomMessagesKey = `room_messages:${roomId}`;
    const roomMessages = await kv.get(roomMessagesKey) || [];
    (roomMessages as string[]).push(messageId);
    await kv.set(roomMessagesKey, roomMessages);

    // Создаем опрос
    const pollId = messageId; // Используем ID сообщения как ID опроса
    const poll: Poll = {
      id: pollId,
      message_id: messageId,
      question,
      options,
      votes: {},
      anonymous,
      created_by: userId,
      created_at: new Date().toISOString()
    };

    console.log('Saving poll with ID:', pollId);
    await kv.set(`poll:${pollId}`, poll);
    await kv.set(`poll_message:${messageId}`, pollId);
    console.log('Poll saved successfully');

    return { data: { message, poll } };
  } catch (err: any) {
    console.error('createPoll error:', err);
    return { error: `Ошибка создания опроса: ${err.message}` };
  }
}

export async function votePoll(pollId: string, userId: string, optionIndex: number) {
  try {
    console.log('votePoll called:', { pollId, userId, optionIndex });
    
    const poll = await kv.get(`poll:${pollId}`) as Poll;
    console.log('Poll retrieved:', poll);
    
    if (!poll) {
      console.error('Poll not found for ID:', pollId);
      return { error: 'Опрос не найден' };
    }

    // Проверяем, не удален ли опрос
    if (poll.deleted) {
      return { error: 'Опрос удален' };
    }

    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      console.error('Invalid option index:', optionIndex, 'Options length:', poll.options.length);
      return { error: 'Недействительный вариант' };
    }

    // Проверяем, не голосовал ли пользователь уже
    for (const key in poll.votes) {
      if (poll.votes[key].includes(userId)) {
        console.log('User already voted:', userId);
        return { error: 'Вы уже проголосовали' };
      }
    }

    // Сохраняем голос
    const optKey = optionIndex.toString();
    if (!poll.votes[optKey]) {
      poll.votes[optKey] = [];
    }
    poll.votes[optKey].push(userId);
    console.log('Saving vote:', { pollId, optionIndex, userId });

    await kv.set(`poll:${pollId}`, poll);
    console.log('Vote saved successfully');
    
    return { data: poll };
  } catch (err: any) {
    console.error('votePoll error:', err);
    return { error: `Ошибка голосования: ${err.message}` };
  }
}

// Отметить комнату как прочитанную (сбросить счетчики)
export async function markRoomAsRead(roomId: string, userId: string, clearMentions: boolean = false, clearReactions: boolean = false) {
  try {
    const room = await kv.get(`room:${roomId}`) as Room;
    if (!room) {
      return { error: 'Комната не найдена' };
    }

    // Сбрасываем счетчик упоминаний
    if (clearMentions && room.unread_mentions && room.unread_mentions[userId]) {
      room.unread_mentions[userId] = 0;
    }

    // Сбрасываем счетчик реакций
    if (clearReactions && room.unread_reactions && room.unread_reactions[userId]) {
      room.unread_reactions[userId] = 0;
    }

    // Обновляем время последнего прочтения
    if (!room.last_read) {
      room.last_read = {};
    }
    room.last_read[userId] = new Date().toISOString();

    // Сбрасываем счетчик непрочитанных сообщений
    if (!room.unread_count) {
      room.unread_count = {};
    }
    room.unread_count[userId] = 0;

    await kv.set(`room:${roomId}`, room);

    return { data: { success: true } };
  } catch (err: any) {
    return { error: `Ошибка отметки комнаты: ${err.message}` };
  }
}
