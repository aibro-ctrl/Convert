import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { User as UserIcon, X, MessageCircle, UserPlus } from '../ui/icons';
import { User, Room } from '../../utils/api';

interface ToastNotification {
  id: string;
  type: 'message' | 'friend_request';
  from: User;
  content?: string;
  room?: Room;
  timestamp: number;
}

interface NotificationToastProps {
  onOpenChat?: (room: Room) => void;
  onOpenFriendRequests?: () => void;
  currentUserId: string;
}

export function NotificationToast({ onOpenChat, onOpenFriendRequests, currentUserId }: NotificationToastProps) {
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
    } else if (notification.type === 'friend_request' && onOpenFriendRequests) {
      onOpenFriendRequests();
    }
    removeNotification(notification.id);
  };

  return (
    <>
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slideOutDown {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
        }
        .toast-enter {
          animation: slideInUp 0.3s ease-out;
        }
        .toast-exit {
          animation: slideOutDown 0.2s ease-in;
        }
      `}</style>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="toast-enter"
          >
            <Card className="shadow-lg border-2 bg-background">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {(notification.from as any).avatar ? (
                      <img 
                        src={(notification.from as any).avatar} 
                        alt={notification.from.username} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <UserIcon className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm">
                        {(notification.from as any).display_name || notification.from.username}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -mr-2 -mt-1"
                        onClick={() => removeNotification(notification.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {notification.type === 'message' ? (
                      <>
                        <p className="text-sm text-muted-foreground mb-2 truncate">
                          <MessageCircle className="w-3 h-3 inline mr-1" />
                          {notification.content}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleClick(notification)}
                          className="w-full"
                        >
                          Открыть чат
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-2">
                          <UserPlus className="w-3 h-3 inline mr-1" />
                          Хочет добавить вас в друзья
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleClick(notification)}
                          className="w-full"
                        >
                          Открыть запросы
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}

// Типизация для window
declare global {
  interface Window {
    showNotificationToast?: (notification: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  }
}
