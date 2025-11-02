import { useEffect, useState } from 'react';
import { Achievement, RARITY_COLORS } from '../../utils/achievements';

interface AchievementNotificationProps {
  achievement: Achievement;
  onClose: () => void;
}

export function AchievementNotification({ achievement, onClose }: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Показать с анимацией
    const showTimer = setTimeout(() => setIsVisible(true), 10);
    
    // Автоматически закрыть через 5 секунд
    const closeTimer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 300);
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(closeTimer);
    };
  }, [onClose]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm transition-all duration-300 ${
        isVisible && !isLeaving
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-4 scale-90'
      }`}
    >
      <div
        className="relative overflow-hidden rounded-lg shadow-2xl backdrop-blur-sm"
        style={{
          background: `linear-gradient(135deg, ${RARITY_COLORS[achievement.rarity]}15, ${RARITY_COLORS[achievement.rarity]}30)`,
          border: `2px solid ${RARITY_COLORS[achievement.rarity]}`,
        }}
      >
        {/* Анимированный градиент */}
        <div
          className="absolute inset-0 opacity-30 animate-pulse"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${RARITY_COLORS[achievement.rarity]}, transparent)`,
          }}
        />

        {/* Контент */}
        <div className="relative p-4">
          <div className="flex items-start gap-3">
            {/* Иконка ачивки */}
            <div className="flex-shrink-0 text-4xl animate-bounce">
              {achievement.icon}
            </div>

            {/* Текст */}
            <div className="flex-1 min-w-0">
              <div className="text-sm opacity-70 mb-1">Достижение разблокировано!</div>
              <div className="text-lg mb-1">{achievement.name}</div>
              <div className="text-sm opacity-80">{achievement.description}</div>
              <div
                className="text-xs mt-2 inline-block px-2 py-1 rounded"
                style={{
                  backgroundColor: `${RARITY_COLORS[achievement.rarity]}20`,
                  color: RARITY_COLORS[achievement.rarity],
                }}
              >
                {achievement.rarity === 'common' && 'Обычная'}
                {achievement.rarity === 'rare' && 'Редкая'}
                {achievement.rarity === 'epic' && 'Эпическая'}
                {achievement.rarity === 'legendary' && 'Легендарная'}
              </div>
            </div>

            {/* Кнопка закрытия */}
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
              aria-label="Закрыть"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Искры */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full animate-ping"
            style={{
              backgroundColor: RARITY_COLORS[achievement.rarity],
              left: `${50 + Math.cos((i / 8) * Math.PI * 2) * 30}%`,
              top: `${50 + Math.sin((i / 8) * Math.PI * 2) * 30}%`,
              animationDelay: `${i * 50}ms`,
              animationDuration: '1s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
