import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from "./kv_store.tsx";
import * as auth from "./auth.tsx";
import * as rooms from "./rooms.tsx";
import * as messages from "./messages.tsx";
import * as notifications from "./notifications.tsx";
import * as storage from "./storage.tsx";
import * as directMessages from "./direct_messages.tsx";
import achievementsApp from "./achievements.tsx";

const app = new Hono();

// Admin client for admin operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// User client for authentication
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-b0f1e6d5/health", (c) => {
  return c.json({ 
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Конверт Chat API",
    version: "1.0.0"
  });
});

// ========== AUTH ROUTES ==========

// Регистрация
app.post("/make-server-b0f1e6d5/auth/signup", async (c) => {
  try {
    const { email, password, username } = await c.req.json();
    
    if (!email || !password || !username) {
      return c.json({ error: 'Все поля обязательны' }, 400);
    }

    const result = await auth.signup(email, password, username);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Signup error:', err);
    return c.json({ error: `Ошибка при регистрации: ${err.message}` }, 500);
  }
});

// Вход (через Supabase Auth)
app.post("/make-server-b0f1e6d5/auth/signin", async (c) => {
  try {
    console.log('=== SIGNIN REQUEST START ===');
    console.log('Auth Header:', c.req.header('Authorization')?.substring(0, 30) + '...');
    console.log('Method:', c.req.method);
    console.log('URL:', c.req.url);
    
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      console.log('Missing email or password');
      return c.json({ error: 'Email и пароль обязательны' }, 400);
    }
    
    console.log('Attempting signin for:', email);
    
    // Use the auth client (with ANON_KEY) for user sign-in
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase signin error:', error);
      console.error('Error details:', { message: error.message, status: error.status, name: error.name });
      
      // More specific error messages
      if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
        return c.json({ 
          error: 'Неверный email или пароль. Если у вас еще нет аккаунта, зарегистрируйтесь.',
          code: 'INVALID_CREDENTIALS'
        }, 400);
      } else if (error.message.includes('Email not confirmed')) {
        return c.json({ error: 'Email не подтвержден' }, 400);
      } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
        return c.json({ 
          error: 'Неверный email или пароль. Если у вас еще нет аккаунта, зарегистрируйтесь.',
          code: 'INVALID_CREDENTIALS'
        }, 400);
      }
      
      return c.json({ error: `Ошибка входа: ${error.message}` }, 400);
    }

    if (!data.user || !data.session) {
      console.error('No user data or session returned from signin');
      return c.json({ error: 'Пользователь не найден' }, 400);
    }

    console.log('User signed in successfully:', data.user.id);

    const userData = await kv.get(`user:${data.user.id}`);
    
    if (!userData) {
      console.error('User not found in KV store, creating entry...');
      // User exists in Auth but not in KV - create entry
      const newUser = {
        id: data.user.id,
        email: data.user.email!,
        username: data.user.user_metadata?.username || email.split('@')[0],
        role: 'user' as const,
        status: 'online' as const,
        created_at: data.user.created_at || new Date().toISOString()
      };
      
      await kv.set(`user:${newUser.id}`, newUser);
      await kv.set(`username:${newUser.username.toLowerCase()}`, newUser.id);
      
      return c.json({
        user: newUser,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });
    }

    // Проверка на удаление
    // @ts-ignore
    if (userData.deleted) {
      return c.json({ error: 'Ваш аккаунт был удален' }, 403);
    }

    // Забаненные пользователи могут войти, но будут ограничены в функционале
    // Они увидят только Азкабан и не смогут переключаться на другие комнаты
    
    // Обновляем статус на онлайн
    await auth.updateUserStatus(data.user.id, 'online');

    return c.json({
      user: userData,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
  } catch (err) {
    console.error('Signin exception:', err);
    return c.json({ error: `Ошибка при входе: ${err.message}` }, 500);
  }
});

// Получить текущего пользователя
app.get("/make-server-b0f1e6d5/auth/me", async (c) => {
  try {
    console.log('GET /auth/me - Starting request handler');
    const authHeader = c.req.header('Authorization');
    console.log('GET /auth/me - Authorization header:', authHeader ? authHeader.substring(0, 30) + '...' : 'missing');
    
    const token = authHeader?.split(' ')[1];
    if (!token || token === 'undefined' || token === 'null') {
      console.error('GET /auth/me - No valid token in Authorization header');
      return c.json({ error: 'Токен не предоставлен', code: 'NO_TOKEN' }, 401);
    }

    console.log('GET /auth/me - Token length:', token.length, 'First 20 chars:', token.substring(0, 20));
    
    console.log('GET /auth/me - Calling getUserFromToken...');
    let user;
    try {
      user = await auth.getUserFromToken(token);
    } catch (tokenErr: any) {
      console.error('GET /auth/me - getUserFromToken threw exception:', tokenErr);
      return c.json({ error: 'Ошибка проверки токена', code: 'TOKEN_ERROR' }, 401);
    }
    
    console.log('GET /auth/me - getUserFromToken completed, result:', user ? 'User found' : 'null');
    
    if (!user) {
      console.error('GET /auth/me - getUserFromToken returned null');
      return c.json({ error: 'Недействительный токен - пожалуйста, войдите снова', code: 'INVALID_TOKEN' }, 401);
    }

    console.log('GET /auth/me - User validated successfully:', user.id);
    
    // Обновляем последнюю активность
    console.log('GET /auth/me - Updating last activity...');
    try {
      const updatedUser = { ...user, last_activity: new Date().toISOString() };
      await kv.set(`user:${user.id}`, updatedUser);
      console.log('GET /auth/me - Last activity updated');
      
      console.log('GET /auth/me - Returning user data');
      return c.json({ user: updatedUser });
    } catch (kvErr: any) {
      console.error('GET /auth/me - Error updating KV store:', kvErr);
      // Возвращаем пользователя без обновления активности
      return c.json({ user });
    }
  } catch (err: any) {
    console.error('GET /auth/me - Exception caught:', err);
    console.error('GET /auth/me - Error message:', err?.message);
    console.error('GET /auth/me - Error stack:', err?.stack);
    console.error('GET /auth/me - Error name:', err?.name);
    return c.json({ 
      error: `Ошибка получения пользователя: ${err?.message || 'Unknown error'}`,
      code: 'SERVER_ERROR'
    }, 500);
  }
});

