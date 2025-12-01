import pb from './client';
import { User } from '../api';

// Типы для PocketBase коллекций
export interface PBUser {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  role: 'admin' | 'moderator' | 'vip' | 'user';
  avatar?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  last_activity?: string;
  banned?: boolean;
  ban_until?: string;
  muted?: boolean;
  mute_until?: string;
  friends?: string[];
  blocked_users?: string[];
  public_key?: string;
  room_keys?: Record<string, any>;
  created: string;
  updated: string;
}

export interface PBRoom {
  id: string;
  name: string;
  type: 'public' | 'private' | 'dm';
  created_by: string;
  members?: string[];
  pinned_message_id?: string;
  dm_participants?: string[];
  unread_mentions?: Record<string, number>;
  unread_reactions?: Record<string, number>;
  unread_count?: Record<string, number>;
  last_message?: any;
  last_activity?: string;
  last_read?: Record<string, string>;
  created: string;
  updated: string;
}

export interface PBMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content?: string;
  encrypted_content?: string;
  type: 'text' | 'audio' | 'video' | 'file' | 'poll';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  audio_duration?: number;
  video_duration?: number;
  poll_question?: string;
  poll_options?: any[];
  poll_votes?: Record<string, string>;
  reactions?: Record<string, string[]>;
  mentions?: string[];
  reply_to?: string;
  edited?: boolean;
  edited_at?: string;
  deleted?: boolean;
  created: string;
  updated: string;
}

// Конвертация PocketBase User в User приложения
export function convertPBUserToUser(pbUser: any): User {
  return {
    id: pbUser.id,
    email: pbUser.email,
    username: pbUser.username,
    display_name: pbUser.display_name || pbUser.username,
    role: pbUser.role || 'user',
    avatar: pbUser.avatar ? pb.files.getUrl(pbUser, pbUser.avatar) : undefined,
    status: pbUser.status || 'offline',
    last_activity: pbUser.last_activity,
    banned: pbUser.banned || false,
    ban_until: pbUser.ban_until,
    muted: pbUser.muted || false,
    mute_until: pbUser.mute_until,
    friends: pbUser.friends || [],
    blocked_users: pbUser.blocked_users || [],
    public_key: pbUser.public_key,
    room_keys: pbUser.room_keys || {}
  };
}

