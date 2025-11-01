import React, { useState, useEffect } from 'react';
import { notificationsAPI, usersAPI, Notification } from '../../utils/api';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from '../ui/sonner';
import { Bell, X, CheckCircle, UserPlus, AtSign, Heart, Users } from '../ui/icons';

interface NotificationsPanelProps {
  onClose: () => void;
  onFriendRequestHandled?: () => void; // Callback при обработке запроса в друзья
}

export function NotificationsPanel({ onClose, onFriendRequestHandled }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    
    // Real-time обновление каждые 3 секунды
    const interval = setInterval(loadNotifications, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    // Проверяем наличие токена перед запросом
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.log('loadNotifications: No token available, skipping');
      setLoading(false);
      return;
    }
    
    try {
      const data = await notificationsAPI.getAll();
      // Filter out null/undefined notifications and ensure they have required properties
      const validNotifications = (data.notifications || []).filter(n => n && n.id && n.type);
      setNotifications(validNotifications);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      // Показываем ошибку только если это не просто отсутствие авторизации
      if (error.message && !error.message.includes('401')) {
        toast.error('Не удалось загрузить уведомления');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptFriendRequest = async (requestKey: string, notificationId: string) => {
    try {
      // Оптимизация: запускаем операции параллельно
      const [acceptResult] = await Promise.all([
        usersAPI.acceptFriendRequest(requestKey),
        notificationsAPI.delete(notificationId)
      ]);
      
      toast.success('Запрос принят');
      
      // Оптимизация: не ждем загрузки, просто удаляем из локального списка
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Вызываем callback для обновления списка друзей
      if (onFriendRequestHandled) {
        onFriendRequestHandled();
      }
    } catch (error: any) {
      console.error('Accept friend request error:', error);
      const errorMsg = error.message || 'Ошибка';
      
      // If request is already processed, just delete the notification
      if (errorMsg.includes('уже обработан') || errorMsg.includes('already processed')) {
        toast.info('Запрос уже был обработан ранее');
        await notificationsAPI.delete(notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        // Обновляем список друзей даже если запрос уже был обработан
        if (onFriendRequestHandled) {
          onFriendRequestHandled();
        }
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleRejectFriendRequest = async (requestKey: string, notificationId: string) => {
    try {
      // Оптимизация: запускаем операции параллельно
      await Promise.all([
        usersAPI.rejectFriendRequest(requestKey),
        notificationsAPI.delete(notificationId)
      ]);
      
      toast.success('Запрос отклонен');
      
      // Оптимизация: не ждем загрузки, просто удаляем из локального списка
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Вызываем callback для обновления данных
      if (onFriendRequestHandled) {
        onFriendRequestHandled();
      }
    } catch (error: any) {
      console.error('Reject friend request error:', error);
      const errorMsg = error.message || 'Ошибка';
      
      // If request is already processed, just delete the notification
      if (errorMsg.includes('уже обработан') || errorMsg.includes('already processed')) {
        toast.info('Запрос уже был обработан ранее');
        await notificationsAPI.delete(notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (onFriendRequestHandled) {
          onFriendRequestHandled();
        }
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      // Оптимизация: сначала удаляем из UI, потом из базы
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      await notificationsAPI.delete(notificationId);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка');
      // В случае о��ибки перезагружаем список
      loadNotifications();
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'friend_request':
        return <UserPlus className="w-5 h-5 text-blue-500" />;
      case 'friend_accepted':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'mention':
        return <AtSign className="w-5 h-5 text-purple-500" />;
      case 'reaction':
        return <Heart className="w-5 h-5 text-pink-500" />;
      case 'room_invite':
        return <Users className="w-5 h-5 text-indigo-500" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) return `${diffDays} д назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const unreadCount = notifications.filter(n => n && !n.read).length;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <h2 className="text-xl">Уведомления</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}</Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Нет уведомлений
          </div>
        ) : (
          notifications.map((notification) => {
            // Extra safety check
            if (!notification || !notification.id) return null;
            
            return (
              <Card
                key={notification.id}
                className={`${notification.read === false ? 'border-primary' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <p className="text-sm">{notification.content || 'Уведомление'}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.createdAt ? formatTime(notification.createdAt) : ''}
                      </p>

                      {notification.type === 'friend_request' && notification.actionData?.requestKey && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptFriendRequest(notification.actionData.requestKey, notification.id)}
                          >
                            Принять
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectFriendRequest(notification.actionData.requestKey, notification.id)}
                          >
                            Отклонить
                          </Button>
                        </div>
                      )}

                      {notification.type !== 'friend_request' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismiss(notification.id)}
                        >
                          Закрыть
                        </Button>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDismiss(notification.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