// Выход из системы
app.post("/make-server-b0f1e6d5/auth/signout", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (token) {
      const user = await auth.getUserFromToken(token);
      if (user) {
        // Устанавливаем статус offline и время последней активности
        await auth.updateUserStatus(user.id, 'offline');
        const updatedUser = { ...user, status: 'offline', last_activity: new Date().toISOString() };
        await kv.set(`user:${user.id}`, updatedUser);
      }
    }
    return c.json({ success: true });
  } catch (err) {
    console.error('Signout error:', err);
    return c.json({ error: `Ошибка при выходе: ${err.message}` }, 500);
  }
});

// Обновить токен
app.post("/make-server-b0f1e6d5/auth/refresh", async (c) => {
  try {
    const { refresh_token } = await c.req.json();
    
    if (!refresh_token) {
      return c.json({ error: 'Refresh token не предоставлен' }, 401);
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });

    if (error || !data.session) {
      console.error('Failed to refresh session:', error);
      return c.json({ error: 'Не удалось обновить сессию' }, 401);
    }

    return c.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
  } catch (err: any) {
    console.error('Refresh token error:', err);
    return c.json({ error: `Ошибка обновления токена: ${err.message}` }, 500);
  }
});

// Обновить последнюю активность
app.post("/make-server-b0f1e6d5/auth/activity", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      console.log('Update activity: No token provided');
      return c.json({ error: 'Токен не предоставлен' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      console.log('Update activity: Invalid token (likely expired)');
      // Возвращаем специальную ошибку для истекшего токена
      return c.json({ error: 'Недействительный токен', code: 'TOKEN_EXPIRED' }, 401);
    }

    const updatedUser = { ...user, last_activity: new Date().toISOString(), status: 'online' };
    await kv.set(`user:${user.id}`, updatedUser);
    
    return c.json({ success: true });
  } catch (err: any) {
    console.error('Update activity error:', err);
    return c.json({ error: `Ошибка обновления активности: ${err.message}` }, 500);
  }
});

// Получить список всех пользователей (только для разработки)
app.get("/make-server-b0f1e6d5/auth/list-users", async (c) => {
  try {
    // Get users from Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      return c.json({ error: `Ошибка получения списка: ${listError.message}` }, 500);
    }
    
    // Get users from KV store
    const kvUsers = await kv.getByPrefix('user:');
    
    const userList = users.map(authUser => {
      const kvUser = kvUsers.find((u: any) => u.id === authUser.id);
      return {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        in_auth: true,
        in_kv: !!kvUser,
        username: kvUser?.username || 'N/A',
        role: kvUser?.role || 'N/A'
      };
    });
    
    return c.json({ users: userList });
  } catch (err) {
    console.error('List users error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Удаление пользователя (только для разработки/тестирования)
app.delete("/make-server-b0f1e6d5/auth/delete-user/:email", async (c) => {
  try {
    const email = c.req.param('email');
    
    // Найти пользователя по email в Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      return c.json({ error: `Ошибка поиска пользователя: ${listError.message}` }, 500);
    }
    
    const userToDelete = users.find(u => u.email === email);
    
    if (!userToDelete) {
      return c.json({ error: 'Пользователь не найден' }, 404);
    }
    
    // Удалить из Supabase Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
    
    if (deleteError) {
      return c.json({ error: `Ошибка удаления из Auth: ${deleteError.message}` }, 500);
    }
    
    // Удалить из KV хранилища
    const userData = await kv.get(`user:${userToDelete.id}`);
    if (userData) {
      await kv.del(`user:${userToDelete.id}`);
      // @ts-ignore
      if (userData.username) {
        // @ts-ignore
        await kv.del(`username:${userData.username}`);
      }
    }
    
    console.log('User deleted:', email);
    return c.json({ message: 'Пользователь успешно удален' });
  } catch (err) {
    console.error('Delete user error:', err);
    return c.json({ error: `Ошибка удаления пользователя: ${err.message}` }, 500);
  }
});

// Поиск пользователей
app.get("/make-server-b0f1e6d5/users/search", async (c) => {
  try {
    const query = c.req.query('q') || '';
    const token = c.req.header('Authorization')?.split(' ')[1];
    
    // Получаем текущего пользователя для фильтрации заблокированных
    let currentUserId: string | undefined;
    if (token) {
      const currentUser = await auth.getUserFromToken(token);
      currentUserId = currentUser?.id;
    }
    
    const users = await auth.searchUsers(query, currentUserId);
    return c.json({ users });
  } catch (err) {
    console.error('Search users error:', err);
    return c.json({ error: `Ошибка поиска: ${err.message}` }, 500);
  }
});

// Получить пользователя по ID
app.get("/make-server-b0f1e6d5/users/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const user = await auth.getUserById(userId);
    
    if (!user) {
      return c.json({ error: 'Пользователь не найден' }, 404);
    }
    
    return c.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Добавить в друзья
app.post("/make-server-b0f1e6d5/users/:userId/friend", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const friendId = c.req.param('userId');
    const result = await auth.addFriend(currentUser.id, friendId);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Add friend error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Удалить из др��зей
app.delete("/make-server-b0f1e6d5/users/:userId/friend", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const friendId = c.req.param('userId');
    const result = await auth.removeFriend(currentUser.id, friendId);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Remove friend error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Получить список друзей
app.get("/make-server-b0f1e6d5/users/friends/list", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const friends = await auth.getFriends(currentUser.id);
    return c.json({ friends });
  } catch (err) {
    console.error('Get friends error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Изменить роль пользователя
app.put("/make-server-b0f1e6d5/users/:userId/role", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const userId = c.req.param('userId');
    const { role } = await c.req.json();

    const result = await auth.updateUserRole(userId, role, currentUser.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Update role error:', err);
    return c.json({ error: `Ошибка изменения роли: ${err.message}` }, 500);
  }
});

// Забанить пользователя (отправить в Азкабан)
app.post("/make-server-b0f1e6d5/users/:userId/ban", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const userId = c.req.param('userId');
    const body = await c.req.json().catch(() => ({}));
    const hours = body?.hours;
    const result = await auth.banUser(userId, currentUser.id, hours);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Ban user error:', err);
    return c.json({ error: `Ошибка бана: ${err.message}` }, 500);
  }
});

// Разбанить пользователя
app.post("/make-server-b0f1e6d5/users/:userId/unban", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const userId = c.req.param('userId');
    const result = await auth.unbanUser(userId, currentUser.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Unban user error:', err);
    return c.json({ error: `Ошибка разбана: ${err.message}` }, 500);
  }
});

// Замутить пользователя
app.post("/make-server-b0f1e6d5/users/:userId/mute", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const userId = c.req.param('userId');
    const body = await c.req.json();
    const hours = body?.hours || 24;
    const result = await auth.muteUser(userId, currentUser.id, hours);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Mute user error:', err);
    return c.json({ error: `Ошибка мута: ${err.message}` }, 500);
  }
});

// Размутить пользователя
app.post("/make-server-b0f1e6d5/users/:userId/unmute", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const userId = c.req.param('userId');
    const result = await auth.unmuteUser(userId, currentUser.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Unmute user error:', err);
    return c.json({ error: `Ошибка размута: ${err.message}` }, 500);
  }
});

