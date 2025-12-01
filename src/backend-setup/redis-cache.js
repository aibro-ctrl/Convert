/**
 * Redis Cache Manager для чата "Конверт"
 * Управление кэшем для оптимизации производительности
 */

const Redis = require('ioredis');

class RedisCache {
  constructor(config = {}) {
    this.redis = new Redis({
      host: config.host || process.env.VITE_REDIS_HOST || 'localhost',
      port: config.port || process.env.VITE_REDIS_PORT || 6379,
      password: config.password || process.env.REDIS_PASSWORD || undefined,
      db: config.db || process.env.VITE_REDIS_DB || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('connect', () => {
      console.log('✓ Redis подключен');
    });

    this.redis.on('error', (err) => {
      console.error('✗ Redis ошибка:', err.message);
    });

    // Префиксы для разных типов данных
    this.prefixes = {
      USER: 'user:',
      ROOM: 'room:',
      MESSAGE: 'message:',
      ROOMS_LIST: 'rooms:list:',
      MESSAGES_LIST: 'messages:list:',
      SESSION: 'session:',
      ONLINE_USERS: 'online:users',
    };

    // TTL (время жизни кэша) в секундах
    this.ttl = {
      USER: 300, // 5 минут
      ROOM: 180, // 3 минуты
      MESSAGE: 120, // 2 минуты
      ROOMS_LIST: 60, // 1 минута
      MESSAGES_LIST: 30, // 30 секунд
      SESSION: 86400, // 24 часа
      ONLINE_USERS: 60, // 1 минута
    };
  }

  // ============ ПОЛЬЗОВАТЕЛИ ============

  async cacheUser(userId, userData) {
    const key = this.prefixes.USER + userId;
    await this.redis.setex(key, this.ttl.USER, JSON.stringify(userData));
  }

  async getUser(userId) {
    const key = this.prefixes.USER + userId;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateUser(userId) {
    const key = this.prefixes.USER + userId;
    await this.redis.del(key);
  }

  // ============ КОМНАТЫ ============

  async cacheRoom(roomId, roomData) {
    const key = this.prefixes.ROOM + roomId;
    await this.redis.setex(key, this.ttl.ROOM, JSON.stringify(roomData));
  }

  async getRoom(roomId) {
    const key = this.prefixes.ROOM + roomId;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateRoom(roomId) {
    const key = this.prefixes.ROOM + roomId;
    await this.redis.del(key);
  }

  async cacheRoomsList(userId, roomsData) {
    const key = this.prefixes.ROOMS_LIST + userId;
    await this.redis.setex(key, this.ttl.ROOMS_LIST, JSON.stringify(roomsData));
  }

  async getRoomsList(userId) {
    const key = this.prefixes.ROOMS_LIST + userId;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateRoomsList(userId) {
    const key = this.prefixes.ROOMS_LIST + userId;
    await this.redis.del(key);
  }

  // ============ СООБЩЕНИЯ ============

  async cacheMessage(messageId, messageData) {
    const key = this.prefixes.MESSAGE + messageId;
    await this.redis.setex(key, this.ttl.MESSAGE, JSON.stringify(messageData));
  }

  async getMessage(messageId) {
    const key = this.prefixes.MESSAGE + messageId;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateMessage(messageId) {
    const key = this.prefixes.MESSAGE + messageId;
    await this.redis.del(key);
  }

  async cacheMessagesList(roomId, messagesData) {
    const key = this.prefixes.MESSAGES_LIST + roomId;
    await this.redis.setex(key, this.ttl.MESSAGES_LIST, JSON.stringify(messagesData));
  }

  async getMessagesList(roomId) {
    const key = this.prefixes.MESSAGES_LIST + roomId;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateMessagesList(roomId) {
    const key = this.prefixes.MESSAGES_LIST + roomId;
    await this.redis.del(key);
  }

  // ============ СЕССИИ ============

  async setSession(sessionId, sessionData) {
    const key = this.prefixes.SESSION + sessionId;
    await this.redis.setex(key, this.ttl.SESSION, JSON.stringify(sessionData));
  }

  async getSession(sessionId) {
    const key = this.prefixes.SESSION + sessionId;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId) {
    const key = this.prefixes.SESSION + sessionId;
    await this.redis.del(key);
  }

  // ============ ОНЛАЙН ПОЛЬЗОВАТЕЛИ ============

  async addOnlineUser(userId, userData = {}) {
    await this.redis.zadd(
      this.prefixes.ONLINE_USERS,
      Date.now(),
      JSON.stringify({ userId, ...userData })
    );
  }

  async removeOnlineUser(userId) {
    const members = await this.redis.zrange(this.prefixes.ONLINE_USERS, 0, -1);
    for (const member of members) {
      const data = JSON.parse(member);
      if (data.userId === userId) {
        await this.redis.zrem(this.prefixes.ONLINE_USERS, member);
        break;
      }
    }
  }

  async getOnlineUsers() {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Удаляем старые записи
    await this.redis.zremrangebyscore(this.prefixes.ONLINE_USERS, 0, fiveMinutesAgo);

    // Получаем активных пользователей
    const members = await this.redis.zrange(this.prefixes.ONLINE_USERS, 0, -1);
    return members.map(m => JSON.parse(m));
  }

  async getOnlineCount() {
    const users = await this.getOnlineUsers();
    return users.length;
  }

  // ============ REAL-TIME СОБЫТИЯ ============

  async publishRoomUpdate(roomId, data) {
    await this.redis.publish(`room:${roomId}`, JSON.stringify(data));
  }

  async publishUserUpdate(userId, data) {
    await this.redis.publish(`user:${userId}`, JSON.stringify(data));
  }

  async subscribeToRoom(roomId, callback) {
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(`room:${roomId}`);
    
    subscriber.on('message', (channel, message) => {
      callback(JSON.parse(message));
    });

    return () => subscriber.unsubscribe(`room:${roomId}`);
  }

  async subscribeToUser(userId, callback) {
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(`user:${userId}`);
    
    subscriber.on('message', (channel, message) => {
      callback(JSON.parse(message));
    });

    return () => subscriber.unsubscribe(`user:${userId}`);
  }

  // ============ ИНВАЛИДАЦИЯ КЭША ============

  async invalidateAll() {
    await this.redis.flushdb();
    console.log('✓ Весь кэш очищен');
  }

  async invalidatePattern(pattern) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      console.log(`✓ Удалено ${keys.length} ключей по шаблону: ${pattern}`);
    }
  }

  // ============ СТАТИСТИКА ============

  async getStats() {
    const info = await this.redis.info();
    const dbsize = await this.redis.dbsize();
    
    // Парсим info
    const lines = info.split('\r\n');
    const stats = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        stats[key] = value;
      }
    });

    return {
      connected: true,
      keys: dbsize,
      memory: stats.used_memory_human,
      uptime: parseInt(stats.uptime_in_seconds),
      version: stats.redis_version,
    };
  }

  async printStats() {
    const stats = await this.getStats();
    console.log('\n📊 Redis Статистика:');
    console.log('  Подключено:', stats.connected ? '✓' : '✗');
    console.log('  Ключей:', stats.keys);
    console.log('  Память:', stats.memory);
    console.log('  Uptime:', Math.floor(stats.uptime / 60), 'минут');
    console.log('  Версия:', stats.version);
    console.log('');
  }

  // ============ ЗАКРЫТИЕ СОЕДИНЕНИЯ ============

  async close() {
    await this.redis.quit();
    console.log('✓ Redis соединение закрыто');
  }
}

// Singleton экземпляр
let instance = null;

function getRedisCache(config) {
  if (!instance) {
    instance = new RedisCache(config);
  }
  return instance;
}

module.exports = { RedisCache, getRedisCache };

// Пример использования (если запущен напрямую)
if (require.main === module) {
  const cache = new RedisCache();

  async function test() {
    console.log('🧪 Тестирование Redis Cache...\n');

    // Тест кэширования пользователя
    await cache.cacheUser('user123', { name: 'Test User', email: 'test@example.com' });
    const user = await cache.getUser('user123');
    console.log('Пользователь из кэша:', user);

    // Тест онлайн пользователей
    await cache.addOnlineUser('user123', { name: 'Test User' });
    await cache.addOnlineUser('user456', { name: 'Another User' });
    const online = await cache.getOnlineUsers();
    console.log('Онлайн пользователей:', online.length);

    // Статистика
    await cache.printStats();

    // Закрытие
    await cache.close();
  }

  test().catch(console.error);
}
