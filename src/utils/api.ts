import pb from './pocketbase/client';

// Базовая функция для API вызовов (deprecated - используйте PocketBase services)
// Оставлена для совместимости с модулем достижений
export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  console.warn('fetchAPI is deprecated. Please use PocketBase services instead.');
  
  // Для достижений используем PocketBase напрямую
  // TODO: Переписать систему достижений на PocketBase services
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Используем токен из PocketBase если есть
  const token = pb.authStore.token;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    // Временное решение: вызываем PocketBase API напрямую
    // В будущем заменить на полноценные PocketBase services
    const response = await fetch(`${pb.baseUrl}/api/collections/${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`API Error: ${endpoint}`, error);
    throw error;
  }
}

// API работает напрямую с PocketBase, без промежуточного сервера
export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string; // Отображаемое имя (может быть на русском)
  role: 'admin' | 'moderator' | 'vip' | 'user';
  avatar_url?: string;
  avatar?: string; // URL аватара
  status: 'online' | 'offline';
  last_activity?: string; // Время последней активности
  created_at: string;
  banned?: boolean;
  ban_until?: string; // До какого времени забанен
  muted?: boolean;
  mute_until?: string; // До какого времени заглушен
  friends?: string[];
  blocked_users?: string[]; // Array of blocked user IDs
  public_key?: string; // RSA публичный ключ для E2EE
}

export interface Room {
  id: string;
  name: string;
  type: 'public' | 'private' | 'dm';
  created_by: string;
  created_at: string;
  members: string[];
  pinned_message_id?: string;
  isGodMode?: boolean;
  dm_participants?: string[];
  unread_mentions?: Record<string, number>;
  unread_reactions?: Record<string, number>;
  unread_count?: Record<string, number>; // Счетчик непрочитанных сообщений для каждого пользователя
  last_message?: {
    content: string;
    sender_username: string;
    created_at: string;
  };
  last_activity?: string; // Время последней активности
  last_read?: Record<string, string>; // Время последнего прочтения для каждого пользователя
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_username: string;
  sender_display_name?: string; // Отображаемое имя (может быть на русском)
  sender_avatar?: string;
  content: string;
  type: 'text' | 'audio' | 'video' | 'poll' | 'voice' | 'image' | 'file';
  reply_to?: string;
  created_at: string;
  updated_at?: string;
  reactions?: Record<string, string[]>;
  forwarded?: boolean;
  mentions?: string[];
  edited?: boolean;
  edited_at?: string;
}

// Этот файл больше не используется для прямых API вызовов
// Вместо него используйте напрямую /utils/pocketbase/services.ts

// Auth APIs - deprecated, используйте /utils/pocketbase/services.ts
export const authAPI = {
  signup: async (email: string, password: string, username: string) => {
    throw new Error('Use PocketBase services instead: import { authService } from "./pocketbase/services"');
  },
  signin: async (email: string, password: string) => {
    throw new Error('Use PocketBase services instead: import { authService } from "./pocketbase/services"');
  },
  getMe: async () => {
    throw new Error('Use PocketBase services instead: import { authService } from "./pocketbase/services"');
  },
  signout: async () => {
    throw new Error('Use PocketBase services instead: import { authService } from "./pocketbase/services"');
  },
  updateLastActivity: async () => {
    throw new Error('Use PocketBase services instead: import { authService } from "./pocketbase/services"');
  },
  refreshToken: async (refresh_token: string) => {
    throw new Error('Use PocketBase services instead: import { authService } from "./pocketbase/services"');
  },
};

// Users APIs - deprecated
export const usersAPI = {
  search: async (query: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  getById: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  updateRole: async (userId: string, role: User['role']) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  ban: async (userId: string, hours?: number) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  unban: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  mute: async (userId: string, hours?: number) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  unmute: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  addFriend: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  removeFriend: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  getFriends: async () => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  sendFriendRequest: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  checkFriendRequest: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  acceptFriendRequest: async (requestKey: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  rejectFriendRequest: async (requestKey: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  changePassword: async (oldPassword: string, newPassword: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  changeEmail: async (newEmail: string, password: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  updateProfile: async (updates: { display_name?: string; gender?: string; age?: number; interests?: string; privacySettings?: any }) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  uploadAvatar: async (file: File): Promise<{ user: User; avatarUrl: string }> => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  deleteUser: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  blockUser: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  unblockUser: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  updatePublicKey: async (publicKey: string) => {
    throw new Error('Use PocketBase services instead: import { userService } from "./pocketbase/services"');
  },
  getRoomKey: async (roomId: string) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  saveRoomKeys: async (roomId: string, encryptedKeys: { [userId: string]: string }) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
};

// Admin APIs - deprecated
export const adminAPI = {
  clearData: async () => {
    throw new Error('Use PocketBase services instead: import { adminService } from "./pocketbase/services"');
  },
};

// Rooms APIs - deprecated
export const roomsAPI = {
  create: async (name: string, type: 'public' | 'private') => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  getAll: async (godMode?: boolean) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  join: async (roomId: string, godMode?: boolean) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  leave: async (roomId: string) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  invite: async (roomId: string, userId: string) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  pinMessage: async (roomId: string, messageId: string) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  unpinMessage: async (roomId: string) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  getOrCreateDM: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  markAsRead: async (roomId: string, clearMentions?: boolean, clearReactions?: boolean) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  delete: async (roomId: string) => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
  cleanupAzkaban: async () => {
    throw new Error('Use PocketBase services instead: import { adminService } from "./pocketbase/services"');
  },
  getOrCreateFavorites: async () => {
    throw new Error('Use PocketBase services instead: import { roomService } from "./pocketbase/services"');
  },
};

// Messages APIs - deprecated
export const messagesAPI = {
  send: async (roomId: string, content: string, type: Message['type'] = 'text', replyTo?: string) => {
    throw new Error('Use PocketBase services instead: import { messageService } from "./pocketbase/services"');
  },
  get: async (roomId: string, limit: number = 100, godMode: boolean = false) => {
    throw new Error('Use PocketBase services instead: import { messageService } from "./pocketbase/services"');
  },
  edit: async (messageId: string, content: string) => {
    throw new Error('Use PocketBase services instead: import { messageService } from "./pocketbase/services"');
  },
  delete: async (messageId: string) => {
    throw new Error('Use PocketBase services instead: import { messageService } from "./pocketbase/services"');
  },
  addReaction: async (messageId: string, emoji: string) => {
    throw new Error('Use PocketBase services instead: import { messageService } from "./pocketbase/services"');
  },
  search: async (roomId: string, query: string) => {
    throw new Error('Use PocketBase services instead: import { messageService } from "./pocketbase/services"');
  },
};

// Polls APIs - deprecated
export const pollsAPI = {
  create: async (roomId: string, question: string, options: string[], anonymous: boolean = false) => {
    throw new Error('Use PocketBase services instead: import { pollService } from "./pocketbase/services"');
  },
  get: async (pollId: string) => {
    throw new Error('Use PocketBase services instead: import { pollService } from "./pocketbase/services"');
  },
  vote: async (pollId: string, optionIndex: number) => {
    throw new Error('Use PocketBase services instead: import { pollService } from "./pocketbase/services"');
  },
};

// Notifications APIs
export interface Notification {
  id: string;
  userId: string;
  type: 'friend_request' | 'friend_accepted' | 'mention' | 'reaction' | 'room_invite';
  fromUserId?: string;
  fromUsername?: string;
  roomId?: string;
  roomName?: string;
  messageId?: string;
  content?: string;
  read: boolean;
  createdAt: string;
  actionData?: any;
}

export const notificationsAPI = {
  getAll: async () => {
    throw new Error('Use PocketBase services instead: import { notificationService } from "./pocketbase/services"');
  },
  markAsRead: async (notificationId: string) => {
    throw new Error('Use PocketBase services instead: import { notificationService } from "./pocketbase/services"');
  },
  delete: async (notificationId: string) => {
    throw new Error('Use PocketBase services instead: import { notificationService } from "./pocketbase/services"');
  },
};

// Storage APIs - deprecated
export const storageAPI = {
  uploadFile: async (file: File): Promise<{ url: string; path: string }> => {
    throw new Error('Use PocketBase services instead: import { storageService } from "./pocketbase/services"');
  },
};

// Direct Messages APIs
export interface DirectMessage {
  id: string;
  participants: [string, string];
  created_at: string;
  last_message?: {
    content: string;
    sender_id: string;
    sender_username: string;
    created_at: string;
  };
  last_activity?: string;
  unread_count?: Record<string, number>;
  last_read?: Record<string, string>;
}

export const dmAPI = {
  create: async (userId: string) => {
    throw new Error('Use PocketBase services instead: import { dmService } from "./pocketbase/services"');
  },
  getAll: async () => {
    throw new Error('Use PocketBase services instead: import { dmService } from "./pocketbase/services"');
  },
  sendMessage: async (dmId: string, content: string, type: Message['type'] = 'text', replyTo?: string) => {
    throw new Error('Use PocketBase services instead: import { dmService } from "./pocketbase/services"');
  },
  getMessages: async (dmId: string, limit: number = 100) => {
    throw new Error('Use PocketBase services instead: import { dmService } from "./pocketbase/services"');
  },
  markAsRead: async (dmId: string) => {
    throw new Error('Use PocketBase services instead: import { dmService } from "./pocketbase/services"');
  },
  delete: async (dmId: string) => {
    throw new Error('Use PocketBase services instead: import { dmService } from "./pocketbase/services"');
  },
};