// Удалить пользователя (мягкое удаление)
app.delete("/make-server-b0f1e6d5/users/:userId", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const userId = c.req.param('userId');
    const result = await auth.deleteUser(userId, currentUser.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Delete user error:', err);
    return c.json({ error: `Ошибка удаления пользователя: ${err.message}` }, 500);
  }
});

// Полное удаление пользователя (только для администраторов)
app.delete("/make-server-b0f1e6d5/users/:userId/permanent", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const userId = c.req.param('userId');
    const result = await auth.permanentDeleteUser(userId, currentUser.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Permanent delete user error:', err);
    return c.json({ error: `Ошибка удаления пользователя: ${err.message}` }, 500);
  }
});

// Заблокировать пользователя
app.post("/make-server-b0f1e6d5/users/:userId/block", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const blockedUserId = c.req.param('userId');
    const result = await auth.blockUser(currentUser.id, blockedUserId);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Block user error:', err);
    return c.json({ error: `Ошибка блокировки: ${err.message}` }, 500);
  }
});

// Разблокировать пользователя
app.post("/make-server-b0f1e6d5/users/:userId/unblock", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const blockedUserId = c.req.param('userId');
    const result = await auth.unblockUser(currentUser.id, blockedUserId);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Unblock user error:', err);
    return c.json({ error: `Ошибка разблокировки: ${err.message}` }, 500);
  }
});

// ========== ROOMS ROUTES ==========

// Создать комнату
app.post("/make-server-b0f1e6d5/rooms", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const { name, type } = await c.req.json();
    const result = await rooms.createRoom(name, type, user.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Create room error:', err);
    return c.json({ error: `Ошибка создания комнаты: ${err.message}` }, 500);
  }
});

// Получить список комнат
app.get("/make-server-b0f1e6d5/rooms", async (c) => {
  try {
    console.log('GET /rooms - Checking authorization header...');
    const authHeader = c.req.header('Authorization');
    console.log('Authorization header:', authHeader);
    
    const token = authHeader?.split(' ')[1];
    if (!token) {
      console.error('No token provided in Authorization header');
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    console.log('Token extracted, validating user...');
    const user = await auth.getUserFromToken(token);
    console.log('User validation result:', user ? `User ${user.id} (${user.username})` : 'null');
    
    if (!user) {
      console.error('Invalid token - user not found');
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    // Проверяем query параметр godMode
    const godMode = c.req.query('godMode') === 'true';
    console.log('God Mode requested:', godMode, 'User:', user.username);

    console.log('Fetching rooms for user:', user.id);
    const roomsList = await rooms.getRooms(user.id, godMode);
    console.log('Rooms fetched successfully:', roomsList.length);
    return c.json({ rooms: roomsList });
  } catch (err) {
    console.error('Get rooms error:', err);
    return c.json({ error: `Ошибка получения комнат: ${err.message}` }, 500);
  }
});

// Присоединиться к комнате
app.post("/make-server-b0f1e6d5/rooms/:roomId/join", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const roomId = c.req.param('roomId');
    
    // Проверяем query параметр godMode
    const godMode = c.req.query('godMode') === 'true';
    
    const result = await rooms.joinRoom(roomId, user.id, godMode);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Join room error:', err);
    return c.json({ error: `Ошибка входа в комнату: ${err.message}` }, 500);
  }
});

