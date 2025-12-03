import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

app.use('*', cors());

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Получить достижения пользователя
app.get('/make-server-b0f1e6d5/achievements/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    
    const key = `achievements:${userId}`;
    const data = await kv.get(key);
    
    if (!data) {
      // Инициализировать пустой профиль достижений
      const emptyProfile = {
        userId,
        achievements: {},
        lastUpdated: new Date().toISOString(),
      };
      await kv.set(key, emptyProfile);
      return c.json(emptyProfile);
    }
    
    return c.json(data);
  } catch (error) {
    console.error('Error getting achievements:', error);
    return c.json({ error: 'Failed to get achievements' }, 500);
  }
});

// Обновить прогресс достижения
app.post('/make-server-b0f1e6d5/achievements/:userId/progress', async (c) => {
  try {
    const userId = c.req.param('userId');
    const { achievementId, increment = 1 } = await c.req.json();
    
    const key = `achievements:${userId}`;
    let data = await kv.get(key);
    
    if (!data) {
      data = {
        userId,
        achievements: {},
        lastUpdated: new Date().toISOString(),
      };
    }
    
    // Инициализировать достижение если его нет
    if (!data.achievements[achievementId]) {
      data.achievements[achievementId] = {
        achievementId,
        progress: 0,
        isUnlocked: false,
      };
    }
    
    // Обновить прогресс (если еще не разблокировано)
    if (!data.achievements[achievementId].isUnlocked) {
      data.achievements[achievementId].progress += increment;
    }
    
    data.lastUpdated = new Date().toISOString();
    await kv.set(key, data);
    
    return c.json({
      success: true,
      achievement: data.achievements[achievementId],
    });
  } catch (error) {
    console.error('Error updating achievement progress:', error);
    return c.json({ error: 'Failed to update achievement progress' }, 500);
  }
});

// Разблокировать достижение
app.post('/make-server-b0f1e6d5/achievements/:userId/unlock', async (c) => {
  try {
    const userId = c.req.param('userId');
    const { achievementId } = await c.req.json();
    
    const key = `achievements:${userId}`;
    let data = await kv.get(key);
    
    if (!data) {
      data = {
        userId,
        achievements: {},
        lastUpdated: new Date().toISOString(),
      };
    }
    
    // Инициализировать достижение если его нет
    if (!data.achievements[achievementId]) {
      data.achievements[achievementId] = {
        achievementId,
        progress: 0,
        isUnlocked: false,
      };
    }
    
    // Разблокировать
    if (!data.achievements[achievementId].isUnlocked) {
      data.achievements[achievementId].isUnlocked = true;
      data.achievements[achievementId].unlockedAt = new Date().toISOString();
      
      data.lastUpdated = new Date().toISOString();
      await kv.set(key, data);
      
      return c.json({
        success: true,
        newUnlock: true,
        achievement: data.achievements[achievementId],
      });
    }
    
    return c.json({
      success: true,
      newUnlock: false,
      achievement: data.achievements[achievementId],
    });
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    return c.json({ error: 'Failed to unlock achievement' }, 500);
  }
});

// Получить статистику пользователя для проверки достижений
app.get('/make-server-b0f1e6d5/achievements/:userId/stats', async (c) => {
  try {
    const userId = c.req.param('userId');
    
    // Получить все сообщения пользователя для статистики
    const messagesPrefix = 'message:';
    const allMessages = await kv.getByPrefix(messagesPrefix);
    
    const userMessages = allMessages.filter((msg: any) => msg.senderId === userId);
    
    // Подсчитать статистику
    const stats = {
      totalMessages: userMessages.length,
      voiceMessages: userMessages.filter((msg: any) => msg.voiceUrl).length,
      videoMessages: userMessages.filter((msg: any) => msg.videoUrl).length,
      images: userMessages.filter((msg: any) => msg.imageUrl).length,
      files: userMessages.filter((msg: any) => msg.fileUrl).length,
      replies: userMessages.filter((msg: any) => msg.replyTo).length,
    };
    
    return c.json(stats);
  } catch (error) {
    console.error('Error getting user stats:', error);
    return c.json({ error: 'Failed to get user stats' }, 500);
  }
});

// Обновить счетчик активности (для streak)
app.post('/make-server-b0f1e6d5/achievements/:userId/activity', async (c) => {
  try {
    const userId = c.req.param('userId');
    
    const key = `activity_streak:${userId}`;
    let streakData = await kv.get(key);
    
    const today = new Date().toISOString().split('T')[0];
    
    if (!streakData) {
      streakData = {
        currentStreak: 1,
        lastActivityDate: today,
        longestStreak: 1,
      };
    } else {
      const lastDate = new Date(streakData.lastActivityDate);
      const currentDate = new Date(today);
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Продолжаем streak
        streakData.currentStreak += 1;
        streakData.longestStreak = Math.max(
          streakData.longestStreak,
          streakData.currentStreak
        );
      } else if (diffDays > 1) {
        // Streak прерван
        streakData.currentStreak = 1;
      }
      // если diffDays === 0, то это тот же день, не меняем streak
      
      streakData.lastActivityDate = today;
    }
    
    await kv.set(key, streakData);
    
    return c.json(streakData);
  } catch (error) {
    console.error('Error updating activity streak:', error);
    return c.json({ error: 'Failed to update activity streak' }, 500);
  }
});

export default app;
