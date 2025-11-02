import { useEffect, useState } from 'react';
import { 
  ACHIEVEMENTS, 
  Achievement, 
  UserAchievement, 
  UserAchievementData,
  CATEGORY_LABELS,
  RARITY_COLORS,
  RARITY_LABELS,
  getAchievementProgress,
  AchievementCategory,
} from '../../utils/achievements';
import { fetchAPI } from '../../utils/api';

// SVG Icons
const Lock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const TrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const Award = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

interface AchievementsPanelProps {
  userId: string;
}

export function AchievementsPanel({ userId }: AchievementsPanelProps) {
  const [achievementData, setAchievementData] = useState<UserAchievementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');

  useEffect(() => {
    loadAchievements();
  }, [userId]);

  const loadAchievements = async () => {
    try {
      const data = await fetchAPI(`/achievements/${userId}`);
      setAchievementData(data);
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserAchievement = (achievementId: string): UserAchievement => {
    return achievementData?.achievements[achievementId] || {
      achievementId,
      progress: 0,
      isUnlocked: false,
    };
  };

  const filteredAchievements = ACHIEVEMENTS.filter(achievement => {
    if (selectedCategory === 'all') return true;
    return achievement.category === selectedCategory;
  });

  const stats = {
    total: ACHIEVEMENTS.length,
    unlocked: Object.values(achievementData?.achievements || {}).filter(a => a.isUnlocked).length,
    inProgress: Object.values(achievementData?.achievements || {}).filter(
      a => !a.isUnlocked && a.progress > 0
    ).length,
  };

  const categories: Array<AchievementCategory | 'all'> = [
    'all',
    'basics',
    'social',
    'master',
    'media',
    'secret',
    'challenges',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-4 border border-blue-500/20">
          <div className="text-3xl mb-1">{stats.unlocked}</div>
          <div className="text-sm opacity-70">Разблокировано</div>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 rounded-lg p-4 border border-yellow-500/20">
          <div className="text-3xl mb-1">{stats.inProgress}</div>
          <div className="text-sm opacity-70">В процессе</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg p-4 border border-purple-500/20">
          <div className="text-3xl mb-1">{stats.total}</div>
          <div className="text-sm opacity-70">Всего</div>
        </div>
      </div>

      {/* Фильтр по категориям */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedCategory === category
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {category === 'all' ? 'Все' : CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      {/* Список достижений */}
      <div className="grid gap-4">
        {filteredAchievements.map(achievement => {
          const userAchievement = getUserAchievement(achievement.id);
          const progress = getAchievementProgress(achievement, userAchievement);
          const isLocked = !userAchievement.isUnlocked && achievement.isSecret;

          return (
            <div
              key={achievement.id}
              className="relative rounded-lg border overflow-hidden transition-all hover:scale-[1.02]"
              style={{
                borderColor: userAchievement.isUnlocked
                  ? RARITY_COLORS[achievement.rarity]
                  : 'rgba(255,255,255,0.1)',
                backgroundColor: userAchievement.isUnlocked
                  ? `${RARITY_COLORS[achievement.rarity]}10`
                  : 'rgba(255,255,255,0.02)',
              }}
            >
              {/* Прогресс бар */}
              {!userAchievement.isUnlocked && !isLocked && (
                <div
                  className="absolute bottom-0 left-0 h-1 transition-all"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: RARITY_COLORS[achievement.rarity],
                  }}
                />
              )}

              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Иконка */}
                  <div
                    className={`flex-shrink-0 text-4xl transition-all ${
                      userAchievement.isUnlocked ? '' : 'grayscale opacity-50'
                    }`}
                  >
                    {isLocked ? <Lock className="w-10 h-10" /> : achievement.icon}
                  </div>

                  {/* Информация */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-lg">
                        {isLocked ? '???' : achievement.name}
                      </div>
                      {userAchievement.isUnlocked && <Award className="w-5 h-5 text-yellow-500" />}
                    </div>
                    
                    <div className="text-sm opacity-70 mb-2">
                      {isLocked ? 'Секретное достижение' : achievement.description}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Редкость */}
                      <div
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          backgroundColor: `${RARITY_COLORS[achievement.rarity]}20`,
                          color: RARITY_COLORS[achievement.rarity],
                        }}
                      >
                        {RARITY_LABELS[achievement.rarity]}
                      </div>

                      {/* Категория */}
                      <div className="text-xs px-2 py-1 rounded bg-white/5">
                        {CATEGORY_LABELS[achievement.category]}
                      </div>

                      {/* Прогресс */}
                      {!userAchievement.isUnlocked && !isLocked && (
                        <div className="flex items-center gap-2 text-sm">
                          <TrendingUp className="w-4 h-4" />
                          <span>
                            {userAchievement.progress} / {achievement.maxProgress}
                          </span>
                        </div>
                      )}

                      {/* Дата разблокировки */}
                      {userAchievement.isUnlocked && userAchievement.unlockedAt && (
                        <div className="text-xs opacity-60">
                          Разблокировано:{' '}
                          {new Date(userAchievement.unlockedAt).toLocaleDateString('ru-RU')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredAchievements.length === 0 && (
          <div className="text-center py-12 opacity-50">
            В этой категории пока нет достижений
          </div>
        )}
      </div>
    </div>
  );
}