// Покинуть комнату
app.post("/make-server-b0f1e6d5/rooms/:roomId/leave", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const roomId = c.req.param('roomId');
    const result = await rooms.leaveRoom(roomId, user.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Leave room error:', err);
    return c.json({ error: `Ошибка выхода из комнаты: ${err.message}` }, 500);
  }
});

// Пригласить в комнату
app.post("/make-server-b0f1e6d5/rooms/:roomId/invite", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const roomId = c.req.param('roomId');
    const { userId: invitedUserId } = await c.req.json();
    
    const result = await rooms.inviteToRoom(roomId, invitedUserId, user.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Invite to room error:', err);
    return c.json({ error: `Ошибка приглашения: ${err.message}` }, 500);
  }
});

// Закрепить сообщение
app.post("/make-server-b0f1e6d5/rooms/:roomId/pin", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const roomId = c.req.param('roomId');
    const { messageId } = await c.req.json();
    
    const result = await rooms.pinMessage(roomId, messageId, user.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Pin message error:', err);
    return c.json({ error: `Ошибка закрепления: ${err.message}` }, 500);
  }
});

// Открепить сообщение
app.delete("/make-server-b0f1e6d5/rooms/:roomId/pin", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const roomId = c.req.param('roomId');
    const result = await rooms.unpinMessage(roomId, user.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Unpin message error:', err);
    return c.json({ error: `Ошибка открепления: ${err.message}` }, 500);
  }
});

// Создать или получить DM комнату
app.post("/make-server-b0f1e6d5/rooms/dm", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const { userId } = await c.req.json();
    const result = await rooms.getOrCreateDM(user.id, userId);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Get or create DM error:', err);
    return c.json({ error: `Ошибка создания DM: ${err.message}` }, 500);
  }
});

// Удалить комнату (мягкое удаление)
app.delete("/make-server-b0f1e6d5/rooms/:roomId", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const roomId = c.req.param('roomId');
    const result = await rooms.deleteRoom(roomId, user.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Delete room error:', err);
    return c.json({ error: `Ошибк�� удаления комнаты: ${err.message}` }, 500);
  }
});

// Очистка дублирующих комнат Азкабан (только для админа)
app.post("/make-server-b0f1e6d5/admin/cleanup-azkaban", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    if (user.role !== 'admin') {
      return c.json({ error: 'Только администратор может выполнять очистку' }, 403);
    }

    const result = await rooms.cleanupAzkabanRooms();
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Cleanup azkaban error:', err);
    return c.json({ error: `Ошибка очистки: ${err.message}` }, 500);
  }
});

// Очистить базу данных (удалить все сообщения, комнаты, файлы, оставить пользователей)
app.post("/make-server-b0f1e6d5/admin/clear-data", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    if (user.role !== 'admin') {
      return c.json({ error: 'Только администратор может очищать базу данных' }, 403);
    }

    console.log('=== НАЧАЛО ОЧИСТКИ БАЗЫ ДАННЫХ ===');
    console.log('Инициатор:', user.username);

    let deletedMessages = 0;
    let deletedRooms = 0;
    let deletedDMs = 0;
    let deletedNotifications = 0;

    // 1. Удалить все сообщения
    const messagesData = await kv.getByPrefix('message:');
    for (const item of messagesData) {
      await kv.del(item.key);
      deletedMessages++;
    }
    console.log('Удалено сообщений:', deletedMessages);

    // 2. Удалить все комнаты, кроме системных (Главная, Азкабан)
    const roomsData = await kv.getByPrefix('room:');
    for (const item of roomsData) {
      const room = item.value;
      // Сохраняем только системные комнаты
      if (!room.name || (room.name !== 'Главная' && room.name !== 'Азкабан' && room.type !== 'system')) {
        await kv.del(item.key);
        deletedRooms++;
      }
    }
    console.log('Удалено комнат:', deletedRooms);

    // 3. Удалить все DM
    const dmsData = await kv.getByPrefix('dm:');
    for (const item of dmsData) {
      await kv.del(item.key);
      deletedDMs++;
    }
    console.log('Удалено DM:', deletedDMs);

    // 4. Удалить все уведомления
    const notificationsData = await kv.getByPrefix('notification:');
    for (const item of notificationsData) {
      await kv.del(item.key);
      deletedNotifications++;
    }
    console.log('Удалено уведомлений:', deletedNotifications);

    // 5. Очистить все файловые бакеты
    const bucketNames = [
      'make-b0f1e6d5-voice',
      'make-b0f1e6d5-video',
      'make-b0f1e6d5-images',
      'make-b0f1e6d5-avatars'
    ];

    let deletedFiles = 0;
    for (const bucketName of bucketNames) {
      try {
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from(bucketName)
          .list();

        if (!listError && files && files.length > 0) {
          const filePaths = files.map(f => f.name);
          const { error: deleteError } = await supabaseAdmin.storage
            .from(bucketName)
            .remove(filePaths);

          if (!deleteError) {
            deletedFiles += filePaths.length;
            console.log(`Очищен бакет ${bucketName}: ${filePaths.length} файлов`);
          }
        }
      } catch (err) {
        console.error(`Ошибка очистки бакета ${bucketName}:`, err);
      }
    }

    console.log('=== ОЧИСТКА ЗАВЕРШЕНА ===');

    return c.json({
      success: true,
      message: 'База данных очищена',
      stats: {
        deletedMessages,
        deletedRooms,
        deletedDMs,
        deletedNotifications,
        deletedFiles
      }
    });
  } catch (err) {
    console.error('Clear data error:', err);
    return c.json({ error: `Ошибка очистки базы данных: ${err.message}` }, 500);
  }
});

