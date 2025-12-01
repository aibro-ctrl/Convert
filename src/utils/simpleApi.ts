/**
 * Упрощенные API обёртки для PocketBase
 * Временное решение пока не будут реализованы все сервисы
 */

import pb from './pocketbase/client';
import { pbRoomsService, pbMessagesService, pbUsersService } from './pocketbase/services';
import type { Room, User, Message } from './api';
import type { DirectMessage } from './apiTypes';

// Временная заглушка для API которые ещё не реализованы
export const roomsAPI = {
  getAll: async (godMode?: boolean) => {
    const roomsList = await pbRoomsService.getRooms();
    return { rooms: roomsList };
  },
};

export const dmAPI = {
  getAll: async () => {
    // Временная заглушка - получаем все DM комнаты
    const roomsList = await pbRoomsService.getRooms();
    const dms = roomsList.filter((r: any) => r.type === 'dm') as DirectMessage[];
    return { dms };
  },
};

export const notificationsAPI = {
  getAll: async () => {
    // Временная заглушка - возвращаем пустой массив
    // TODO: Реализовать когда будет создана коллекция notifications
    return { notifications: [] };
  },
  
  markAsRead: async (notificationId: string) => {
    console.warn('notificationsAPI.markAsRead not implemented yet');
    return { success: true };
  },
  
  delete: async (notificationId: string) => {
    console.warn('notificationsAPI.delete not implemented yet');
    return { success: true };
  },
};

export const usersAPI = {
  getById: async (userId: string) => {
    const user = await pbUsersService.getUser(userId);
    return { user };
  },
  
  search: async (query: string) => {
    const users = await pbUsersService.searchUsers(query);
    return { users };
  },
};

export const messagesAPI = {
  get: async (roomId: string, limit: number = 100, godMode: boolean = false) => {
    const messages = await pbMessagesService.getMessages(roomId, limit);
    return { messages };
  },
};