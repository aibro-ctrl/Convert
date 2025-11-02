import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { User as UserIcon, X, MessageCircle, UserPlus } from '../ui/icons';
import { User, Room, DirectMessage } from '../../utils/api';

interface ToastNotification {
  id: string;
  type: 'message' | 'dm' | 'friend_request';
  from: User;
  content?: string;
  room?: Room;
  dm?: DirectMessage;
  timestamp: number;
}

interface NotificationToastProps {
  onOpenChat?: (room: Room) => void;
  onOpenDM?: (dm: DirectMessage) => void;
  onOpenFriendRequests?: () => void;
  currentUserId: string;
}

export function NotificationToast({ onOpenChat, onOpenDM, onOpenFriendRequests, currentUserId }: NotificationToastProps) {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const addNotification = (notification: Omit<ToastNotification, 'id' | 'timestamp'>) => {
    const newNotification: ToastNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    setNotifications(prev => [...prev, newNotification]);
    
    // Автоматически убрать через 5 секунд
    setTimeout(() => {
      removeNotification(newNotification.id);
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Экспортируем функцию добавления уведомлений
  useEffect(() => {
    // @ts-ignore - добавляем в window для доступа из других компонентов
    window.showNotificationToast = addNotification;
    
    return () => {
      // @ts-ignore
      delete window.showNotificationToast;
    };
  }, []);

  const handleClick = (notification: ToastNotification) => {
    if (notification.type === 'message' && notification.room && onOpenChat) {
      onOpenChat(notification.room);
    } else if (notification.type === 'dm' && notification.dm && onOpenDM) {
      onOpenDM(notification.dm);
    } else if (notification.type === 'friend_request' && onOpenFriendRequests) {
      onOpenFriendRequests();
    }
    removeNotification(notification.id);
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'dm':
      case 'message':
        return '#3b82f6'; // blue
      case 'friend_request':
        return '#10b981'; // green
      default:
        return '#6366f1'; // indigo
    }
  };

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes slideOutRight {
          from {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateX(100%) scale(0.95);
          }
        }
        @keyframes pulse-ring {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.1;
          }
        }
        .toast-enter {
          animation: slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .toast-exit {
          animation: slideOutRight 0.3s ease-in;
        }
      `}</style>
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md">
        {notifications.map((notification) => {
          const color = getNotificationColor(notification.type);
          return (
            <div
              key={notification.id}
              className="toast-enter"
            >
              <div
                className="relative overflow-hidden rounded-xl shadow-2xl backdrop-blur-md"
                style={{
                  background: `linear-gradient(135deg, ${color}15, ${color}25)`,
                  border: `2px solid ${color}`,
                }}
              >
                {/* Анимированный фон */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `radial-gradient(circle at 30% 50%, ${color}, transparent)`,
                    animation: 'pulse-ring 2s ease-in-out infinite',
                  }}
                />

                {/* Контент */}
                <div className="relative p-4">
                  <div className="flex items-start gap-3">
                    {/* Аватар с кольцом */}
                    <div className="relative flex-shrink-0">
                      <div
                        className="absolute inset-0 rounded-full blur-sm"
                        style={{
                          background: color,
                          animation: 'pulse-ring 2s ease-in-out infinite',
                        }}
                      />
                      <div className="relative w-12 h-12 rounded-full bg-background/80 flex items-center justify-center overflow-hidden border-2"
                        style={{ borderColor: color }}
                      >
                        {(notification.from as any).avatar ? (
                          <img 
                            src={(notification.from as any).avatar} 
                            alt={notification.from.username} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <UserIcon className="w-6 h-6" style={{ color }} />
                        )}
                      </div>
                    </div>
                    
                    {/* Текст */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-sm opacity-60 mb-0.5">
                            {notification.type === 'dm' || notification.type === 'message' 
                              ? '💬 Новое сообщение' 
                              : '👥 Заявка в друзья'}
                          </p>
                          <p className="font-semibold">
                            {(notification.from as any).display_name || notification.from.username}
                          </p>
                        </div>
                        <button
                          onClick={() => removeNotification(notification.id)}
                          className="flex-shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors"
                          aria-label="Закрыть"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {(notification.type === 'dm' || notification.type === 'message') && notification.content ? (
                        <p className="text-sm opacity-80 mb-3 line-clamp-2">
                          {notification.content}
                        </p>
                      ) : notification.type === 'friend_request' ? (
                        <p className="text-sm opacity-80 mb-3">
                          Хочет добавить вас в друзья
                        </p>
                      ) : null}
                      
                      <button
                        onClick={() => handleClick(notification)}
                        className="w-full px-4 py-2 rounded-lg text-sm transition-all hover:scale-105 active:scale-95"
                        style={{
                          backgroundColor: color,
                          color: 'white',
                          fontWeight: 500,
                        }}
                      >
                        {notification.type === 'friend_request' ? 'Открыть запросы' : 'Посмотреть'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Прогресс бар автозакрытия */}
                <div 
                  className="absolute bottom-0 left-0 h-1 rounded-b"
                  style={{
                    backgroundColor: color,
                    animation: 'progress 5s linear',
                    transformOrigin: 'left',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
}

// Типизация для window
declare global {
  interface Window {
    showNotificationToast?: (notification: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  }
}
