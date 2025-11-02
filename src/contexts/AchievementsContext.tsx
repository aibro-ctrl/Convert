import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AchievementTracker } from '../utils/achievementTracker';
import { AchievementNotification } from '../components/Profile/AchievementNotification';
import { getAchievementById } from '../utils/achievements';

interface AchievementsContextType {
  tracker: AchievementTracker | null;
}

const AchievementsContext = createContext<AchievementsContextType>({
  tracker: null,
});

export const useAchievements = () => useContext(AchievementsContext);

export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tracker, setTracker] = useState<AchievementTracker | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      const newTracker = new AchievementTracker(user.id, (achievementId) => {
        // Добавить уведомление
        setNotifications(prev => [...prev, achievementId]);
      });
      setTracker(newTracker);
    } else {
      setTracker(null);
    }
  }, [user?.id]);

  const handleCloseNotification = (achievementId: string) => {
    setNotifications(prev => prev.filter(id => id !== achievementId));
  };

  return (
    <AchievementsContext.Provider value={{ tracker }}>
      {children}
      
      {/* Уведомления о разблокированных достижениях */}
      {notifications.map((achievementId, index) => {
        const achievement = getAchievementById(achievementId);
        if (!achievement) return null;
        
        return (
          <div
            key={achievementId}
            style={{
              position: 'fixed',
              top: `${16 + index * 140}px`,
              right: '16px',
              zIndex: 9999,
            }}
          >
            <AchievementNotification
              achievement={achievement}
              onClose={() => handleCloseNotification(achievementId)}
            />
          </div>
        );
      })}
    </AchievementsContext.Provider>
  );
}