// Получить или создать комнату избранного
app.post("/make-server-b0f1e6d5/rooms/favorites", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const result = await rooms.getOrCreateFavorites(user.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Get or create favorites error:', err);
    return c.json({ error: `Ошибка создания избранного: ${err.message}` }, 500);
  }
});

// ========== MESSAGES ROUTES ==========

// Отправить сообщение
app.post("/make-server-b0f1e6d5/messages", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const { roomId, content, type, replyTo } = await c.req.json();
    const result = await messages.sendMessage(roomId, user.id, content, type, replyTo);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Send message error:', err);
    return c.json({ error: `Ошибка отправки сообщения: ${err.message}` }, 500);
  }
});

// Получить сообщения комнаты
app.get("/make-server-b0f1e6d5/messages/:roomId", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Неверный токен' }, 401);
    }

    const roomId = c.req.param('roomId');
    const limit = parseInt(c.req.query('limit') || '100');
    
    console.log(`Getting messages for room ${roomId}, user ${user.username} (${user.id})`);
    
    // Проверяем доступ к комнате
    const room = await rooms.getRoom(roomId);
    if (!room) {
      console.log(`Room ${roomId} not found`);
      return c.json({ error: 'Комната не найдена' }, 404);
    }

    console.log(`Room found: ${room.name}, type: ${room.type}, members: ${room.members.length}`);
    console.log(`User ${user.id} is member: ${room.members.includes(user.id)}, banned: ${user.banned}`);

    const isAzkaban = room.name === '🔒 Азкабан';

    // Забаненные могут видеть только Азкабан
    if (user.banned && !isAzkaban) {
      console.log(`Banned user ${user.id} tried to access non-Azkaban room ${roomId}`);
      return c.json({ error: 'Забаненные пользователи могут находиться только в Азкабане' }, 403);
    }

    // Проверяем режим "Глаз Бога" - только iBro может использовать
    const godModeParam = c.req.query('godMode');
    const isGodMode = user.username === 'iBro' && godModeParam === 'true';
    
    console.log(`God mode: ${isGodMode} (user: ${user.username}, param: ${godModeParam})`);

    // Проверяем членство в комнате
    // Для DM комнат проверяем также dm_participants
    const isMember = room.members.includes(user.id) || 
                     (room.type === 'dm' && room.dm_participants?.includes(user.id));
    
    if (!isMember) {
      // В режиме Глаз Бога iBro имеет доступ ко всем комнатам
      if (isGodMode) {
        console.log(`God mode access granted for user ${user.id} to room ${roomId}`);
        // Не добавляем в участники, но даем доступ
      } else if (room.type === 'public') {
        // Автоматически добавляем в публичную комнату
        room.members.push(user.id);
        await kv.set(`room:${roomId}`, room);
        console.log(`Auto-joined user ${user.id} to public room ${roomId} (getting messages)`);
      } else if (room.type === 'dm' && room.dm_participants?.includes(user.id)) {
        // Для DM комнат, если пользователь в dm_participants но не в members, добавляем в members
        room.members.push(user.id);
        await kv.set(`room:${roomId}`, room);
        console.log(`Auto-added user ${user.id} to DM room members ${roomId}`);
      } else {
        // Для приватных комнат требуется быть участником
        console.log(`Access denied: user ${user.id} is not member of ${room.type} room ${roomId}`);
        return c.json({ error: 'Вы не являетесь участником комнаты' }, 403);
      }
    }
    
    const messagesList = await messages.getMessages(roomId, limit);
    console.log(`Returning ${messagesList.length} messages for room ${roomId}`);
    return c.json({ messages: messagesList });
  } catch (err) {
    console.error('Get messages error:', err);
    return c.json({ error: `Ошибка получения сообщений: ${err.message}` }, 500);
  }
});

// Добавить реакцию
app.post("/make-server-b0f1e6d5/messages/:messageId/react", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const messageId = c.req.param('messageId');
    const { emoji } = await c.req.json();
    
    const result = await messages.addReaction(messageId, user.id, emoji);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Add reaction error:', err);
    return c.json({ error: `Ошибка добавления реакции: ${err.message}` }, 500);
  }
});

// Редактировать сообщение
app.put("/make-server-b0f1e6d5/messages/:messageId", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const messageId = c.req.param('messageId');
    const { content } = await c.req.json();
    
    if (!content || !content.trim()) {
      return c.json({ error: 'Контент сообщения не может быть пустым' }, 400);
    }

    const result = await messages.editMessage(messageId, user.id, content);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Edit message error:', err);
    return c.json({ error: `Ошибка редактирования сообщения: ${err.message}` }, 500);
  }
});

// Удалить сообщение
app.delete("/make-server-b0f1e6d5/messages/:messageId", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const messageId = c.req.param('messageId');
    const result = await messages.deleteMessage(messageId, user.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Delete message error:', err);
    return c.json({ error: `Ошибка удаления сообщения: ${err.message}` }, 500);
  }
});

// Поиск сообщений
app.get("/make-server-b0f1e6d5/messages/:roomId/search", async (c) => {
  try {
    const roomId = c.req.param('roomId');
    const query = c.req.query('q') || '';
    
    const messagesList = await messages.searchMessages(roomId, query);
    return c.json({ messages: messagesList });
  } catch (err) {
    console.error('Search messages error:', err);
    return c.json({ error: `Ошибка поиска: ${err.message}` }, 500);
  }
});

