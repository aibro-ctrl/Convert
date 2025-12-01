/**
 * PocketBase Backend Adapter
 * Реализация IBackendAdapter для PocketBase
 */

import PocketBase from 'pocketbase';
import { IBackendAdapter, User, Room, Message, DirectMessage, Achievement, ApiResponse } from './interface';
import { getBackendConfig } from './config';

class PocketBaseAdapter implements IBackendAdapter {
  private pb: PocketBase;
  private realTimeSubscriptions: Map<string, () => void> = new Map();

  constructor() {
    const config = getBackendConfig();
    this.pb = new PocketBase(config.url);
    
    // Автоматическое обновление auth
    this.pb.autoCancellation(false);
  }

  // ============ AUTH ============
  
  async signup(email: string, password: string, username: string): Promise<{ user: User; access_token: string }> {
    try {
      // Создаем пользователя
      const record = await this.pb.collection('users').create({
        email,
        username,
        password,
        passwordConfirm: password,
        role: 'user',
        status: 'online',
        emailVisibility: true,
      });

      // Авторизуемся
      const authData = await this.pb.collection('users').authWithPassword(email, password);

      return {
        user: this.mapPBUserToUser(authData.record),
        access_token: authData.token,
      };
    } catch (error: any) {
      throw new Error(error.message || 'Signup failed');
    }
  }

