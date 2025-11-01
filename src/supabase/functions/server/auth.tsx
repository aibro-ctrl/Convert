import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import * as kv from './kv_store.tsx';

// Admin client for user management
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Auth client for user authentication  
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);

export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string; // Отображаемое имя (может быть на русском)
  role: 'admin' | 'moderator' | 'vip' | 'user';
  avatar_url?: string;
  status: 'online' | 'offline';
  last_activity?: string; // Время последней активности
  created_at: string;
  banned?: boolean;
  ban_until?: string; // До какого времени забанен
  muted?: boolean;
  mute_until?: string; // До какого времени замучен
  friends?: string[]; // Array of user IDs
  blocked_users?: string[]; // Array of blocked user IDs
  deleted?: boolean; // Флаг мягкого удаления
  deleted_at?: string; // Дата удаления
  deleted_by?: string; // Кто удалил
}

export async function signup(email: string, password: string, username: string) {
  try {
    console.log('Starting signup process for:', email, username);
    
    // Validate username
    if (username.length < 3) {
      return { error: 'Имя пользователя должно содержать минимум 3 символа' };
    }
    
    // Check if username already exists in KV
    try {
      const existingUsers = await kv.getByPrefix('user:');
      const usernameTaken = existingUsers.some((u: User) => u.username.toLowerCase() === username.toLowerCase());
      
      if (usernameTaken) {
        console.log('Username already taken:', username);
        return { error: 'Имя пользователя уже занято. Выберите другое имя.' };
      }
    } catch (err) {
      console.error('Error checking username availability:', err);
      // Continue with signup - we'll check again with username: prefix
    }
    
    // Additional check using username: prefix
    const existingUserId = await kv.get(`username:${username.toLowerCase()}`);
    if (existingUserId) {
      console.log('Username already exists (via prefix check):', username);
      return { error: 'Имя пользователя уже занято. Выберите другое имя.' };
    }

    // Check if user already exists in Supabase Auth
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = existingAuthUsers?.users?.find(u => u.email === email);

    if (existingAuthUser) {
      console.log('User exists in Auth, checking KV store...');
      
      // Check if user exists in KV store
      const existingKVUser = await kv.get(`user:${existingAuthUser.id}`) as User;
      
      if (existingKVUser) {
        console.log('User exists in both Auth and KV - suggesting login');
        return { error: 'Пользователь с таким email уже существует. Попробуйте войти в систему.' };
      }
      
      // User exists in Auth but not in KV - this shouldn't happen in normal flow
      // Just tell them the account exists and they should login
      console.log('User exists in Auth but not in KV - suggesting login');
      return { error: 'Пользователь с таким email уже существует. Попробуйте войти в систему.' };
    }

    // User doesn't exist - create new user
    console.log('Creating new user in Auth...');
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automatically confirm email since email server hasn't been configured
      user_metadata: {
        username: username
      }
    });

    if (error) {
      console.error('Supabase createUser error:', error);
      return { error: `Ошибка создания пользователя: ${error.message}` };
    }

    if (!data?.user) {
      console.error('No user data returned from Supabase');
      return { error: 'Не удалось создать пользователя' };
    }

    console.log('User created in Supabase Auth:', data.user.id);

    // Check if this is the first user (should be iBro with admin role)
    let isFirstUser = false;
    try {
      const allUsers = await kv.getByPrefix('user:');
      isFirstUser = allUsers.length === 0;
      console.log('Is first user?', isFirstUser, 'Total users:', allUsers.length);
    } catch (err) {
      console.error('Error checking for first user:', err);
      // If we can't check, assume not first user to be safe
      isFirstUser = false;
    }

    // Store user data in KV store
    const user: User = {
      id: data.user.id,
      email,
      username: isFirstUser ? 'iBro' : username,
      role: isFirstUser ? 'admin' : 'user',
      status: 'online',
      created_at: new Date().toISOString()
    };
    
    if (isFirstUser) {
      console.log('Creating first user (iBro) with admin role');
    }

    await kv.set(`user:${user.id}`, user);
    await kv.set(`username:${user.username.toLowerCase()}`, user.id);

    console.log('User stored in KV store with username:', user.username);

    // Sign in the user to get access token (use auth client)
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('Auto sign-in error:', signInError);
      // User is created but signin failed - they can login manually
      return { error: 'Пользователь создан, но автоматический вход не удался. Попробуйте войти.' };
    }

    console.log('User signed in successfully');

    return { 
      data: { 
        user, 
        access_token: signInData.session.access_token 
      } 
    };
  } catch (err: any) {
    console.error('Signup exception:', err);
    return { error: `Ошибка регистрации: ${err.message}` };
  }
}

