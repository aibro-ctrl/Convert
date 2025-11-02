// Типы и константы для системы достижений

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type AchievementCategory = 
  | 'basics'
  | 'social'
  | 'master'
  | 'media'
  | 'secret'
  | 'challenges';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  maxProgress: number;
  isSecret?: boolean; // Скрытые ачивки, показываются только после получения
}

export interface UserAchievement {
  achievementId: string;
  progress: number;
  unlockedAt?: string;
  isUnlocked: boolean;
}

export interface UserAchievementData {
  userId: string;
  achievements: Record<string, UserAchievement>;
  lastUpdated: string;
}

// Все доступные достижения
export const ACHIEVEMENTS: Achievement[] = [
  // Категория 1: Основы общения 🗣️
  {
    id: 'first_message',
    name: 'Первое слово',
    description: 'Отправить первое сообщение',
    category: 'basics',
    rarity: 'common',
    icon: '✍️',
    maxProgress: 1,
  },
  {
    id: 'voice_master',
    name: 'Голосовуха',
    description: 'Отправить 250 голосовых сообщений',
    category: 'basics',
    rarity: 'rare',
    icon: '🎤',
    maxProgress: 250,
  },
  {
    id: 'reaction_brain',
    name: 'Реакция мозга',
    description: 'Использовать все доступные эмодзи-реакции на сообщения',
    category: 'basics',
    rarity: 'epic',
    icon: '🧠',
    maxProgress: 10, // количество разных эмодзи
  },

  // Категория 2: Социальная активность 👥
  {
    id: 'soul_of_party',
    name: 'Душа компании',
    description: 'Создать свой первый групповой чат',
    category: 'social',
    rarity: 'common',
    icon: '🎉',
    maxProgress: 1,
  },
  {
    id: 'magnet',
    name: 'Магнит',
    description: 'Пригласить 10 участников в групповой чат',
    category: 'social',
    rarity: 'rare',
    icon: '🧲',
    maxProgress: 10,
  },
  {
    id: 'popular_person',
    name: 'Популярная персона',
    description: 'Получить 20 реакций на одно свое сообщение',
    category: 'social',
    rarity: 'epic',
    icon: '⭐',
    maxProgress: 20,
  },
  {
    id: 'rescuer',
    name: 'Спасатель',
    description: 'Добавить в чат человека с призывом "Кто-нибудь, добавьте Сашу!"',
    category: 'social',
    rarity: 'rare',
    icon: '🚑',
    maxProgress: 1,
    isSecret: true,
  },
  {
    id: 'silent_listener',
    name: 'Тихий слушатель',
    description: 'Прочитать 1000 сообщений в групповых чатах, не написав ни одного',
    category: 'social',
    rarity: 'epic',
    icon: '👂',
    maxProgress: 1000,
  },
  {
    id: 'initiator',
    name: 'Заводила',
    description: 'Начать 10 разных бесед за день',
    category: 'social',
    rarity: 'rare',
    icon: '🔥',
    maxProgress: 10,
  },

  // Категория 3: Мастер общения 💬
  {
    id: 'chatterbox',
    name: 'Болтун',
    description: 'Написать 10 000 сообщений',
    category: 'master',
    rarity: 'legendary',
    icon: '💬',
    maxProgress: 10000,
  },
  {
    id: 'night_owl',
    name: 'Полуночник',
    description: 'Написать сообщение между 2:00 и 5:00 ночи',
    category: 'master',
    rarity: 'rare',
    icon: '🦉',
    maxProgress: 1,
  },
  {
    id: 'speed_shooter',
    name: 'Скорострел',
    description: 'Отправить 10 сообщений подряд в течение 15 секунд',
    category: 'master',
    rarity: 'rare',
    icon: '⚡',
    maxProgress: 1,
  },
  {
    id: 'quote_king',
    name: 'Король цитирования',
    description: 'Ответить на 300 различных сообщений',
    category: 'master',
    rarity: 'epic',
    icon: '👑',
    maxProgress: 300,
  },
  {
    id: 'history_keeper',
    name: 'Хранитель истории',
    description: 'Закрепить 20 сообщений в разных чатах',
    category: 'master',
    rarity: 'rare',
    icon: '📌',
    maxProgress: 20,
  },

  // Категория 4: Медиа и креатив 📸
  {
    id: 'photographer',
    name: 'Фотограф',
    description: 'Отправить 500 фотографий',
    category: 'media',
    rarity: 'epic',
    icon: '📸',
    maxProgress: 500,
  },
  {
    id: 'reactor',
    name: 'Реактор',
    description: 'Поставить 500 реакций в одной комнате',
    category: 'media',
    rarity: 'rare',
    icon: '💥',
    maxProgress: 500,
  },
  {
    id: 'documentalist',
    name: 'Документалист',
    description: 'Отправить 200 файлов',
    category: 'media',
    rarity: 'rare',
    icon: '📄',
    maxProgress: 200,
  },
  {
    id: 'collector',
    name: 'Коллекционер',
    description: 'Сохранить 100 сообщений в Избранное',
    category: 'media',
    rarity: 'epic',
    icon: '⭐',
    maxProgress: 100,
  },
  {
    id: 'self_director',
    name: 'Сам себе режиссер',
    description: 'Отправить 50 кружочков в одной комнате',
    category: 'media',
    rarity: 'rare',
    icon: '🎬',
    maxProgress: 50,
  },

  // Категория 5: Секретные и юмористические 🎭
  {
    id: 'oops_all',
    name: 'Ой, всё!',
    description: 'Удалить сообщение через 2 секунды после отправки',
    category: 'secret',
    rarity: 'rare',
    icon: '🤦',
    maxProgress: 1,
    isSecret: true,
  },
  {
    id: 'paradox',
    name: 'Парадокс',
    description: 'Написать "скоро буду" и появиться в сети через 3 часа',
    category: 'secret',
    rarity: 'epic',
    icon: '⏰',
    maxProgress: 1,
    isSecret: true,
  },
  {
    id: 'chips_pretzel',
    name: 'Чипс-крендель',
    description: 'Стать другом с 50 пользователями чата',
    category: 'secret',
    rarity: 'legendary',
    icon: '🥨',
    maxProgress: 50,
  },
  {
    id: 'ninja',
    name: 'Ниндзя',
    description: 'Написать и удалить сообщение так, чтобы его никто не увидел',
    category: 'secret',
    rarity: 'epic',
    icon: '🥷',
    maxProgress: 1,
    isSecret: true,
  },
  {
    id: 'nostalgia',
    name: 'Ностальгия',
    description: 'Найти в истории чата сообщение, которому больше года',
    category: 'secret',
    rarity: 'rare',
    icon: '📜',
    maxProgress: 1,
    isSecret: true,
  },
  {
    id: 'beacon',
    name: 'Маяк',
    description: 'Упомянуть (@) 5 человек в одном сообщении',
    category: 'secret',
    rarity: 'rare',
    icon: '🔦',
    maxProgress: 1,
    isSecret: true,
  },
  {
    id: 'perfect_taste',
    name: 'Безупречный вкус',
    description: 'Установить кастомную тему для чата',
    category: 'secret',
    rarity: 'rare',
    icon: '🎨',
    maxProgress: 1,
    isSecret: true,
  },

  // Категория 6: Вызовы и сезонные ивенты 🏆
  {
    id: 'striker',
    name: 'Стрикер',
    description: 'Не терять ежедневную активность 30 дней подряд',
    category: 'challenges',
    rarity: 'legendary',
    icon: '🔥',
    maxProgress: 30,
  },
  {
    id: 'new_year_miracle',
    name: 'Новогоднее чудо',
    description: 'Написать сообщение 1 января в 00:01',
    category: 'challenges',
    rarity: 'legendary',
    icon: '🎄',
    maxProgress: 1,
    isSecret: true,
  },
];

export const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: '#94a3b8',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

export const RARITY_LABELS: Record<AchievementRarity, string> = {
  common: 'Обычная',
  rare: 'Редкая',
  epic: 'Эпическая',
  legendary: 'Легендарная',
};

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  basics: 'Основы общения',
  social: 'Социальная активность',
  master: 'Мастер общения',
  media: 'Медиа и креатив',
  secret: 'Секретные',
  challenges: 'Вызовы',
};

// Получить достижение по ID
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// Получить достижения по категории
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

// Проверить, разблокировано ли достижение
export function isAchievementUnlocked(userAchievement: UserAchievement): boolean {
  return userAchievement.isUnlocked;
}

// Получить процент прогресса
export function getAchievementProgress(achievement: Achievement, userAchievement: UserAchievement): number {
  if (userAchievement.isUnlocked) return 100;
  return Math.min(100, (userAchievement.progress / achievement.maxProgress) * 100);
}