  async signin(email: string, password: string): Promise<{ user: User; access_token: string }> {
    try {
      const authData = await this.pb.collection('users').authWithPassword(email, password);

      // Обновляем статус
      await this.pb.collection('users').update(authData.record.id, {
        status: 'online',
        last_activity: new Date().toISOString(),
      });

      return {
        user: this.mapPBUserToUser(authData.record),
        access_token: authData.token,
      };
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  }

  async signout(): Promise<void> {
    const userId = this.pb.authStore.model?.id;
    
    if (userId) {
      // Обновляем статус перед выходом
      try {
        await this.pb.collection('users').update(userId, {
          status: 'offline',
          last_activity: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to update status on signout:', e);
      }
    }

    this.pb.authStore.clear();
    
    // Отписываемся от всех real-time подписок
    this.realTimeSubscriptions.forEach(unsub => unsub());
    this.realTimeSubscriptions.clear();
  }

  async getMe(): Promise<{ user: User }> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const record = await this.pb.collection('users').getOne(this.pb.authStore.model.id);
      return { user: this.mapPBUserToUser(record) };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get user');
    }
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    // PocketBase автоматически обновляет токены
    return { access_token: this.pb.authStore.token };
  }

  // ============ USERS ============

  async searchUsers(query: string): Promise<{ users: User[] }> {
    try {
      const records = await this.pb.collection('users').getList(1, 50, {
        filter: `username ~ "${query}" || email ~ "${query}" || display_name ~ "${query}"`,
      });

      return {
        users: records.items.map(r => this.mapPBUserToUser(r)),
      };
    } catch (error: any) {
      throw new Error(error.message || 'Search failed');
    }
  }

  async getUserById(userId: string): Promise<{ user: User }> {
    try {
      const record = await this.pb.collection('users').getOne(userId);
      return { user: this.mapPBUserToUser(record) };
    } catch (error: any) {
      throw new Error(error.message || 'User not found');
    }
  }

  async updateUserProfile(updates: Partial<User>): Promise<{ user: User }> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const record = await this.pb.collection('users').update(this.pb.authStore.model.id, updates);
      return { user: this.mapPBUserToUser(record) };
    } catch (error: any) {
      throw new Error(error.message || 'Update failed');
    }
  }

  async updateUserRole(userId: string, role: User['role']): Promise<{ user: User }> {
    try {
      const record = await this.pb.collection('users').update(userId, { role });
      return { user: this.mapPBUserToUser(record) };
    } catch (error: any) {
      throw new Error(error.message || 'Role update failed');
    }
  }

  async banUser(userId: string, hours?: number): Promise<void> {
    try {
      const ban_until = hours 
        ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
        : undefined;

      await this.pb.collection('users').update(userId, {
        banned: true,
        ban_until,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Ban failed');
    }
  }

  async unbanUser(userId: string): Promise<void> {
    try {
      await this.pb.collection('users').update(userId, {
        banned: false,
        ban_until: null,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Unban failed');
    }
  }

  async muteUser(userId: string, hours?: number): Promise<void> {
    try {
      const mute_until = hours
        ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await this.pb.collection('users').update(userId, {
        muted: true,
        mute_until,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Mute failed');
    }
  }

  async unmuteUser(userId: string): Promise<void> {
    try {
      await this.pb.collection('users').update(userId, {
        muted: false,
        mute_until: null,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Unmute failed');
    }
  }

  async blockUser(userId: string): Promise<void> {
    try {
      const currentUser = await this.getMe();
      const blockedUsers = currentUser.user.blocked_users || [];
      
      if (!blockedUsers.includes(userId)) {
        blockedUsers.push(userId);
        await this.updateUserProfile({ blocked_users: blockedUsers });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Block failed');
    }
  }

  async unblockUser(userId: string): Promise<void> {
    try {
      const currentUser = await this.getMe();
      const blockedUsers = (currentUser.user.blocked_users || []).filter(id => id !== userId);
      await this.updateUserProfile({ blocked_users: blockedUsers });
    } catch (error: any) {
      throw new Error(error.message || 'Unblock failed');
    }
  }

  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const formData = new FormData();
      formData.append('avatar', file);

      const record = await this.pb.collection('users').update(this.pb.authStore.model.id, formData);
      const avatarUrl = this.pb.files.getUrl(record, record.avatar);

      return { avatarUrl };
    } catch (error: any) {
      throw new Error(error.message || 'Upload failed');
    }
  }

  // ============ ROOMS ============

  async getRooms(): Promise<{ rooms: Room[] }> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const userId = this.pb.authStore.model.id;
      
      // Получаем комнаты где пользователь участник
      const records = await this.pb.collection('rooms').getFullList({
        filter: `members ~ "${userId}"`,
        sort: '-last_activity',
      });

      return {
        rooms: records.map(r => this.mapPBRoomToRoom(r)),
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get rooms');
    }
  }

  async createRoom(name: string, type: Room['type'], memberIds?: string[]): Promise<{ room: Room }> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const userId = this.pb.authStore.model.id;
      const members = [userId, ...(memberIds || [])];

      const record = await this.pb.collection('rooms').create({
        name,
        type,
        created_by: userId,
        members,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
      });

      return { room: this.mapPBRoomToRoom(record) };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create room');
    }
  }

  async joinRoom(roomId: string): Promise<void> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const userId = this.pb.authStore.model.id;
      const room = await this.pb.collection('rooms').getOne(roomId);
      
      const members = room.members || [];
      if (!members.includes(userId)) {
        members.push(userId);
        await this.pb.collection('rooms').update(roomId, { members });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to join room');
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const userId = this.pb.authStore.model.id;
      const room = await this.pb.collection('rooms').getOne(roomId);
      
      const members = (room.members || []).filter((id: string) => id !== userId);
      await this.pb.collection('rooms').update(roomId, { members });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to leave room');
    }
  }

  async inviteToRoom(roomId: string, userId: string): Promise<void> {
    try {
      const room = await this.pb.collection('rooms').getOne(roomId);
      const members = room.members || [];
      
      if (!members.includes(userId)) {
        members.push(userId);
        await this.pb.collection('rooms').update(roomId, { members });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to invite user');
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    try {
      await this.pb.collection('rooms').delete(roomId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete room');
    }
  }

  async pinMessage(roomId: string, messageId: string): Promise<void> {
    try {
      await this.pb.collection('rooms').update(roomId, {
        pinned_message_id: messageId,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to pin message');
    }
  }

  async unpinMessage(roomId: string): Promise<void> {
    try {
      await this.pb.collection('rooms').update(roomId, {
        pinned_message_id: null,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to unpin message');
    }
  }

  async markAsRead(roomId: string, clearMentions?: boolean, clearReactions?: boolean): Promise<void> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const userId = this.pb.authStore.model.id;
      const room = await this.pb.collection('rooms').getOne(roomId);

      const updates: any = {
        last_read: {
          ...(room.last_read || {}),
          [userId]: new Date().toISOString(),
        },
      };

      if (clearMentions) {
        updates.unread_mentions = {
          ...(room.unread_mentions || {}),
          [userId]: 0,
        };
      }

      if (clearReactions) {
        updates.unread_reactions = {
          ...(room.unread_reactions || {}),
          [userId]: 0,
        };
      }

      await this.pb.collection('rooms').update(roomId, updates);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to mark as read');
    }
  }

  // ============ MESSAGES ============

  async getMessages(roomId: string, limit: number = 100): Promise<{ messages: Message[] }> {
    try {
      const records = await this.pb.collection('messages').getList(1, limit, {
        filter: `room_id = "${roomId}"`,
        sort: 'created_at',
        expand: 'sender_id',
      });

      return {
        messages: records.items.map(r => this.mapPBMessageToMessage(r)),
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get messages');
    }
  }

  async sendMessage(
    roomId: string,
    content: string,
    type: Message['type'],
    replyTo?: string
  ): Promise<{ message: Message }> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const userId = this.pb.authStore.model.id;
      const user = await this.pb.collection('users').getOne(userId);

      // Извлекаем упоминания из контента
      const mentions = this.extractMentions(content);

      const record = await this.pb.collection('messages').create({
        room_id: roomId,
        sender_id: userId,
        sender_username: user.username,
        sender_display_name: user.display_name,
        sender_avatar: user.avatar ? this.pb.files.getUrl(user, user.avatar) : undefined,
        content,
        type,
        reply_to: replyTo,
        mentions,
        created_at: new Date().toISOString(),
      });

      // Обновляем последнюю активность комнаты
      await this.pb.collection('rooms').update(roomId, {
        last_activity: new Date().toISOString(),
        last_message: {
          content,
          sender_username: user.username,
          created_at: record.created_at,
        },
      });

      return { message: this.mapPBMessageToMessage(record) };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send message');
    }
  }

  async editMessage(messageId: string, content: string): Promise<{ message: Message }> {
    try {
      const record = await this.pb.collection('messages').update(messageId, {
        content,
        edited: true,
        edited_at: new Date().toISOString(),
      });

      return { message: this.mapPBMessageToMessage(record) };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to edit message');
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      await this.pb.collection('messages').delete(messageId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete message');
    }
  }

  async addReaction(messageId: string, emoji: string): Promise<void> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const userId = this.pb.authStore.model.id;
      const message = await this.pb.collection('messages').getOne(messageId);
      
      const reactions = message.reactions || {};
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }
      
      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
        await this.pb.collection('messages').update(messageId, { reactions });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to add reaction');
    }
  }

  async removeReaction(messageId: string, emoji: string): Promise<void> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const userId = this.pb.authStore.model.id;
      const message = await this.pb.collection('messages').getOne(messageId);
      
      const reactions = message.reactions || {};
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
        await this.pb.collection('messages').update(messageId, { reactions });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to remove reaction');
    }
  }

  async forwardMessage(messageId: string, targetRoomId: string): Promise<void> {
    try {
      const originalMessage = await this.pb.collection('messages').getOne(messageId);
      
      await this.sendMessage(
        targetRoomId,
        originalMessage.content,
        originalMessage.type
      );
    } catch (error: any) {
      throw new Error(error.message || 'Failed to forward message');
    }
  }

  async searchMessages(query: string): Promise<{ messages: Message[] }> {
    try {
      const records = await this.pb.collection('messages').getList(1, 50, {
        filter: `content ~ "${query}"`,
        sort: '-created_at',
      });

      return {
        messages: records.items.map(r => this.mapPBMessageToMessage(r)),
      };
    } catch (error: any) {
      throw new Error(error.message || 'Search failed');
    }
  }

  // ============ DIRECT MESSAGES ============

  async getDirectMessages(): Promise<{ dms: DirectMessage[] }> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const userId = this.pb.authStore.model.id;

      // В PocketBase DM это комнаты типа 'dm'
      const records = await this.pb.collection('rooms').getFullList({
        filter: `type = "dm" && members ~ "${userId}"`,
        sort: '-last_activity',
      });

      return {
        dms: records.map(r => ({
          id: r.id,
          participants: r.members || [],
          created_at: r.created_at,
          last_message: r.last_message,
          unread_count: r.unread_count,
        })),
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get DMs');
    }
  }

  async createDirectMessage(userId: string): Promise<{ dm: DirectMessage }> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const currentUserId = this.pb.authStore.model.id;

      // Проверяем существующий DM
      const existing = await this.pb.collection('rooms').getFirstListItem(
        `type = "dm" && members ~ "${currentUserId}" && members ~ "${userId}"`
      ).catch(() => null);

      if (existing) {
        return {
          dm: {
            id: existing.id,
            participants: existing.members,
            created_at: existing.created_at,
            last_message: existing.last_message,
            unread_count: existing.unread_count,
          },
        };
      }

      // Создаем новый DM
      const record = await this.pb.collection('rooms').create({
        name: `DM ${currentUserId}-${userId}`,
        type: 'dm',
        created_by: currentUserId,
        members: [currentUserId, userId],
        dm_participants: [currentUserId, userId],
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
      });

      return {
        dm: {
          id: record.id,
          participants: record.members,
          created_at: record.created_at,
        },
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create DM');
    }
  }

  async getDMMessages(dmId: string, limit: number = 100): Promise<{ messages: Message[] }> {
    return this.getMessages(dmId, limit);
  }

  async sendDMMessage(dmId: string, content: string, type: Message['type']): Promise<{ message: Message }> {
    return this.sendMessage(dmId, content, type);
  }

  // ============ FRIENDS ============

  async getFriends(): Promise<{ users: User[] }> {
    try {
      const currentUser = await this.getMe();
      const friendIds = currentUser.user.friends || [];

      if (friendIds.length === 0) {
        return { users: [] };
      }

      const records = await this.pb.collection('users').getList(1, 100, {
        filter: friendIds.map(id => `id = "${id}"`).join(' || '),
      });

      return {
        users: records.items.map(r => this.mapPBUserToUser(r)),
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get friends');
    }
  }

  async sendFriendRequest(userId: string): Promise<void> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      await this.pb.collection('friend_requests').create({
        from_user: this.pb.authStore.model.id,
        to_user: userId,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send friend request');
    }
  }

  async acceptFriendRequest(requestId: string): Promise<void> {
    try {
      const request = await this.pb.collection('friend_requests').getOne(requestId);
      
      // Добавляем в друзья обоим пользователям
      const fromUser = await this.pb.collection('users').getOne(request.from_user);
      const toUser = await this.pb.collection('users').getOne(request.to_user);

      const fromFriends = fromUser.friends || [];
      const toFriends = toUser.friends || [];

      if (!fromFriends.includes(request.to_user)) {
        fromFriends.push(request.to_user);
      }
      if (!toFriends.includes(request.from_user)) {
        toFriends.push(request.from_user);
      }

      await this.pb.collection('users').update(request.from_user, { friends: fromFriends });
      await this.pb.collection('users').update(request.to_user, { friends: toFriends });

      // Удаляем запрос
      await this.pb.collection('friend_requests').delete(requestId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to accept friend request');
    }
  }

  async rejectFriendRequest(requestId: string): Promise<void> {
    try {
      await this.pb.collection('friend_requests').delete(requestId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to reject friend request');
    }
  }

  async removeFriend(userId: string): Promise<void> {
    try {
      const currentUser = await this.getMe();
      const friends = (currentUser.user.friends || []).filter(id => id !== userId);
      await this.updateUserProfile({ friends });

      // Также удаляем себя из друзей у другого пользователя
      const otherUser = await this.getUserById(userId);
      const otherFriends = (otherUser.user.friends || []).filter(
        id => id !== this.pb.authStore.model?.id
      );
      await this.pb.collection('users').update(userId, { friends: otherFriends });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to remove friend');
    }
  }

  // ============ E2EE ============

  async updatePublicKey(publicKey: string): Promise<void> {
    try {
      await this.updateUserProfile({ public_key: publicKey });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update public key');
    }
  }

  async getRoomKey(roomId: string): Promise<{ encryptedKey: string | null }> {
    try {
      const currentUser = await this.getMe();
      const encryptedKey = currentUser.user.room_keys?.[roomId] || null;
      return { encryptedKey };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get room key');
    }
  }

  async saveRoomKeys(roomId: string, encryptedKeys: Record<string, string>): Promise<void> {
    try {
      // Обновляем room_keys для каждого пользователя
      for (const [userId, encryptedKey] of Object.entries(encryptedKeys)) {
        const user = await this.pb.collection('users').getOne(userId);
        const roomKeys = user.room_keys || {};
        roomKeys[roomId] = encryptedKey;
        await this.pb.collection('users').update(userId, { room_keys: roomKeys });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to save room keys');
    }
  }

  // ============ ACHIEVEMENTS ============

  async getAchievements(): Promise<{ achievements: Achievement[] }> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      const records = await this.pb.collection('user_achievements').getFullList({
        filter: `user_id = "${this.pb.authStore.model.id}"`,
        expand: 'achievement_id',
      });

      return {
        achievements: records.map((r: any) => ({
          id: r.expand?.achievement_id?.id || '',
          name: r.expand?.achievement_id?.name || '',
          description: r.expand?.achievement_id?.description || '',
          icon: r.expand?.achievement_id?.icon || '',
          rarity: r.expand?.achievement_id?.rarity || 'common',
          unlocked_at: r.unlocked_at,
        })),
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get achievements');
    }
  }

  async unlockAchievement(achievementId: string): Promise<void> {
    try {
      if (!this.pb.authStore.model?.id) {
        throw new Error('Not authenticated');
      }

      await this.pb.collection('user_achievements').create({
        user_id: this.pb.authStore.model.id,
        achievement_id: achievementId,
        unlocked_at: new Date().toISOString(),
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to unlock achievement');
    }
  }

  // ============ REALTIME ============

  subscribeToRoom(roomId: string, callback: (message: Message) => void): () => void {
    const subscription = this.pb.collection('messages').subscribe('*', (e) => {
      if (e.action === 'create' && e.record.room_id === roomId) {
        callback(this.mapPBMessageToMessage(e.record));
      }
    });

    const unsubscribe = () => {
      this.pb.collection('messages').unsubscribe('*');
    };

    this.realTimeSubscriptions.set(`room:${roomId}`, unsubscribe);
    return unsubscribe;
  }

  subscribeToUserStatus(userId: string, callback: (status: User['status']) => void): () => void {
    const subscription = this.pb.collection('users').subscribe(userId, (e) => {
      if (e.action === 'update') {
        callback(e.record.status);
      }
    });

    const unsubscribe = () => {
      this.pb.collection('users').unsubscribe(userId);
    };

    this.realTimeSubscriptions.set(`user:${userId}`, unsubscribe);
    return unsubscribe;
  }

  subscribeToRoomUpdates(callback: (rooms: Room[]) => void): () => void {
    const subscription = this.pb.collection('rooms').subscribe('*', async (e) => {
      if (e.action === 'update' || e.action === 'create' || e.action === 'delete') {
        const { rooms } = await this.getRooms();
        callback(rooms);
      }
    });

    const unsubscribe = () => {
      this.pb.collection('rooms').unsubscribe('*');
    };

    this.realTimeSubscriptions.set('rooms', unsubscribe);
    return unsubscribe;
  }

  // ============ STORAGE ============

  async uploadFile(file: File, path: string): Promise<{ url: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const record = await this.pb.collection('files').create(formData);
      const url = this.pb.files.getUrl(record, record.file);

      return { url };
    } catch (error: any) {
      throw new Error(error.message || 'Upload failed');
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      // Извлекаем ID из пути
      const fileId = path.split('/').pop();
      if (fileId) {
        await this.pb.collection('files').delete(fileId);
      }
    } catch (error: any) {
      throw new Error(error.message || 'Delete failed');
    }
  }

  async getFileUrl(path: string): Promise<{ url: string }> {
    return { url: path }; // PocketBase возвращает полный URL
  }

  // ============ HELPER METHODS ============

  private mapPBUserToUser(record: any): User {
    return {
      id: record.id,
      email: record.email,
      username: record.username,
      display_name: record.display_name,
      role: record.role || 'user',
      avatar_url: record.avatar ? this.pb.files.getUrl(record, record.avatar) : undefined,
      status: record.status || 'offline',
      last_activity: record.last_activity,
      created_at: record.created,
      banned: record.banned,
      ban_until: record.ban_until,
      muted: record.muted,
      mute_until: record.mute_until,
      friends: record.friends || [],
      blocked_users: record.blocked_users || [],
      public_key: record.public_key,
      room_keys: record.room_keys || {},
    };
  }

  private mapPBRoomToRoom(record: any): Room {
    return {
      id: record.id,
      name: record.name,
      type: record.type || 'public',
      created_by: record.created_by,
      created_at: record.created,
      members: record.members || [],
      pinned_message_id: record.pinned_message_id,
      isGodMode: record.isGodMode,
      dm_participants: record.dm_participants,
      unread_mentions: record.unread_mentions || {},
      unread_reactions: record.unread_reactions || {},
      unread_count: record.unread_count || {},
      last_message: record.last_message,
      last_activity: record.last_activity,
      last_read: record.last_read || {},
    };
  }

  private mapPBMessageToMessage(record: any): Message {
    return {
      id: record.id,
      room_id: record.room_id,
      sender_id: record.sender_id,
      sender_username: record.sender_username,
      sender_display_name: record.sender_display_name,
      sender_avatar: record.sender_avatar,
      content: record.content,
      type: record.type || 'text',
      reply_to: record.reply_to,
      created_at: record.created,
      updated_at: record.updated,
      reactions: record.reactions || {},
      forwarded: record.forwarded,
      mentions: record.mentions || [],
      edited: record.edited,
      edited_at: record.edited_at,
    };
  }

  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }
}

export default PocketBaseAdapter;