export async function getUserFromToken(token: string) {
  try {
    console.log('getUserFromToken: Starting validation for token:', token.substring(0, 20) + '...');
    
    // Pre-validate token format (should be JWT with 3 parts)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('getUserFromToken: Invalid JWT format - expected 3 parts, got', tokenParts.length);
      return null;
    }
    
    // Try to decode the payload to check for basic JWT structure
    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log('getUserFromToken: Token payload decoded:', { 
        sub: payload.sub, 
        role: payload.role,
        exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none'
      });
      
      if (!payload.sub) {
        // Check if it's the anon key (has role but no sub)
        if (payload.role === 'anon') {
          console.log('getUserFromToken: Anon key used - this is normal for unauthenticated requests');
        } else {
          console.error('getUserFromToken: Token missing sub claim');
        }
        return null;
      }
      
      // Check if token is expired
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        const expDate = new Date(payload.exp * 1000);
        const now = new Date();
        console.error('getUserFromToken: Token expired at', expDate, 'Current time:', now, 'Expired', Math.floor((now.getTime() - expDate.getTime()) / 1000 / 60), 'minutes ago');
        return null;
      } else if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const now = new Date();
        const minutesUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / 1000 / 60);
        console.log('getUserFromToken: Token valid, expires in', minutesUntilExpiry, 'minutes');
      }
    } catch (decodeError) {
      console.error('getUserFromToken: Failed to decode token payload:', decodeError);
      return null;
    }
    
    // Create a temporary client with the user's token
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    
    console.log('getUserFromToken: Calling Supabase getUser()...');
    const { data: { user }, error } = await supabaseUser.auth.getUser();
    
    if (error) {
      console.error('getUserFromToken: Supabase validation error:', error.message);
      return null;
    }
    
    if (!user) {
      console.error('getUserFromToken: No user returned from Supabase');
      return null;
    }

    console.log('getUserFromToken: Supabase user validated:', user.id);
    console.log('getUserFromToken: Fetching user data from KV store...');
    
    const userData = await kv.get(`user:${user.id}`) as User;
    
    if (!userData) {
      console.error('getUserFromToken: User not found in KV store:', user.id);
      return null;
    }

    // Не возвращаем удаленных пользователей
    if (userData.deleted) {
      console.error('getUserFromToken: User is deleted:', user.id);
      return null;
    }
    
    // Проверяем истечение бана
    if (userData.banned && userData.ban_until) {
      const banUntil = new Date(userData.ban_until);
      const now = new Date();
      if (now > banUntil) {
        // Бан истек, снимаем его
        console.log('getUserFromToken: Ban expired for user:', user.id);
        userData.banned = false;
        userData.ban_until = undefined;
        await kv.set(`user:${user.id}`, userData);
        
        // Удаляем пользователя из Азкабана
        const allRooms = await kv.getByPrefix('room:');
        const azkaban = allRooms.find((r: any) => r.name === '🔒 Азкабан');
        if (azkaban && azkaban.members && azkaban.members.includes(user.id)) {
          azkaban.members = azkaban.members.filter((id: string) => id !== user.id);
          await kv.set(`room:${azkaban.id}`, azkaban);
        }
      }
    }
    
    console.log('getUserFromToken: User data found:', userData.username);
    return userData;
  } catch (err: any) {
    console.error('getUserFromToken: Exception:', err);
    return null;
  }
}

export async function updateUserStatus(userId: string, status: 'online' | 'offline') {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    if (user) {
      user.status = status;
      await kv.set(`user:${userId}`, user);
    }
  } catch (err: any) {
    console.error('Error updating user status:', err);
  }
}

