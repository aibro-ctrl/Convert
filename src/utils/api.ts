import { projectId, publicAnonKey } from './supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b0f1e6d5`;

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
  friends?: string[];
  blocked_users?: string[]; // Array of blocked user IDs
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
  type: 'text' | 'audio' | 'video' | 'poll' | 'voice';
  reply_to?: string;
  created_at: string;
  reactions?: Record<string, string[]>;
  forwarded?: boolean;
  mentions?: string[];
  edited?: boolean;
  edited_at?: string;
}

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token');
  console.log(`fetchAPI: Token from localStorage:`, token ? token.substring(0, 20) + '...' : 'null');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Use user token if available, otherwise use anon key for public endpoints
  // Supabase Edge Functions require Authorization header for all requests
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log(`fetchAPI: Using user token for ${endpoint}`);
  } else {
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
    console.log(`fetchAPI: Using anon key for ${endpoint}`);
  }

  const url = `${API_URL}${endpoint}`;
  console.log(`API Call: ${endpoint}`, { 
    method: options.method || 'GET',
    url,
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, typeof v === 'string' && k === 'Authorization' ? v.substring(0, 30) + '...' : v]))
  });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log(`API Response: ${endpoint}`, { 
      status: response.status, 
      ok: response.ok,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    });

    if (!response.ok) {
      // Try to parse as JSON first
      let error;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        error = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      } else {
        // Not JSON, maybe HTML error page
        const text = await response.text();
        console.error(`API ${endpoint}: Non-JSON response:`, text.substring(0, 200));
        error = { error: `Server error: ${response.status} ${response.statusText}` };
      }
      
      // Не логируем 401 ошибки как критические - это ожидаемо при отсутствии токена
      if (response.status === 401) {
        console.log(`API ${endpoint}: Unauthorized (expected when not logged in)`);
      } else {
        console.error(`API Error: ${endpoint}`, error);
      }
      
      throw new Error(error.error || `Request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log(`API Data: ${endpoint}`, data);
    return data;
  } catch (error: any) {
    // Network error or other fetch error
    if (error.message && !error.message.includes('Request failed')) {
      console.error(`API Network Error: ${endpoint}`, error);
      throw new Error(`Network error: ${error.message}`);
    }
    throw error;
  }
}

// Auth APIs
export const authAPI = {
  signup: (email: string, password: string, username: string) =>
    fetchAPI('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    }),

  signin: (email: string, password: string) =>
    fetchAPI('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => fetchAPI('/auth/me'),

  signout: () => 
    fetchAPI('/auth/signout', {
      method: 'POST',
    }),

  updateLastActivity: () =>
    fetchAPI('/auth/activity', {
      method: 'POST',
    }),
  
  refreshToken: (refresh_token: string) =>
    fetchAPI('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token }),
    }),
};

// Users APIs
export const usersAPI = {
  search: (query: string) => fetchAPI(`/users/search?q=${encodeURIComponent(query)}`),

  getById: (userId: string) => fetchAPI(`/users/${userId}`),

  updateRole: (userId: string, role: User['role']) =>
    fetchAPI(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  ban: (userId: string, hours?: number) =>
    fetchAPI(`/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ hours }),
    }),

  unban: (userId: string) =>
    fetchAPI(`/users/${userId}/unban`, {
      method: 'POST',
    }),

  mute: (userId: string, hours?: number) =>
    fetchAPI(`/users/${userId}/mute`, {
      method: 'POST',
      body: JSON.stringify({ hours: hours || 24 }),
    }),

  unmute: (userId: string) =>
    fetchAPI(`/users/${userId}/unmute`, {
      method: 'POST',
    }),

  addFriend: (userId: string) =>
    fetchAPI(`/users/${userId}/friend`, {
      method: 'POST',
    }),

  removeFriend: (userId: string) =>
    fetchAPI(`/users/${userId}/friend`, {
      method: 'DELETE',
    }),

  getFriends: () => fetchAPI('/users/friends/list'),
  
  sendFriendRequest: (userId: string) =>
    fetchAPI(`/friend-requests/${userId}`, {
      method: 'POST',
    }),

  checkFriendRequest: (userId: string) =>
    fetchAPI(`/friend-requests/${userId}/check`),

  acceptFriendRequest: (requestKey: string) =>
    fetchAPI(`/friend-requests/${requestKey}/accept`, {
      method: 'POST',
    }),

  rejectFriendRequest: (requestKey: string) =>
    fetchAPI(`/friend-requests/${requestKey}/reject`, {
      method: 'POST',
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    fetchAPI('/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),

  changeEmail: (newEmail: string, password: string) =>
    fetchAPI('/profile/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail, password }),
    }),

  updateProfile: (updates: { display_name?: string; gender?: string; age?: number; interests?: string; privacySettings?: any }) =>
    fetchAPI('/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  uploadAvatar: async (file: File): Promise<{ user: User; avatarUrl: string }> => {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      throw new Error('Authentication required for avatar upload');
    }
    
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`
    };

    console.log('Uploading avatar file:', file.name, file.size, file.type);

    const response = await fetch(`${API_URL}/profile/avatar`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      console.error('Avatar upload failed:', error);
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    console.log('Avatar upload response:', {
      avatarUrl: result.avatarUrl?.substring(0, 100) + '...',
      userHasAvatar: !!result.user?.avatar
    });
    
    return result;
  },

  deleteUser: (userId: string) =>
    fetchAPI(`/users/${userId}/permanent`, {
      method: 'DELETE',
    }),

  blockUser: (userId: string) =>
    fetchAPI(`/users/${userId}/block`, {
      method: 'POST',
    }),

  unblockUser: (userId: string) =>
    fetchAPI(`/users/${userId}/unblock`, {
      method: 'POST',
    }),
};

// Admin APIs
export const adminAPI = {
  clearData: () =>
    fetchAPI('/admin/clear-data', {
      method: 'POST',
    }),
};

// Rooms APIs
export const roomsAPI = {
  create: (name: string, type: 'public' | 'private') =>
    fetchAPI('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    }),

  getAll: (godMode?: boolean) => fetchAPI(`/rooms${godMode ? '?godMode=true' : ''}`),

  join: (roomId: string, godMode?: boolean) =>
    fetchAPI(`/rooms/${roomId}/join${godMode ? '?godMode=true' : ''}`, {
      method: 'POST',
    }),

  leave: (roomId: string) =>
    fetchAPI(`/rooms/${roomId}/leave`, {
      method: 'POST',
    }),

  invite: (roomId: string, userId: string) =>
    fetchAPI(`/rooms/${roomId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  pinMessage: (roomId: string, messageId: string) =>
    fetchAPI(`/rooms/${roomId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    }),

  unpinMessage: (roomId: string) =>
    fetchAPI(`/rooms/${roomId}/pin`, {
      method: 'DELETE',
    }),

  getOrCreateDM: (userId: string) =>
    fetchAPI('/rooms/dm', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  markAsRead: (roomId: string, clearMentions?: boolean, clearReactions?: boolean) =>
    fetchAPI(`/rooms/${roomId}/mark-read`, {
      method: 'POST',
      body: JSON.stringify({ clearMentions, clearReactions }),
    }),

  delete: (roomId: string) =>
    fetchAPI(`/rooms/${roomId}`, {
      method: 'DELETE',
    }),

  cleanupAzkaban: () =>
    fetchAPI('/admin/cleanup-azkaban', {
      method: 'POST',
    }),

  getOrCreateFavorites: () =>
    fetchAPI('/rooms/favorites', {
      method: 'POST',
    }),
};

// Messages APIs
export const messagesAPI = {
  send: (roomId: string, content: string, type: Message['type'] = 'text', replyTo?: string) =>
    fetchAPI('/messages', {
      method: 'POST',
      body: JSON.stringify({ roomId, content, type, replyTo }),
    }),

  get: (roomId: string, limit: number = 100, godMode: boolean = false) =>
    fetchAPI(`/messages/${roomId}?limit=${limit}${godMode ? '&godMode=true' : ''}`),

  edit: (messageId: string, content: string) =>
    fetchAPI(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  delete: (messageId: string) =>
    fetchAPI(`/messages/${messageId}`, {
      method: 'DELETE',
    }),

  addReaction: (messageId: string, emoji: string) =>
    fetchAPI(`/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  search: (roomId: string, query: string) =>
    fetchAPI(`/messages/${roomId}/search?q=${encodeURIComponent(query)}`),
};

// Polls APIs
export const pollsAPI = {
  create: (roomId: string, question: string, options: string[], anonymous: boolean = false) =>
    fetchAPI('/polls', {
      method: 'POST',
      body: JSON.stringify({ roomId, question, options, anonymous }),
    }),

  get: (pollId: string) => fetchAPI(`/polls/${pollId}`),

  vote: (pollId: string, optionIndex: number) =>
    fetchAPI(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionIndex }),
    }),
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
  getAll: () => fetchAPI('/notifications'),

  markAsRead: (notificationId: string) =>
    fetchAPI(`/notifications/${notificationId}/read`, {
      method: 'POST',
    }),

  delete: (notificationId: string) =>
    fetchAPI(`/notifications/${notificationId}`, {
      method: 'DELETE',
    }),
};

// Storage APIs
export const storageAPI = {
  uploadFile: async (file: File): Promise<{ url: string; path: string }> => {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      throw new Error('Authentication required for file upload');
    }
    
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(`${API_URL}/storage/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return await response.json();
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
  // Создать или получить DM с пользователем
  create: (userId: string) =>
    fetchAPI('/dm/create', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Получить список всех DM
  getAll: () => fetchAPI('/dm/list'),

  // Отправить сообщение в DM
  sendMessage: (dmId: string, content: string, type: Message['type'] = 'text', replyTo?: string) =>
    fetchAPI(`/dm/${dmId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type, replyTo }),
    }),

  // Получить сообщения из DM
  getMessages: (dmId: string, limit: number = 100) =>
    fetchAPI(`/dm/${dmId}/messages?limit=${limit}`),

  // Отметить DM как прочитанный
  markAsRead: (dmId: string) =>
    fetchAPI(`/dm/${dmId}/read`, {
      method: 'POST',
    }),

  // Удалить DM (скрыть для пользователя)
  delete: (dmId: string) =>
    fetchAPI(`/dm/${dmId}`, {
      method: 'DELETE',
    }),
};