// Отметить комнату как прочитанную
app.post("/make-server-b0f1e6d5/rooms/:roomId/mark-read", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const roomId = c.req.param('roomId');
    const body = await c.req.json().catch(() => ({}));
    const clearMentions = body?.clearMentions || false;
    const clearReactions = body?.clearReactions || false;

    // Проверяем, не в режиме ли Глаз Бога (пользователь не является участником комнаты)
    const room = await kv.get(`room:${roomId}`) as any;
    if (room && !room.members.includes(user.id)) {
      // В режиме Глаз Бога - не обновляем счетчики
      console.log('User in God Mode - skipping mark as read');
      return c.json({ success: true });
    }

    const result = await messages.markRoomAsRead(roomId, user.id, clearMentions, clearReactions);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Mark room as read error:', err);
    return c.json({ error: `Ошибка отметки комнаты: ${err.message}` }, 500);
  }
});

// Создать опрос
app.post("/make-server-b0f1e6d5/polls", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const { roomId, question, options, anonymous } = await c.req.json();
    const result = await messages.createPoll(roomId, user.id, question, options, anonymous);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Create poll error:', err);
    return c.json({ error: `Ошибка создания опроса: ${err.message}` }, 500);
  }
});

// Получить опрос по ID
app.get("/make-server-b0f1e6d5/polls/:pollId", async (c) => {
  try {
    const pollId = c.req.param('pollId');
    const poll = await kv.get(`poll:${pollId}`);
    
    if (!poll) {
      return c.json({ error: 'Опрос не найден' }, 404);
    }

    // Не возвращаем удаленные опросы
    // @ts-ignore
    if (poll.deleted) {
      return c.json({ error: 'Опрос удален' }, 404);
    }

    return c.json({ poll });
  } catch (err) {
    console.error('Get poll error:', err);
    return c.json({ error: `Ошибка получения опроса: ${err.message}` }, 500);
  }
});

// Проголосовать в опросе
app.post("/make-server-b0f1e6d5/polls/:pollId/vote", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const pollId = c.req.param('pollId');
    const { optionIndex } = await c.req.json();
    
    console.log('Vote poll request:', { pollId, optionIndex, userId: user.id });
    
    const result = await messages.votePoll(pollId, user.id, optionIndex);
    
    if (result.error) {
      console.error('Vote poll error from messages.votePoll:', result.error);
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Vote poll error:', err);
    return c.json({ error: `Ошибка голосования: ${err.message}` }, 500);
  }
});

// ========== NOTIFICATIONS ROUTES ==========

