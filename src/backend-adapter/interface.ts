/**
 * Универсальный Backend Adapter Interface
 * Позволяет легко менять бэкенд без изменения frontend кода
 */

export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  role: 'admin' | 'moderator' | 'vip' | 'user';
  avatar_url?: string;
  status: 'online' | 'offline';
  last_activity?: string;
  created_at: string;
  banned?: boolean;
  ban_until?: string;
  muted?: boolean;
  mute_until?: string;
  friends?: string[];
  blocked_users?: string[];
  public_key?: string; // E2EE
  room_keys?: Record<string, string>; // E2EE
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
  unread_count?: Record<string, number>;
  last_message?: {
    content: string;
    sender_username: string;
    created_at: string;
  };
  last_activity?: string;
  last_read?: Record<string, string>;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_username: string;
  sender_display_name?: string;
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

export interface DirectMessage {
  id: string;
  participants: string[];
  created_at: string;
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
  unread_count?: Record<string, number>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked_at?: string;
}

/**
 * Основной интерфейс Backend Adapter
 */
export interface IBackendAdapter {
  // ============ AUTH ============
  signup(email: string, password: string, username: string): Promise<{ user: User; access_token: string }>;
  signin(email: string, password: string): Promise<{ user: User; access_token: string }>;
  signout(): Promise<void>;
  getMe(): Promise<{ user: User }>;
  refreshToken(refreshToken: string): Promise<{ access_token: string }>;

  // ============ USERS ============
  searchUsers(query: string): Promise<{ users: User[] }>;
  getUserById(userId: string): Promise<{ user: User }>;
  updateUserProfile(updates: Partial<User>): Promise<{ user: User }>;
  updateUserRole(userId: string, role: User['role']): Promise<{ user: User }>;
  banUser(userId: string, hours?: number): Promise<void>;
  unbanUser(userId: string): Promise<void>;
  muteUser(userId: string, hours?: number): Promise<void>;
  unmuteUser(userId: string): Promise<void>;
  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;
  uploadAvatar(file: File): Promise<{ avatarUrl: string }>;

  // ============ ROOMS ============
  getRooms(): Promise<{ rooms: Room[] }>;
  createRoom(name: string, type: Room['type'], memberIds?: string[]): Promise<{ room: Room }>;
  joinRoom(roomId: string): Promise<void>;
  leaveRoom(roomId: string): Promise<void>;
  inviteToRoom(roomId: string, userId: string): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  pinMessage(roomId: string, messageId: string): Promise<void>;
  unpinMessage(roomId: string): Promise<void>;
  markAsRead(roomId: string, clearMentions?: boolean, clearReactions?: boolean): Promise<void>;

  // ============ MESSAGES ============
  getMessages(roomId: string, limit?: number): Promise<{ messages: Message[] }>;
  sendMessage(roomId: string, content: string, type: Message['type'], replyTo?: string): Promise<{ message: Message }>;
  editMessage(messageId: string, content: string): Promise<{ message: Message }>;
  deleteMessage(messageId: string): Promise<void>;
  addReaction(messageId: string, emoji: string): Promise<void>;
  removeReaction(messageId: string, emoji: string): Promise<void>;
  forwardMessage(messageId: string, targetRoomId: string): Promise<void>;
  searchMessages(query: string): Promise<{ messages: Message[] }>;

  // ============ DIRECT MESSAGES ============
  getDirectMessages(): Promise<{ dms: DirectMessage[] }>;
  createDirectMessage(userId: string): Promise<{ dm: DirectMessage }>;
  getDMMessages(dmId: string, limit?: number): Promise<{ messages: Message[] }>;
  sendDMMessage(dmId: string, content: string, type: Message['type']): Promise<{ message: Message }>;

  // ============ FRIENDS ============
  getFriends(): Promise<{ users: User[] }>;
  sendFriendRequest(userId: string): Promise<void>;
  acceptFriendRequest(requestId: string): Promise<void>;
  rejectFriendRequest(requestId: string): Promise<void>;
  removeFriend(userId: string): Promise<void>;

  // ============ E2EE ============
  updatePublicKey(publicKey: string): Promise<void>;
  getRoomKey(roomId: string): Promise<{ encryptedKey: string | null }>;
  saveRoomKeys(roomId: string, encryptedKeys: Record<string, string>): Promise<void>;

  // ============ ACHIEVEMENTS ============
  getAchievements(): Promise<{ achievements: Achievement[] }>;
  unlockAchievement(achievementId: string): Promise<void>;

  // ============ REALTIME ============
  subscribeToRoom(roomId: string, callback: (message: Message) => void): () => void;
  subscribeToUserStatus(userId: string, callback: (status: User['status']) => void): () => void;
  subscribeToRoomUpdates(callback: (rooms: Room[]) => void): () => void;

  // ============ STORAGE ============
  uploadFile(file: File, path: string): Promise<{ url: string }>;
  deleteFile(path: string): Promise<void>;
  getFileUrl(path: string): Promise<{ url: string }>;
}

/**
 * Конфигурация Backend
 */
export interface BackendConfig {
  type: 'supabase' | 'pocketbase' | 'firebase' | 'custom';
  url: string;
  apiKey?: string;
  features: {
    realtime: boolean;
    fileUpload: boolean;
    voiceVideo: boolean;
    e2ee: boolean;
  };
}

/**
 * Response types
 */
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}
