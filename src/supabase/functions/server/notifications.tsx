import * as kv from "./kv_store.tsx";
import * as auth from "./auth.tsx";

export interface Notification {
  id: string;
  userId: string; // Получатель уведомления
  type: 'friend_request' | 'friend_accepted' | 'mention' | 'reaction' | 'room_invite';
  fromUserId?: string; // Отправитель
  fromUsername?: string;
  roomId?: string;
  roomName?: string;
  messageId?: string;
  content?: string;
  read: boolean;
  createdAt: string;
  actionData?: any; // Дополнительные данные для действий
}

// Создать уведомление
export async function createNotification(
  userId: string,
  type: Notification['type'],
  fromUserId?: string,
  data?: any
): Promise<{ data?: Notification; error?: string }> {
  try {
    const notificationId = `notification:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    let fromUsername = undefined;
    if (fromUserId) {
      const fromUser = await auth.getUserById(fromUserId);
      fromUsername = fromUser?.username;
    }

    const notification: Notification = {
      id: notificationId,
      userId,
      type,
      fromUserId,
      fromUsername,
      roomId: data?.roomId,
      roomName: data?.roomName,
      messageId: data?.messageId,
      content: data?.content,
      read: false,
      createdAt: new Date().toISOString(),
      actionData: data?.actionData,
    };

    await kv.set(notificationId, notification);
    
    // Добавить в список уведомлений пользователя
    const userNotificationsKey = `user_notifications:${userId}`;
    const userNotifications = await kv.get(userNotificationsKey) || [];
    // @ts-ignore
    userNotifications.unshift(notificationId);
    // @ts-ignore
    await kv.set(userNotificationsKey, userNotifications.slice(0, 100)); // Храним последние 100

    return { data: notification };
  } catch (error: any) {
    console.error('Create notification error:', error);
    return { error: error.message };
  }
}

// Получить уведомления пользователя
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  try {
    const userNotificationsKey = `user_notifications:${userId}`;
    const notificationIds = await kv.get(userNotificationsKey) || [];
    
    // @ts-ignore
    const notifications = await Promise.all(
      // @ts-ignore
      notificationIds.map(async (id: string) => {
        const notification = await kv.get(id);
        return notification;
      })
    );
    
    // Filter out null/undefined notifications and ensure they have required properties
    // @ts-ignore
    return notifications.filter(n => n && n.id && n.type && n.userId);
  } catch (error: any) {
    console.error('Get user notifications error:', error);
    return [];
  }
}

// Отметить уведомление как прочитанное
export async function markNotificationAsRead(notificationId: string, userId: string): Promise<{ data?: any; error?: string }> {
  try {
    const notification = await kv.get(notificationId);
    
    if (!notification) {
      return { error: 'Уведомление не найдено' };
    }

    // @ts-ignore
    if (notification.userId !== userId) {
      return { error: 'Нет доступа к этому уведомлению' };
    }

    // @ts-ignore
    notification.read = true;
    await kv.set(notificationId, notification);

    return { data: { message: 'Уведомление отмечено как прочитанное' } };
  } catch (error: any) {
    console.error('Mark notification as read error:', error);
    return { error: error.message };
  }
}

// Удалить уведомление
export async function deleteNotification(notificationId: string, userId: string): Promise<{ data?: any; error?: string }> {
  try {
    const notification = await kv.get(notificationId);
    
    if (!notification) {
      // Уведомление уже удалено — считаем это успешным сценарием,
      // чтобы не показывать пользователю ошибку при повторном удалении.
      console.log('Delete notification: notification not found, treat as success', notificationId);
      return { data: { message: 'Уведомление уже удалено' } };
    }

    // @ts-ignore
    if (notification.userId !== userId) {
      return { error: 'Нет доступа к этому уведомлению' };
    }

    await kv.del(notificationId);
    
    // Удалить из списка пользователя
    const userNotificationsKey = `user_notifications:${userId}`;
    const userNotifications = await kv.get(userNotificationsKey) || [];
    // @ts-ignore
    const updatedNotifications = userNotifications.filter((id: string) => id !== notificationId);
    await kv.set(userNotificationsKey, updatedNotifications);

    return { data: { message: 'Уведомление удалено' } };
  } catch (error: any) {
    console.error('Delete notification error:', error);
    return { error: error.message };
  }
}

// Отправить запрос в друзья
export async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<{ data?: any; error?: string }> {
  try {
    if (fromUserId === toUserId) {
      return { error: 'Нельзя добавить самого себя в друзья' };
    }

    const fromUser = await auth.getUserById(fromUserId);
    const toUser = await auth.getUserById(toUserId);

    if (!fromUser || !toUser) {
      return { error: 'Пользователь не найден' };
    }

    // Проверить, не в друзьях ли уже
    if (fromUser.friends?.includes(toUserId)) {
      return { error: 'Пользователь уже в друзьях' };
    }

    // Проверить, не отправлен ли уже АКТИВНЫЙ запрос
    const requestKey = `friend_request:${fromUserId}:${toUserId}`;
    const existingRequest = await kv.get(requestKey);
    
    if (existingRequest && (existingRequest as any).status === 'pending') {
      return { error: 'Запрос уже отправлен' };
    }
    
    // Проверяем обратный запрос (если toUser уже отправил запрос к fromUser)
    const reverseRequestKey = `friend_request:${toUserId}:${fromUserId}`;
    const reverseRequest = await kv.get(reverseRequestKey);
    
    if (reverseRequest && (reverseRequest as any).status === 'pending') {
      // Автоматически принимаем встречный запрос
      await auth.addFriend(fromUserId, toUserId);
      await kv.del(reverseRequestKey);
      
      // Создать уведомления для обоих
      await createNotification(toUserId, 'friend_accepted', fromUserId, {
        content: `${fromUser.username} принял ваш запрос в друзья`
      });
      await createNotification(fromUserId, 'friend_accepted', toUserId, {
        content: `${toUser.username} принял ваш запрос в друзья`
      });
      
      return { data: { message: 'Запрос автоматически принят (встречный запрос)' } };
    }

    // Создать запрос в друзья
    const friendRequest = {
      id: requestKey,
      fromUserId,
      toUserId,
      fromUsername: fromUser.username,
      toUsername: toUser.username,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await kv.set(requestKey, friendRequest);

    // Создать уведомление
    await createNotification(toUserId, 'friend_request', fromUserId, {
      content: `${fromUser.username} хочет добавить вас в друзья`,
      actionData: { requestKey }
    });

    return { data: { message: 'Запрос в друзья отправлен' } };
  } catch (error: any) {
    console.error('Send friend request error:', error);
    return { error: error.message };
  }
}

// Принять запрос в друзья
export async function acceptFriendRequest(requestKey: string, userId: string): Promise<{ data?: any; error?: string }> {
  try {
    console.log('Accept friend request:', { requestKey, userId });
    const friendRequest = await kv.get(requestKey);
    
    if (!friendRequest) {
      console.log('Friend request not found:', requestKey);
      
      // Если самого запроса нет, попробуем понять, не стали ли пользователи уже друзьями
      // Формат ключа: friend_request:fromUserId:toUserId
      const parts = requestKey.split(':');
      if (parts.length >= 3 && parts[0] === 'friend_request') {
        const fromUserId = parts[1];
        const toUserId = parts[2];
        try {
          const fromUser = await auth.getUserById(fromUserId);
          const toUser = await auth.getUserById(toUserId);
          
          if (fromUser && toUser && 
              Array.isArray(fromUser.friends) && 
              Array.isArray(toUser.friends) &&
              fromUser.friends.includes(toUserId) &&
              toUser.friends.includes(fromUserId)) {
            // Пользователи уже друзья – считаем, что запрос был обработан ранее
            console.log('Friend request already processed, users are friends:', { fromUserId, toUserId });
            return { data: { message: 'Запрос уже обработан' } };
          }
        } catch (err) {
          console.error('Failed to check friends for missing friend request:', err);
        }
      }
      
      // В остальных случаях возвращаем стандартную ошибку
      return { error: 'Запрос не найден' };
    }

    // @ts-ignore
    console.log('Friend request data:', friendRequest);
    
    // @ts-ignore
    if (friendRequest.toUserId !== userId) {
      console.log('Access denied: toUserId mismatch', { toUserId: friendRequest.toUserId, userId });
      return { error: 'Нет доступа к этому запросу' };
    }

    // @ts-ignore
    if (friendRequest.status !== 'pending') {
      console.log('Request already processed:', { status: friendRequest.status, requestKey });
      return { error: 'Запрос уже обработан' };
    }

    // Добавить в друзья обоих пользователей
    // @ts-ignore
    const result = await auth.addFriend(friendRequest.fromUserId, friendRequest.toUserId);
    
    if (result.error) {
      return { error: result.error };
    }

    // Удаляем запрос после принятия (не храним историю)
    await kv.del(requestKey);
    
    // Также удаляем обратный запрос, если он существует
    // @ts-ignore
    const reverseRequestKey = `friend_request:${friendRequest.toUserId}:${friendRequest.fromUserId}`;
    try {
      await kv.del(reverseRequestKey);
    } catch (err) {
      // Ignore if doesn't exist
    }

    // Удаляем все уведомления friend_request между этими пользователями
    const fromUserId = friendRequest.fromUserId;
    const toUserId = friendRequest.toUserId;
    
    // Получаем все уведомления получателя
    const toUserNotificationsKey = `user_notifications:${toUserId}`;
    const toUserNotifications = await kv.get(toUserNotificationsKey) || [];
    
    // Удаляем все уведомления friend_request от отправителя
    const notificationsToDelete: string[] = [];
    for (const notificationId of toUserNotifications) {
      const notification = await kv.get(notificationId);
      if (notification && 
          notification.type === 'friend_request' && 
          notification.fromUserId === fromUserId) {
        notificationsToDelete.push(notificationId);
        await kv.del(notificationId);
      }
    }
    
    // Обновляем список уведомлений получателя
    const updatedToNotifications = toUserNotifications.filter(
      (id: string) => !notificationsToDelete.includes(id)
    );
    await kv.set(toUserNotificationsKey, updatedToNotifications);
    
    // Также удаляем уведомления friend_request у отправителя (если есть)
    const fromUserNotificationsKey = `user_notifications:${fromUserId}`;
    const fromUserNotifications = await kv.get(fromUserNotificationsKey) || [];
    const fromNotificationsToDelete: string[] = [];
    for (const notificationId of fromUserNotifications) {
      const notification = await kv.get(notificationId);
      if (notification && 
          notification.type === 'friend_request' && 
          notification.fromUserId === toUserId) {
        fromNotificationsToDelete.push(notificationId);
        await kv.del(notificationId);
      }
    }
    
    // Обновляем список уведомлений отправителя
    const updatedFromNotifications = fromUserNotifications.filter(
      (id: string) => !fromNotificationsToDelete.includes(id)
    );
    await kv.set(fromUserNotificationsKey, updatedFromNotifications);

    // Создать уведомление для отправителя
    // @ts-ignore
    await createNotification(friendRequest.fromUserId, 'friend_accepted', userId, {
      // @ts-ignore
      content: `${friendRequest.toUsername} принял ваш запрос в друзья`
    });

    return { data: { message: 'Запрос принят' } };
  } catch (error: any) {
    console.error('Accept friend request error:', error);
    return { error: error.message };
  }
}

// Отклонить запрос в друзья
export async function rejectFriendRequest(requestKey: string, userId: string): Promise<{ data?: any; error?: string }> {
  try {
    console.log('Reject friend request:', { requestKey, userId });
    const friendRequest = await kv.get(requestKey);
    
    if (!friendRequest) {
      console.log('Friend request not found (may already be deleted):', requestKey);
      // Request not found - it may have already been deleted
      // This is ok, just return success
      return { data: { message: 'Запрос отклонен' } };
    }

    // @ts-ignore
    console.log('Friend request data:', friendRequest);
    
    // @ts-ignore
    if (friendRequest.toUserId !== userId) {
      console.log('Access denied: toUserId mismatch', { toUserId: friendRequest.toUserId, userId });
      return { error: 'Нет доступа к этому запросу' };
    }

    // Удалить запрос
    await kv.del(requestKey);
    
    // Также удаляем обратный запрос, если он существует
    // @ts-ignore
    const reverseRequestKey = `friend_request:${friendRequest.toUserId}:${friendRequest.fromUserId}`;
    try {
      await kv.del(reverseRequestKey);
    } catch (err) {
      // Ignore if doesn't exist
    }
    
    console.log('Friend request rejected and deleted:', requestKey);

    return { data: { message: 'Запрос отклонен' } };
  } catch (error: any) {
    console.error('Reject friend request error:', error);
    return { error: error.message };
  }
}

// Проверить наличие активного запроса в друзья
export async function checkFriendRequest(fromUserId: string, toUserId: string): Promise<{ pending: boolean; requestKey?: string }> {
  try {
    // Проверяем запрос от fromUserId к toUserId
    const requestKey = `friend_request:${fromUserId}:${toUserId}`;
    const request = await kv.get(requestKey);
    
    if (request && (request as any).status === 'pending') {
      return { pending: true, requestKey };
    }
    
    return { pending: false };
  } catch (error: any) {
    console.error('Check friend request error:', error);
    return { pending: false };
  }
}