// Проверить активный запрос в друзья
app.get("/make-server-b0f1e6d5/friend-requests/:userId/check", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const toUserId = c.req.param('userId');
    const result = await notifications.checkFriendRequest(currentUser.id, toUserId);
    
    return c.json(result);
  } catch (err) {
    console.error('Check friend request error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Отправить запрос в друзья (заменяет прямое добавление)
app.post("/make-server-b0f1e6d5/friend-requests/:userId", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const toUserId = c.req.param('userId');
    const result = await notifications.sendFriendRequest(currentUser.id, toUserId);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Send friend request error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Принять запрос в друзья
app.post("/make-server-b0f1e6d5/friend-requests/:requestKey/accept", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const requestKey = c.req.param('requestKey');
    const result = await notifications.acceptFriendRequest(requestKey, currentUser.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Accept friend request error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Отклонить запрос в друзья
app.post("/make-server-b0f1e6d5/friend-requests/:requestKey/reject", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const requestKey = c.req.param('requestKey');
    const result = await notifications.rejectFriendRequest(requestKey, currentUser.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Reject friend request error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Получить уведомления
app.get("/make-server-b0f1e6d5/notifications", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      console.log('GET /notifications: Missing authorization header');
      return c.json({ error: 'Missing authorization header' }, 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('GET /notifications: Invalid authorization header format');
      return c.json({ error: 'Invalid authorization header format' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      console.log('GET /notifications: Invalid token');
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const notificationsList = await notifications.getUserNotifications(currentUser.id);
    return c.json({ notifications: notificationsList });
  } catch (err) {
    console.error('Get notifications error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Отметить уведомление как прочитанное
app.post("/make-server-b0f1e6d5/notifications/:notificationId/read", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const notificationId = c.req.param('notificationId');
    const result = await notifications.markNotificationAsRead(notificationId, currentUser.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Mark notification as read error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Удалить уведомление
app.delete("/make-server-b0f1e6d5/notifications/:notificationId", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const notificationId = c.req.param('notificationId');
    const result = await notifications.deleteNotification(notificationId, currentUser.id);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Delete notification error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// ========== PROFILE ROUTES ==========

// Сменить пароль
app.post("/make-server-b0f1e6d5/profile/change-password", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const { oldPassword, newPassword } = await c.req.json();
    
    if (!oldPassword || !newPassword) {
      return c.json({ error: 'Требуются оба пароля' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ error: 'Новый пароль должен содержать минимум 6 символов' }, 400);
    }

    const result = await auth.changePassword(currentUser.id, oldPassword, newPassword);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Change password error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Сменить email
app.post("/make-server-b0f1e6d5/profile/change-email", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const { newEmail, password } = await c.req.json();
    
    if (!newEmail || !password) {
      return c.json({ error: 'Требуются email и пароль' }, 400);
    }

    const result = await auth.changeEmail(currentUser.id, newEmail, password);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Change email error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Обновить профиль
app.put("/make-server-b0f1e6d5/profile", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const updates = await c.req.json();
    const result = await auth.updateUserProfile(currentUser.id, updates);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Update profile error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// Загрузить аватар
app.post("/make-server-b0f1e6d5/profile/avatar", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    // Получаем данные из formData
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'Файл не предоставлен' }, 400);
    }

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'Можно загружать только изображения' }, 400);
    }

    // Проверка размера (5 МБ для аватара)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: 'Файл слишком большой. Максимальный размер: 5 МБ' }, 400);
    }

    // Конвертируем файл в Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Загружаем файл в storage
    const uploadResult = await storage.uploadFile(
      fileData,
      file.name,
      file.type,
      currentUser.id
    );

    if (uploadResult.error) {
      return c.json({ error: uploadResult.error }, 400);
    }

    // Обновляем профиль пользователя с новым URL аватара
    const user = await kv.get(`user:${currentUser.id}`) as any;
    if (!user) {
      return c.json({ error: 'Пользователь не найден' }, 404);
    }

    console.log('Avatar upload - User before update:', { 
      id: user.id, 
      username: user.username, 
      oldAvatar: user.avatar,
      oldAvatarPath: user.avatar_path 
    });

    // Удаляем старый аватар если он есть
    if (user.avatar_path) {
      console.log('Deleting old avatar:', user.avatar_path);
      await storage.deleteFile(user.avatar_path);
    }

    user.avatar = uploadResult.data!.url;
    user.avatar_path = uploadResult.data!.path;
    
    console.log('Avatar upload - New avatar URL:', user.avatar);
    console.log('Avatar upload - New avatar path:', user.avatar_path);
    
    await kv.set(`user:${currentUser.id}`, user);
    
    console.log('Avatar upload - User updated successfully');

    return c.json({ 
      user,
      avatarUrl: uploadResult.data!.url 
    });
  } catch (err) {
    console.error('Upload avatar error:', err);
    return c.json({ error: `Ошибка загрузки аватара: ${err.message}` }, 500);
  }
});

// Обновить активность пользователя (heartbeat)
app.post("/make-server-b0f1e6d5/heartbeat", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    // Обновляем last_activity
    const user = await kv.get(`user:${currentUser.id}`) as any;
    if (user) {
      user.last_activity = new Date().toISOString();
      await kv.set(`user:${currentUser.id}`, user);
    }

    return c.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Heartbeat error:', err);
    return c.json({ error: `Ошибка: ${err.message}` }, 500);
  }
});

// ========== STORAGE ROUTES ==========

// Загрузка файла
app.post("/make-server-b0f1e6d5/storage/upload", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    // Получаем данные из formData
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'Файл не предоставлен' }, 400);
    }

    // Проверка размера (50 МБ)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: 'Файл слишком большой. Максимальный размер: 50 МБ' }, 400);
    }

    // Конвертируем файл в Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Загружаем файл
    const result = await storage.uploadFile(
      fileData,
      file.name,
      file.type,
      user.id
    );

    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Upload file error:', err);
    return c.json({ error: `Ошибка загрузки файла: ${err.message}` }, 500);
  }
});

// Функция инициализации системных комнат
async function initializeSystemRooms() {
  try {
    console.log('Checking for system rooms...');
    
    // Проверяем наличие комнаты Азкабан
    const allRooms = await kv.getByPrefix('room:');
    const azkabanExists = allRooms.some((room: any) => room.name === '🔒 Азкабан');
    
    if (!azkabanExists) {
      console.log('Creating Azkaban room...');
      // Создаем комнату от имени системного пользователя
      const systemUserId = 'system';
      const azkabanRoom = {
        id: crypto.randomUUID(),
        name: '🔒 Азкабан',
        type: 'private' as const,
        created_by: systemUserId,
        created_at: new Date().toISOString(),
        members: [], // Изначально пустая, админы добавляются автоматически при банах
      };
      
      await kv.set(`room:${azkabanRoom.id}`, azkabanRoom);
      console.log('Azkaban room created successfully');
    } else {
      console.log('Azkaban room already exists');
    }
  } catch (error) {
    console.error('Error initializing system rooms:', error);
  }
}

// ========== DIRECT MESSAGES ROUTES ==========

// Получить или создать DM
app.post("/make-server-b0f1e6d5/dm/create", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const { userId } = await c.req.json();
    const result = await directMessages.getOrCreateDM(user.id, userId);
    
    if (result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  } catch (err) {
    console.error('Get or create DM error:', err);
    return c.json({ error: `Ошибка создания чата: ${err.message}` }, 500);
  }
});

// Получить все DM пользователя
app.get("/make-server-b0f1e6d5/dm/list", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const result = await directMessages.getUserDMs(user.id);
    
    // Проверяем, если это ошибка
    if (result && typeof result === 'object' && 'error' in result) {
      return c.json({ error: result.error }, 400);
    }
    
    // Иначе это массив DM
    const dms = Array.isArray(result) ? result : [];
    return c.json({ dms });
  } catch (err: any) {
    console.error('Get DMs error:', err);
    return c.json({ error: `Ошибка получения чатов: ${err?.message || 'Unknown error'}` }, 500);
  }
});

// Отправить сообщение в DM
app.post("/make-server-b0f1e6d5/dm/:dmId/messages", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const dmId = c.req.param('dmId');
    const { content, type, replyTo } = await c.req.json();
    
    const result = await directMessages.sendDMMessage(dmId, user.id, content, type, replyTo);
    
    if (result && result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data || {});
  } catch (err: any) {
    console.error('Send DM message error:', err);
    return c.json({ error: `Ошибка отправки сообщения: ${err?.message || 'Unknown error'}` }, 500);
  }
});