// Auth Services
export const pbAuthService = {
  // Регистрация
  async signup(email: string, password: string, username: string): Promise<{ user: User; access_token: string }> {
    try {
      // Создаем пользователя
      const record = await pb.collection('users').create({
        email,
        username,
        password,
        passwordConfirm: password,
        role: 'user',
        status: 'online',
        emailVisibility: true
      });

      // Авторизуемся
      const authData = await pb.collection('users').authWithPassword(email, password);
      
      return {
        user: convertPBUserToUser(authData.record),
        access_token: authData.token
      };
    } catch (error: any) {
      console.error('PocketBase signup error:', error);
      
      // Обработка ошибок
      if (error.data?.data) {
        const errorData = error.data.data;
        if (errorData.email) {
          throw new Error('Email уже используется');
        }
        if (errorData.username) {
          throw new Error('Имя пользователя уже занято');
        }
      }
      
      throw new Error(error.message || 'Ошибка регистрации');
    }
  },

  // Вход
  async signin(email: string, password: string): Promise<{ user: User; access_token: string }> {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      
      // Обновляем статус на online
      await pb.collection('users').update(authData.record.id, {
        status: 'online',
        last_activity: new Date().toISOString()
      });
      
      return {
        user: convertPBUserToUser(authData.record),
        access_token: authData.token
      };
    } catch (error: any) {
      console.error('PocketBase signin error:', error);
      
      if (error.status === 400) {
        throw new Error('Неверный email или пароль');
      }
      
      throw new Error(error.message || 'Ошибка входа');
    }
  },

  // Выход
  async signout(): Promise<void> {
    try {
      // Обновляем статус на offline перед выходом
      if (pb.authStore.model) {
        await pb.collection('users').update(pb.authStore.model.id, {
          status: 'offline'
        });
      }
    } catch (error) {
      console.error('Error updating status on signout:', error);
    }
    
    pb.authStore.clear();
  },

  // Получить текущего пользователя
  async getMe(): Promise<{ user: User }> {
    try {
      if (!pb.authStore.model) {
        throw new Error('Не авторизован');
      }
      
      // Получаем актуальные данные пользователя
      const record = await pb.collection('users').getOne(pb.authStore.model.id);
      
      return {
        user: convertPBUserToUser(record)
      };
    } catch (error: any) {
      console.error('PocketBase getMe error:', error);
      throw new Error(error.message || 'Ошибка получения данных пользователя');
    }
  },

  // Обновить последнюю активность
  async updateLastActivity(): Promise<void> {
    try {
      if (!pb.authStore.model) {
        return;
      }
      
      await pb.collection('users').update(pb.authStore.model.id, {
        last_activity: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating last activity:', error);
    }
  },

  // Обновить профиль
  async updateProfile(data: {
    username?: string;
    display_name?: string;
    avatar?: File;
    status?: 'online' | 'offline' | 'away' | 'busy';
  }): Promise<User> {
    try {
      if (!pb.authStore.model) {
        throw new Error('Не авторизован');
      }

      const formData = new FormData();
      
      if (data.username) formData.append('username', data.username);
      if (data.display_name) formData.append('display_name', data.display_name);
      if (data.status) formData.append('status', data.status);
      if (data.avatar) formData.append('avatar', data.avatar);

      const record = await pb.collection('users').update(pb.authStore.model.id, formData);
      
      return convertPBUserToUser(record);
    } catch (error: any) {
      console.error('PocketBase updateProfile error:', error);
      throw new Error(error.message || 'Ошибка обновления профиля');
    }
  }
};

// Rooms Services
export const pbRoomsService = {
  // Получить все комнаты пользователя
  async getRooms(): Promise<any[]> {
    try {
      if (!pb.authStore.model) {
        throw new Error('Не авторизован');
      }

      const userId = pb.authStore.model.id;
      
      // Получаем все комнаты где пользователь создатель или участник
      const rooms = await pb.collection('rooms').getFullList({
        filter: `created_by = "${userId}" || members ~ "${userId}"`,
        sort: '-last_activity',
        expand: 'created_by'
      });

      return rooms;
    } catch (error: any) {
      console.error('PocketBase getRooms error:', error);
      throw new Error(error.message || 'Ошибка получения комнат');
    }
  },

  // Создать комнату
  async createRoom(data: {
    name: string;
    type: 'public' | 'private' | 'dm';
    members?: string[];
  }): Promise<any> {
    try {
      if (!pb.authStore.model) {
        throw new Error('Не авторизован');
      }

      const record = await pb.collection('rooms').create({
        name: data.name,
        type: data.type,
        created_by: pb.authStore.model.id,
        members: data.members || [pb.authStore.model.id],
        last_activity: new Date().toISOString()
      });

      return record;
    } catch (error: any) {
      console.error('PocketBase createRoom error:', error);
      throw new Error(error.message || 'Ошибка создания комнаты');
    }
  }
};

// Messages Services
export const pbMessagesService = {
  // Получить сообщения комнаты
  async getMessages(roomId: string, limit: number = 50): Promise<any[]> {
    try {
      const messages = await pb.collection('messages').getList(1, limit, {
        filter: `room_id = "${roomId}"`,
        sort: '-created',
        expand: 'sender_id'
      });

      return messages.items;
    } catch (error: any) {
      console.error('PocketBase getMessages error:', error);
      throw new Error(error.message || 'Ошибка получения сообщений');
    }
  },

  // Отправить сообщение
  async sendMessage(data: {
    room_id: string;
    content?: string;
    encrypted_content?: string;
    type: 'text' | 'audio' | 'video' | 'file' | 'poll';
    file?: File;
    mentions?: string[];
    reply_to?: string;
  }): Promise<any> {
    try {
      if (!pb.authStore.model) {
        throw new Error('Не авторизован');
      }

      const formData = new FormData();
      
      formData.append('room_id', data.room_id);
      formData.append('sender_id', pb.authStore.model.id);
      formData.append('type', data.type);
      
      if (data.content) formData.append('content', data.content);
      if (data.encrypted_content) formData.append('encrypted_content', data.encrypted_content);
      if (data.file) formData.append('file', data.file);
      if (data.mentions) formData.append('mentions', JSON.stringify(data.mentions));
      if (data.reply_to) formData.append('reply_to', data.reply_to);

      const record = await pb.collection('messages').create(formData);

      return record;
    } catch (error: any) {
      console.error('PocketBase sendMessage error:', error);
      throw new Error(error.message || 'Ошибка отправки сообщения');
    }
  },

  // Подписаться на новые сообщения в комнате
  subscribeToMessages(roomId: string, callback: (data: any) => void) {
    pb.collection('messages').subscribe('*', (e) => {
      if (e.record.room_id === roomId) {
        callback(e);
      }
    });
  },

  // Отписаться от сообщений
  unsubscribeFromMessages() {
    pb.collection('messages').unsubscribe();
  }
};

// Users Services
export const pbUsersService = {
  // Получить пользователя по ID
  async getUser(userId: string): Promise<User> {
    try {
      const record = await pb.collection('users').getOne(userId);
      return convertPBUserToUser(record);
    } catch (error: any) {
      console.error('PocketBase getUser error:', error);
      throw new Error(error.message || 'Ошибка получения пользователя');
    }
  },

  // Поиск пользователей
  async searchUsers(query: string): Promise<User[]> {
    try {
      const records = await pb.collection('users').getFullList({
        filter: `username ~ "${query}" || email ~ "${query}"`,
        sort: 'username'
      });

      return records.map(convertPBUserToUser);
    } catch (error: any) {
      console.error('PocketBase searchUsers error:', error);
      throw new Error(error.message || 'Ошибка поиска пользователей');
    }
  }
};

export default {
  auth: pbAuthService,
  rooms: pbRoomsService,
  messages: pbMessagesService,
  users: pbUsersService
};