export async function searchUsers(query: string, currentUserId?: string) {
  try {
    const users = await kv.getByPrefix('user:');
    let currentUser: User | null = null;
    
    // Получаем текущего пользователя для проверки блокировки
    if (currentUserId) {
      currentUser = await kv.get(`user:${currentUserId}`) as User;
    }
    
    // Фильтруем удаленных и заблокированных пользователей
    return users.filter((u: any) => {
      // Исключаем удаленных
      if (u.deleted) return false;
      
      // Исключаем заблокированных текущим пользователем
      if (currentUser?.blocked_users?.includes(u.id)) return false;
      
      // Исключаем тех, кто заблокировал текущего пользователя
      if (u.blocked_users?.includes(currentUserId)) return false;
      
      // Проверяем совпадение с запросом
      return (
        u.username.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase()) ||
        (u.display_name && u.display_name.toLowerCase().includes(query.toLowerCase()))
      );
    });
  } catch (err: any) {
    console.error('Error searching users:', err);
    return [];
  }
}

export async function updateUserRole(userId: string, role: User['role'], adminId: string) {
  try {
    const admin = await kv.get(`user:${adminId}`) as User;
    if (admin?.role !== 'admin') {
      return { error: 'Только администратор может менять роли' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    user.role = role;
    await kv.set(`user:${userId}`, user);
    return { data: user };
  } catch (err: any) {
    return { error: `Ошибка изменения роли: ${err.message}` };
  }
}

export async function banUser(userId: string, modId: string, hours?: number) {
  try {
    const mod = await kv.get(`user:${modId}`) as User;
    if (!['admin', 'moderator'].includes(mod?.role)) {
      return { error: 'Недостаточно прав' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    // Нельзя забанить первого пользователя iBro
    if (user.username === 'iBro') {
      return { error: 'Невозможно забанить первого пользователя' };
    }

    // VIP защищен от банов
    if (user.role === 'vip') {
      return { error: 'VIP пользователи защищены от банов' };
    }

    // Модераторы не могут банить администраторов
    if (mod.role === 'moderator' && user.role === 'admin') {
      return { error: 'Модераторы не могут банить администраторов' };
    }

    user.banned = true;
    if (hours) {
      const banUntil = new Date();
      banUntil.setHours(banUntil.getHours() + hours);
      user.ban_until = banUntil.toISOString();
    } else {
      user.ban_until = undefined; // Перманентный бан
    }
    
    await kv.set(`user:${userId}`, user);
    
    // Создать/найти комнату Азкабан и переместить туда пользователя
    const allRooms = await kv.getByPrefix('room:');
    let azkaban = allRooms.find((r: any) => r.name === '🔒 Азкабан' && r.type === 'public');
    
    if (!azkaban) {
      // Создаем комнату Азкабан, если её нет (приватная, видна только админам/модераторам и забаненным)
      const azkabanId = crypto.randomUUID();
      azkaban = {
        id: azkabanId,
        name: '🔒 Азкабан',
        type: 'private',
        created_by: modId,
        created_at: new Date().toISOString(),
        members: []
      };
      await kv.set(`room:${azkabanId}`, azkaban);
    }
    
    // Добавляем пользователя в Азкабан, если его там нет
    if (!azkaban.members.includes(userId)) {
      azkaban.members.push(userId);
      await kv.set(`room:${azkaban.id}`, azkaban);
    }
    
    // Удаляем пользователя из всех других комнат
    for (const room of allRooms) {
      if (room.id !== azkaban.id && room.members && room.members.includes(userId)) {
        room.members = room.members.filter((id: string) => id !== userId);
        await kv.set(`room:${room.id}`, room);
      }
    }
    
    return { data: user };
  } catch (err: any) {
    return { error: `Ошибка бана пользователя: ${err.message}` };
  }
}

export async function unbanUser(userId: string, modId: string) {
  try {
    const mod = await kv.get(`user:${modId}`) as User;
    if (!['admin', 'moderator'].includes(mod?.role)) {
      return { error: 'Недостаточно прав' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    user.banned = false;
    user.ban_until = undefined;
    await kv.set(`user:${userId}`, user);
    
    // Удаляем пользователя из Азкабана
    const allRooms = await kv.getByPrefix('room:');
    const azkaban = allRooms.find((r: any) => r.name === '🔒 Азкабан');
    
    if (azkaban && azkaban.members && azkaban.members.includes(userId)) {
      azkaban.members = azkaban.members.filter((id: string) => id !== userId);
      await kv.set(`room:${azkaban.id}`, azkaban);
    }
    
    return { data: user };
  } catch (err: any) {
    return { error: `Ошибка разбана пользователя: ${err.message}` };
  }
}

export async function muteUser(userId: string, modId: string, hours: number = 24) {
  try {
    const mod = await kv.get(`user:${modId}`) as User;
    if (!['admin', 'moderator'].includes(mod?.role)) {
      return { error: 'Недостаточно прав' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    // Нельзя замутить первого пользователя iBro
    if (user.username === 'iBro') {
      return { error: 'Невозможно замутить первого пользователя' };
    }

    // Модераторы не могут мутить администраторов
    if (mod.role === 'moderator' && user.role === 'admin') {
      return { error: 'Модераторы не могут мутить администраторов' };
    }

    // Ограничиваем время мута до 24 часов
    const muteHours = Math.min(Math.max(1, hours), 24);
    const muteUntil = new Date(Date.now() + muteHours * 60 * 60 * 1000).toISOString();
    
    user.muted = true;
    user.mute_until = muteUntil;
    await kv.set(`user:${userId}`, user);
    return { data: user };
  } catch (err: any) {
    return { error: `Ошибка мута пользователя: ${err.message}` };
  }
}

export async function unmuteUser(userId: string, modId: string) {
  try {
    const mod = await kv.get(`user:${modId}`) as User;
    if (!['admin', 'moderator'].includes(mod?.role)) {
      return { error: 'Недостаточно прав' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    user.muted = false;
    user.mute_until = undefined;
    await kv.set(`user:${userId}`, user);
    return { data: user };
  } catch (err: any) {
    return { error: `Ошибка размута пользователя: ${err.message}` };
  }
}

export async function addFriend(userId: string, friendId: string) {
  try {
    if (userId === friendId) {
      return { error: 'Нельзя добавить себя в друзья' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    const friend = await kv.get(`user:${friendId}`) as User;
    
    if (!user || !friend) {
      return { error: 'Пользователь не найден' };
    }

    // Проверяем блокировку
    if (user.blocked_users?.includes(friendId) || friend.blocked_users?.includes(userId)) {
      return { error: 'Невозможно добавить этого пользователя в друзья' };
    }

    if (!user.friends) {
      user.friends = [];
    }

    if (!friend.friends) {
      friend.friends = [];
    }

    if (user.friends.includes(friendId)) {
      return { error: 'Пользователь уже в друзьях' };
    }

    // Добавляем друг друга ОБОИМ пользователям
    user.friends.push(friendId);
    friend.friends.push(userId);
    
    await kv.set(`user:${userId}`, user);
    await kv.set(`user:${friendId}`, friend);
    
    return { data: { success: true } };
  } catch (err: any) {
    return { error: `Ошибка добавления в друзья: ${err.message}` };
  }
}

export async function removeFriend(userId: string, friendId: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    const friend = await kv.get(`user:${friendId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    if (!user.friends || !user.friends.includes(friendId)) {
      return { error: 'Пользователь не в друзьях' };
    }

    // Удаляем друг друга у ОБОИХ пользователей
    user.friends = user.friends.filter(id => id !== friendId);
    await kv.set(`user:${userId}`, user);
    
    if (friend && friend.friends) {
      friend.friends = friend.friends.filter(id => id !== userId);
      await kv.set(`user:${friendId}`, friend);
    }
    
    // Удаляем все связанные запросы в друзья (в обе стороны)
    const requestKey1 = `friend_request:${userId}:${friendId}`;
    const requestKey2 = `friend_request:${friendId}:${userId}`;
    
    try {
      await kv.del(requestKey1);
    } catch (err) {
      console.log('No request found for key1:', requestKey1);
    }
    
    try {
      await kv.del(requestKey2);
    } catch (err) {
      console.log('No request found for key2:', requestKey2);
    }
    
    return { data: { success: true } };
  } catch (err: any) {
    return { error: `Ошибка удаления из друзей: ${err.message}` };
  }
}

export async function getFriends(userId: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return [];
    }

    if (!user.friends || user.friends.length === 0) {
      return [];
    }

    const friends: User[] = [];
    for (const friendId of user.friends) {
      const friend = await kv.get(`user:${friendId}`) as User;
      // Не включаем удаленных пользователей
      if (friend && !friend.deleted) {
        friends.push(friend);
      }
    }

    return friends;
  } catch (err: any) {
    console.error('Error getting friends:', err);
    return [];
  }
}

export async function getUserById(userId: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    // Не возвращаем удаленных пользователей
    if (user && user.deleted) {
      return null;
    }
    return user || null;
  } catch (err: any) {
    console.error('Error getting user by id:', err);
    return null;
  }
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    // Verify old password by trying to sign in
    const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (signInError) {
      return { error: 'Неверный текущий пароль' };
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      return { error: `Ошибка обновления пароля: ${updateError.message}` };
    }

    return { data: { message: 'Пароль успешно изменен' } };
  } catch (err: any) {
    return { error: `Ошибка смены пароля: ${err.message}` };
  }
}

export async function changeEmail(userId: string, newEmail: string, password: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    // Verify password
    const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: user.email,
      password: password,
    });

    if (signInError) {
      return { error: 'Неверный пароль' };
    }

    // Check if new email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailTaken = existingUsers?.users?.some(u => u.email === newEmail && u.id !== userId);

    if (emailTaken) {
      return { error: 'Email уже используется' };
    }

    // Update email in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: newEmail }
    );

    if (updateError) {
      return { error: `Ошибка обновления email: ${updateError.message}` };
    }

    // Update email in KV store
    user.email = newEmail;
    await kv.set(`user:${userId}`, user);

    return { data: { message: 'Email успешно изменен', user } };
  } catch (err: any) {
    return { error: `Ошибка смены email: ${err.message}` };
  }
}

export async function updateUserProfile(userId: string, updates: { display_name?: string; gender?: string; age?: number; interests?: string; privacySettings?: any }) {
  try {
    const user = await kv.get(`user:${userId}`) as any;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    if (updates.display_name !== undefined) {
      user.display_name = updates.display_name;
    }

    if (updates.gender !== undefined) {
      user.gender = updates.gender;
    }

    if (updates.age !== undefined) {
      user.age = updates.age;
    }

    if (updates.interests !== undefined) {
      user.interests = updates.interests;
    }

    if (updates.privacySettings !== undefined) {
      user.privacySettings = updates.privacySettings;
    }

    await kv.set(`user:${userId}`, user);

    return { data: { user } };
  } catch (err: any) {
    return { error: `Ошибка обновления профиля: ${err.message}` };
  }
}

// Удаление пользователя (мягкое удаление)
export async function deleteUser(userId: string, deletedBy: string) {
  try {
    const deleter = await kv.get(`user:${deletedBy}`) as User;
    
    // Только админ может удалять пользователей
    if (deleter?.role !== 'admin') {
      return { error: 'Только администратор может удалять пользователей' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    if (user.deleted) {
      return { error: 'Пользователь уже удален' };
    }

    // Мягкое удаление - помечаем пользователя как удаленного
    user.deleted = true;
    user.deleted_at = new Date().toISOString();
    user.deleted_by = deletedBy;
    
    await kv.set(`user:${userId}`, user);

    return { data: { success: true } };
  } catch (err: any) {
    return { error: `Ошибка удаления пользователя: ${err.message}` };
  }
}

// Полное удаление пользователя (только для администраторов)
export async function permanentDeleteUser(userId: string, deletedBy: string) {
  try {
    const deleter = await kv.get(`user:${deletedBy}`) as User;
    
    // Только админ может удалять пользователей
    if (deleter?.role !== 'admin') {
      return { error: 'Только администратор может удалять пользователей' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    // Нельзя удалить первого пользователя iBro
    if (user.username === 'iBro') {
      return { error: 'Невозможно удалить первого пользователя' };
    }

    // Удаляем из Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('Error deleting user from Auth:', deleteAuthError);
      // Продолжаем даже если произошла ошибка в Auth
    }

    // Удаляем из KV store
    await kv.del(`user:${userId}`);
    await kv.del(`username:${user.username.toLowerCase()}`);

    // Удаляем из друзей у всех других пользователей
    const allUsers = await kv.getByPrefix('user:');
    for (const otherUser of allUsers as User[]) {
      if (otherUser.friends && otherUser.friends.includes(userId)) {
        otherUser.friends = otherUser.friends.filter(id => id !== userId);
        await kv.set(`user:${otherUser.id}`, otherUser);
      }
      // Удаляем из списка заблокированных
      if (otherUser.blocked_users && otherUser.blocked_users.includes(userId)) {
        otherUser.blocked_users = otherUser.blocked_users.filter(id => id !== userId);
        await kv.set(`user:${otherUser.id}`, otherUser);
      }
    }

    // Удаляем из всех комнат
    const allRooms = await kv.getByPrefix('room:');
    for (const room of allRooms as any[]) {
      if (room.members && room.members.includes(userId)) {
        room.members = room.members.filter((id: string) => id !== userId);
        await kv.set(`room:${room.id}`, room);
      }
    }

    // Помечаем сообщения пользователя как удаленные
    const allMessages = await kv.getByPrefix('message:');
    for (const message of allMessages as any[]) {
      if (message.sender_id === userId && !message.deleted) {
        message.deleted = true;
        message.content = '[Пользователь удален]';
        await kv.set(`message:${message.id}`, message);
      }
    }

    return { data: { success: true } };
  } catch (err: any) {
    console.error('Error permanently deleting user:', err);
    return { error: `Ошибка удаления пользователя: ${err.message}` };
  }
}

// Блокировка пользователя
export async function blockUser(userId: string, blockedUserId: string) {
  try {
    if (userId === blockedUserId) {
      return { error: 'Нельзя заблокировать самого себя' };
    }

    const user = await kv.get(`user:${userId}`) as User;
    const blockedUser = await kv.get(`user:${blockedUserId}`) as User;
    
    if (!user || !blockedUser) {
      return { error: 'Пользователь не найден' };
    }

    // Нельзя блокировать удаленного пользователя
    if (blockedUser.deleted) {
      return { error: 'Пользователь не найден' };
    }

    // Нельзя блокировать первого пользователя iBro
    if (blockedUser.username === 'iBro') {
      return { error: 'Невозможно заблокировать первого пользователя' };
    }

    if (!user.blocked_users) {
      user.blocked_users = [];
    }

    if (user.blocked_users.includes(blockedUserId)) {
      return { error: 'Пользователь уже заблокирован' };
    }

    // Добавляем в список заблокированных
    user.blocked_users.push(blockedUserId);
    
    // Удаляем из друзей, если там есть
    if (user.friends && user.friends.includes(blockedUserId)) {
      user.friends = user.friends.filter(id => id !== blockedUserId);
    }
    if (blockedUser.friends && blockedUser.friends.includes(userId)) {
      blockedUser.friends = blockedUser.friends.filter(id => id !== userId);
      await kv.set(`user:${blockedUserId}`, blockedUser);
    }
    
    await kv.set(`user:${userId}`, user);
    
    return { data: { success: true } };
  } catch (err: any) {
    return { error: `Ошибка блокировки пользователя: ${err.message}` };
  }
}

// Разблокировка пользователя
export async function unblockUser(userId: string, blockedUserId: string) {
  try {
    const user = await kv.get(`user:${userId}`) as User;
    
    if (!user) {
      return { error: 'Пользователь не найден' };
    }

    if (!user.blocked_users || !user.blocked_users.includes(blockedUserId)) {
      return { error: 'Пользователь не в списке заблокированных' };
    }

    // Удаляем из списка заблокированных
    user.blocked_users = user.blocked_users.filter(id => id !== blockedUserId);
    await kv.set(`user:${userId}`, user);
    
    return { data: { success: true } };
  } catch (err: any) {
    return { error: `Ошибка разблокировки пользователя: ${err.message}` };
  }
}