// Получить сообщения из DM
app.get("/make-server-b0f1e6d5/dm/:dmId/messages", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const dmId = c.req.param('dmId');
    const limit = parseInt(c.req.query('limit') || '100');
    
    const messages = await directMessages.getDMMessages(dmId, user.id, limit);
    return c.json({ messages: Array.isArray(messages) ? messages : [] });
  } catch (err: any) {
    console.error('Get DM messages error:', err);
    return c.json({ error: `Ошибка получения сообщений: ${err?.message || 'Unknown error'}` }, 500);
  }
});

// Отметить DM как прочитанный
app.post("/make-server-b0f1e6d5/dm/:dmId/read", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const dmId = c.req.param('dmId');
    const result = await directMessages.markDMAsRead(dmId, user.id);
    
    if (result && result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data || { success: true });
  } catch (err: any) {
    console.error('Mark DM as read error:', err);
    return c.json({ error: `Ошибка отметки чата: ${err?.message || 'Unknown error'}` }, 500);
  }
});

// Удалить DM (скрыть для пользователя)
app.delete("/make-server-b0f1e6d5/dm/:dmId", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const user = await auth.getUserFromToken(token);
    if (!user) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    const dmId = c.req.param('dmId');
    const result = await directMessages.deleteDM(dmId, user.id);
    
    if (result && result.error) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data || { success: true });
  } catch (err: any) {
    console.error('Delete DM error:', err);
    return c.json({ error: `Ошибка удаления чата: ${err?.message || 'Unknown error'}` }, 500);
  }
});

// ========== ADMIN ROUTES ==========

// Очистить базу данных от всех сообщений и файлов (только для администраторов)
app.post("/make-server-b0f1e6d5/admin/clear-data", async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return c.json({ error: 'Требуется авторизация' }, 401);
    }

    const currentUser = await auth.getUserFromToken(token);
    if (!currentUser) {
      return c.json({ error: 'Недействительный токен' }, 401);
    }

    // Проверяем, что пользователь - администратор
    if (currentUser.role !== 'admin') {
      return c.json({ error: 'Только администраторы могут очищать данные' }, 403);
    }

    console.log('Clearing database - started by:', currentUser.username);

    // Получаем все ключи из базы
    const allKeys = await kv.getByPrefix('');
    
    let deletedMessages = 0;
    let deletedRooms = 0;
    let deletedNotifications = 0;
    let deletedDMs = 0;

    // Удаляем все сообщения
    for (const item of allKeys) {
      if (item.key && item.key.startsWith('message:')) {
        await kv.del(item.key);
        deletedMessages++;
      }
    }

    // Удаляем все комнаты (кроме системных)
    for (const item of allKeys) {
      if (item.key && item.key.startsWith('room:')) {
        const room = item.value;
        // Не удаляем системные комнаты
        if (room && !room.name?.includes('Азкабан') && !room.name?.includes('Избранное')) {
          await kv.del(item.key);
          deletedRooms++;
        } else if (room) {
          // Очищаем сообщения из системных комнат
          const clearedRoom = {
            ...room,
            messages: [],
            unread_count: {},
            last_message: null,
            last_activity: new Date().toISOString()
          };
          await kv.set(item.key, clearedRoom);
        }
      }
    }

    // Удаляем все личные сообщения
    for (const item of allKeys) {
      if (item.key && item.key.startsWith('dm:')) {
        await kv.del(item.key);
        deletedDMs++;
      }
    }

    // Удаляем все уведомления
    for (const item of allKeys) {
      if (item.key && (item.key.startsWith('notification:') || item.key.startsWith('friend_request:'))) {
        await kv.del(item.key);
        deletedNotifications++;
      }
    }

    // Очищаем хранилище файлов
    try {
      const buckets = ['make-b0f1e6d5-voice', 'make-b0f1e6d5-video', 'make-b0f1e6d5-images', 'make-b0f1e6d5-avatars'];
      
      for (const bucketName of buckets) {
        try {
          const { data: files } = await supabaseAdmin.storage.from(bucketName).list();
          
          if (files && files.length > 0) {
            const filePaths = files.map(file => file.name);
            await supabaseAdmin.storage.from(bucketName).remove(filePaths);
            console.log(`Cleared ${filePaths.length} files from bucket ${bucketName}`);
          }
        } catch (bucketError) {
          console.log(`Bucket ${bucketName} might not exist or is empty:`, bucketError.message);
        }
      }
    } catch (storageError) {
      console.error('Error clearing storage:', storageError);
    }

    console.log('Database cleared successfully:', {
      deletedMessages,
      deletedRooms,
      deletedDMs,
      deletedNotifications
    });

    return c.json({
      success: true,
      message: 'База данных успешно очищена',
      stats: {
        deletedMessages,
        deletedRooms,
        deletedDMs,
        deletedNotifications
      }
    });
  } catch (err) {
    console.error('Clear data error:', err);
    return c.json({ error: `Ошибка очистки данных: ${err.message}` }, 500);
  }
});

console.log('=================================');
console.log('Server starting...');
console.log('SUPABASE_URL:', Deno.env.get('SUPABASE_URL') ? 'set' : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', Deno.env.get('SUPABASE_ANON_KEY') ? 'set' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'set' : 'NOT SET');
console.log('Server ready to accept requests');
console.log('=================================');

// Инициализируем storage и системные комнаты асинхронно после запуска сервера
storage.initializeStorage().catch(err => {
  console.error('Failed to initialize storage (non-fatal):', err);
});

initializeSystemRooms().catch(err => {
  console.error('Failed to initialize system rooms (non-fatal):', err);
});

// Mount achievements routes
app.route('/', achievementsApp);

Deno.serve(app.fetch);
