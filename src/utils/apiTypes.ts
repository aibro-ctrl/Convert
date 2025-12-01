// Типы ответов API для PocketBase
import { User, Room, Message } from './api';

// Общий тип ответа с данными
export interface ApiResponse<T> {
  [key: string]: T;
}

// Типы ответов для пользователей
export interface UserResponse {
  user: User;
}

export interface UsersResponse {
  users: User[];
}

// Типы ответов для комнат
export interface RoomResponse {
  room: Room;
}

export interface RoomsResponse {
  rooms: Room[];
}

// Типы ответов для сообщений
export interface MessageResponse {
  message: Message;
}

export interface MessagesResponse {
  messages: Message[];
}

// Типы ответов для директ-месседжей
export interface DirectMessage extends Room {
  type: 'dm';
  dm_participants: string[];
  last_message?: {
    id: string;
    content: string;
    sender_id: string;
    sender_username: string;
    created_at: string;
  };
}

export interface DirectMessagesResponse {
  dms: DirectMessage[];
}

// Типы ответов для уведомлений
export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  user_id?: string;
  room_id?: string;
  sender_id?: string;
  sender_username?: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
}

// Типы ответов для друзей
export interface FriendsResponse {
  friends: User[];
}

export interface FriendRequestResponse {
  pending: boolean;
  request_id?: string;
}

// Типы ответов для опросов
export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, string[]>; // optionIndex -> userIds
  created_by: string;
  created_at: string;
  anonymous: boolean;
}

export interface PollResponse {
  poll: Poll;
}

// Тип ответа для участников комнаты
export interface MemberData {
  user: User;
}

export interface MembersResponse {
  members: User[];
}
