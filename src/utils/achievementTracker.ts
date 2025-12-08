// Трекер для проверки и разблокировки достижений

import { fetchAPI } from './api';
import { ACHIEVEMENTS } from './achievements';

export class AchievementTracker {
  private userId: string;
  private notificationCallback?: (achievementId: string) => void;

  constructor(userId: string, onAchievementUnlocked?: (achievementId: string) => void) {
    this.userId = userId;
    this.notificationCallback = onAchievementUnlocked;
  }

  // Обновить прогресс
  async updateProgress(achievementId: string, increment: number = 1) {
    try {
      const response = await fetchAPI(`/achievements/${this.userId}/progress`, {
        method: 'POST',
        body: JSON.stringify({ achievementId, increment }),
      });

      // Проверить, достигнут ли максимальный прогресс
      const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
      if (achievement && response.achievement.progress >= achievement.maxProgress) {
        await this.unlock(achievementId);
      }

      return response;
    } catch (error) {
      console.error('Error updating achievement progress:', error);
    }
  }

  // Разблокировать достижение
  async unlock(achievementId: string) {
    try {
      const response = await fetchAPI(`/achievements/${this.userId}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ achievementId }),
      });

      if (response.newUnlock && this.notificationCallback) {
        this.notificationCallback(achievementId);
      }

      return response;
    } catch (error) {
      console.error('Error unlocking achievement:', error);
    }
  }

  // Проверки для конкретных достижений

  // Первое сообщение
  async checkFirstMessage() {
    await this.unlock('first_message');
  }

  // Голосовое сообщение
  async checkVoiceMessage() {
    await this.updateProgress('voice_master');
  }

  // Использование реакции
  async checkReactionUsed(emoji: string) {
    // Отслеживаем уникальные эмодзи
    const key = `reactions_used:${this.userId}`;
    try {
      const data = await fetchAPI(`/achievements/${this.userId}/stats`);
      // Логика для отслеживания уникальных эмодзи реализуется на сервере
    } catch (error) {
      console.error('Error checking reaction achievement:', error);
    }
  }

  // Создание группового чата
  async checkGroupChatCreated() {
    await this.unlock('soul_of_party');
  }

  // Добавление участников
  async checkMemberInvited() {
    await this.updateProgress('magnet');
  }

  // Получение реакций на сообщение
  async checkMessageReactions(count: number) {
    if (count >= 20) {
      await this.unlock('popular_person');
    }
  }

  // Чтение сообщений (тихий слушатель)
  async checkMessageRead() {
    await this.updateProgress('silent_listener');
  }

  // Начало беседы
  async checkConversationStarted() {
    await this.updateProgress('initiator');
  }

  // Общее количество сообщений
  async checkTotalMessages() {
    await this.updateProgress('chatterbox');
  }

  // Ночное сообщение
  async checkNightMessage() {
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 5) {
      await this.unlock('night_owl');
    }
  }

  // Скорострел (10 сообщений за 15 секунд)
  private messageTimestamps: number[] = [];
  
  async checkSpeedShooter() {
    const now = Date.now();
    this.messageTimestamps.push(now);
    
    // Оставить только сообщения за последние 15 секунд
    this.messageTimestamps = this.messageTimestamps.filter(
      ts => now - ts < 15000
    );
    
    if (this.messageTimestamps.length >= 10) {
      await this.unlock('speed_shooter');
      this.messageTimestamps = []; // Сброс после разблокировки
    }
  }

  // Ответ на сообщение
  async checkReply() {
    await this.updateProgress('quote_king');
  }

  // Закрепление сообщения
  async checkMessagePinned() {
    await this.updateProgress('history_keeper');
  }

  // Отправка фото
  async checkPhotoSent() {
    await this.updateProgress('photographer');
  }

  // Реакция поставлена
  async checkReactionGiven() {
    await this.updateProgress('reactor');
  }

  // Отправка файла
  async checkFileSent() {
    await this.updateProgress('documentalist');
  }

  // Видео сообщение (кружочек)
  async checkVideoCircleSent() {
    await this.updateProgress('self_director');
  }

  // Быстрое удаление (ой всё!)
  async checkQuickDelete(messageCreatedAt: string) {
    const createdTime = new Date(messageCreatedAt).getTime();
    const now = Date.now();
    
    if (now - createdTime < 2000) {
      await this.unlock('oops_all');
    }
  }

  // Парадокс (написал "скоро буду")
  async checkParadoxMessage(text: string, sentTime: string) {
    if (text.toLowerCase().includes('скоро буду') || text.toLowerCase().includes('скоро приду')) {
      // Запомнить время отправки
      localStorage.setItem(`paradox_message:${this.userId}`, sentTime);
    }
  }

  // Проверка парадокса при возвращении онлайн
  async checkParadoxReturn() {
    const messageTime = localStorage.getItem(`paradox_message:${this.userId}`);
    if (messageTime) {
      const sent = new Date(messageTime).getTime();
      const now = Date.now();
      const hoursElapsed = (now - sent) / (1000 * 60 * 60);
      
      if (hoursElapsed >= 3) {
        await this.unlock('paradox');
        localStorage.removeItem(`paradox_message:${this.userId}`);
      }
    }
  }

  // Друзья
  async checkFriendsCount(count: number) {
    if (count >= 50) {
      await this.unlock('chips_pretzel');
    }
  }

  // Упоминание нескольких людей
  async checkMentions(text: string) {
    const mentions = text.match(/@\w+/g) || [];
    if (mentions.length >= 5) {
      await this.unlock('beacon');
    }
  }

  // Кастомная тема
  async checkCustomTheme() {
    await this.unlock('perfect_taste');
  }

  // Ежедневная активность
  async checkDailyActivity() {
    try {
      const streakData = await fetchAPI(`/achievements/${this.userId}/activity`, {
        method: 'POST',
      });
      
      if (streakData.currentStreak >= 30) {
        await this.unlock('striker');
      }
    } catch (error) {
      console.error('Error checking daily activity:', error);
    }
  }

  // Новогоднее чудо
  async checkNewYearMessage() {
    const now = new Date();
    const isNewYear = now.getMonth() === 0 && now.getDate() === 1;
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    if (isNewYear && hour === 0 && minute <= 1) {
      await this.unlock('new_year_miracle');
    }
  }

  // Поиск старого сообщения (ностальгия)
  async checkOldMessageFound(messageDate: string) {
    const messageTime = new Date(messageDate).getTime();
    const now = Date.now();
    const yearsElapsed = (now - messageTime) / (1000 * 60 * 60 * 24 * 365);
    
    if (yearsElapsed >= 1) {
      await this.unlock('nostalgia');
    }
  }
}
