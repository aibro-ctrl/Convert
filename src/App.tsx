import { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ConnectionProvider, useConnection } from './contexts/ConnectionContext';
import { AchievementsProvider } from './contexts/AchievementsContext';
import { CryptoProvider } from './contexts/CryptoContext';
import { Login } from './components/Auth/Login';
import { Register } from './components/Auth/Register';
import { ResetPassword } from './components/Auth/ResetPassword';
import { RoomList } from './components/Chat/RoomList';
import { ChatRoom } from './components/Chat/ChatRoom';
import { DirectMessagesList } from './components/Chat/DirectMessagesList';
import { DirectMessageChat } from './components/Chat/DirectMessageChat';
import { UserProfile } from './components/Profile/UserProfile';
import { NotificationToast } from './components/Profile/NotificationToast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Toaster, ToastProvider, useToastListener } from './components/ui/sonner';
import { Badge } from './components/ui/badge';
import { Room } from './utils/api';
import type { DirectMessage } from './utils/apiTypes';
import { roomsAPI, dmAPI, notificationsAPI, usersAPI } from './utils/simpleApi';
import { MessageCircle, Users, User, WifiOff, Wifi, Mail } from './components/ui/icons';
import { validateAndCleanToken } from './utils/tokenUtils';

// Validate token on app startup - this runs before React renders
validateAndCleanToken();

function AuthScreen() {
  const [showLogin, setShowLogin] = useState(true);
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    // Check if URL has reset password hash
    const hash = window.location.hash;
    if (hash && hash.includes('reset-password')) {
      setShowResetPassword(true);
    }
  }, []);

  const handleResetSuccess = () => {
    setShowResetPassword(false);
    setShowLogin(true);
    // Clear hash
    window.location.hash = '';
  };

  const handleResetCancel = () => {
    setShowResetPassword(false);
    setShowLogin(true);
    // Clear hash
    window.location.hash = '';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl mb-2">💬 Конверт</h1>
        </div>

        {showResetPassword ? (
          <ResetPassword 
            onSuccess={handleResetSuccess}
            onCancel={handleResetCancel}
          />
        ) : showLogin ? (
          <Login onSwitchToRegister={() => setShowLogin(false)} />
        ) : (
          <Register onSwitchToLogin={() => setShowLogin(true)} />
        )}
      </div>
    </div>
  );
}

function MainApp() {
  const { user, loading } = useAuth();
  const { isOnline } = useConnection();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedDM, setSelectedDM] = useState<DirectMessage | null>(null);
  const [activeTab, setActiveTab] = useState('rooms');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [unreadRooms, setUnreadRooms] = useState(0);
  const [unreadDMs, setUnreadDMs] = useState(0);
  const [unreadFriends, setUnreadFriends] = useState(0);
  
  // Setup toast listener
  useToastListener();

  const handleOpenFriends = () => {
    setSelectedRoom(null);
    setSelectedDM(null);
    setViewingUserId(null);
    setActiveTab('profile');
  };

  // Обновление счетчиков непрочитанных и уведомления
  useEffect(() => {
    if (!user) return;

    let previousRooms: Room[] = [];
    let previousDMs: DirectMessage[] = [];

    const updateUnreadCounts = async () => {
      try {
        // Подсчет непрочитанных в комнатах
        const { rooms } = await roomsAPI.getAll();
        let roomCount = 0;
        
        rooms.forEach((room: Room) => {
          // Пропускаем DM комнаты (они теперь в отдельной системе)
          if (room.type === 'dm') return;
          
          const count = room.unread_count?.[user.id] || 0;
          const mentions = room.unread_mentions?.[user.id] || 0;
          const reactions = room.unread_reactions?.[user.id] || 0;
          const total = count + mentions + reactions;
          
          if (total > 0) {
            roomCount += total;
          }
        });

        // Подсчет непрочитанных в личных сообщениях
        const { dms } = await dmAPI.getAll();
        let dmCount = 0;
        
        // Проверяем новые DM и показываем уведомления
        dms.forEach((dm: DirectMessage) => {
          const count = dm.unread_count?.[user.id] || 0;
          if (count > 0) {
            dmCount += count;
            
            // Показываем уведомление о новом личном сообщении
            const previousDM = previousDMs.find((prevDm: DirectMessage) => prevDm.id === dm.id);
            const previousCount = previousDM?.unread_count?.[user.id] || 0;
            
            // Есть новое непрочитанное сообщение
            if (count > previousCount && isOnline && window.showNotificationToast && dm.last_message) {
              const notifKey = `shown_dm_${dm.id}_${dm.last_message.id}`;
              if (!sessionStorage.getItem(notifKey)) {
                sessionStorage.setItem(notifKey, 'true');
                
                // Получаем информацию об отправителе
                const otherUserId = dm.participants.find(id => id !== user.id);
                if (otherUserId && dm.last_message.sender_id === otherUserId) {
                  usersAPI.getById(otherUserId).then(({ user: sender }) => {
                    window.showNotificationToast?.({
                      type: 'dm',
                      from: sender,
                      content: dm.last_message!.content,
                      dm: dm,
                    });
                  }).catch(console.error);
                }
              }
            }
          }
        });

        previousRooms = rooms;
        previousDMs = dms;

        // Подсчет непрочитанных уведомлений и проверка на новые запросы в друзья
        const notifications = await notificationsAPI.getAll();
        const unreadNotifications = notifications.notifications.filter((n: any) => !n.read);
        
        // Показываем уведомление о новых запросах в друзья
        unreadNotifications.forEach((notif: any) => {
          if (notif.type === 'friend_request' && isOnline && window.showNotificationToast) {
            // Проверяем, не показывали ли мы уже это уведомление
            const notifKey = `shown_${notif.id}`;
            if (!sessionStorage.getItem(notifKey)) {
              sessionStorage.setItem(notifKey, 'true');
              
              usersAPI.getById(notif.from_user_id).then(({ user: sender }) => {
                window.showNotificationToast?.({
                  type: 'friend_request',
                  from: sender,
                });
              }).catch(console.error);
            }
          }
        });

        setUnreadRooms(roomCount);
        setUnreadDMs(dmCount);
        setUnreadFriends(unreadNotifications.length);
      } catch (error) {
        console.error('Failed to update unread counts:', error);
      }
    };

    updateUnreadCounts();
    const interval = setInterval(updateUnreadCounts, 10000); // Оптимизация: увеличили с 3 до 10 секунд
    return () => clearInterval(interval);
  }, [user, isOnline]);

  console.log('MainApp render - loading:', loading, 'user:', user ? `${user.username} (${user.id})` : 'null');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // If viewing another user's profile
  if (viewingUserId) {
    return (
      <div className="h-screen">
        <UserProfile 
          userId={viewingUserId} 
          onBack={() => setViewingUserId(null)}
          onOpenChat={(room) => {
            setViewingUserId(null);
            setSelectedRoom(room);
          }}
        />
        <Toaster />
      </div>
    );
  }

  // If a room is selected, show the chat room
  if (selectedRoom) {
    return (
      <div className="h-screen">
        <ChatRoom 
          key={selectedRoom.id} // Пересоздаем компонент при смене комнаты
          room={selectedRoom} 
          onBack={() => setSelectedRoom(null)}
          onUserClick={(userId) => {
            setSelectedRoom(null);
            setViewingUserId(userId);
          }}
          onOpenFriends={handleOpenFriends}
        />
        <NotificationToast 
          onOpenChat={(room) => setSelectedRoom(room)}
          onOpenDM={(dm) => setSelectedDM(dm)}
          onOpenFriendRequests={handleOpenFriends}
          currentUserId={user?.id || ''}
        />
        <Toaster />
      </div>
    );
  }

  // If a DM is selected, show the DM chat
  if (selectedDM) {
    return (
      <div className="h-screen">
        <DirectMessageChat 
          key={selectedDM.id}
          dm={selectedDM} 
          onBack={() => setSelectedDM(null)}
          onUserClick={(userId) => {
            setSelectedDM(null);
            setViewingUserId(userId);
          }}
        />
        <NotificationToast 
          onOpenChat={(room) => setSelectedRoom(room)}
          onOpenDM={(dm) => setSelectedDM(dm)}
          onOpenFriendRequests={handleOpenFriends}
          currentUserId={user?.id || ''}
        />
        <Toaster />
      </div>
    );
  }

  // Main dashboard with tabs
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-3xl">💬</span>
              <h1 className="text-xl font-bold">Коверт</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{user.username}</span>
              <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                {user.role === 'admin' && '👑 Админ'}
                {user.role === 'moderator' && '🛡️ Модератор'}
                {user.role === 'vip' && '⭐ VIP'}
                {user.role === 'user' && '👤 Пользователь'}
              </span>
            </div>
          </div>
          
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs">
                <WifiOff className="w-4 h-4" />
                <span>Соединение...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">
                <Wifi className="w-4 h-4" />
                <span>В сети</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          {/* Закрепленные вкладки */}
          <div className="sticky top-0 z-40 bg-background">
            <TabsList className="w-full rounded-none border-b h-14">
              <TabsTrigger value="rooms" className="flex-1 text-base py-3 relative">
                <MessageCircle className="w-5 h-5 mr-2" />
                Комнаты
                {unreadRooms > 0 && (
                  <Badge variant="destructive" className="ml-2 px-1.5 py-0 h-5 min-w-[20px] text-xs">
                    {unreadRooms > 99 ? '99+' : unreadRooms}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex-1 text-base py-3 relative">
                <Mail className="w-5 h-5 mr-2" />
                Личные
                {unreadDMs > 0 && (
                  <Badge variant="destructive" className="ml-2 px-1.5 py-0 h-5 min-w-[20px] text-xs">
                    {unreadDMs > 99 ? '99+' : unreadDMs}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="friends" className="flex-1 text-base py-3 relative">
                <Users className="w-5 h-5 mr-2" />
                Друзья
                {unreadFriends > 0 && (
                  <Badge variant="destructive" className="ml-2 px-1.5 py-0 h-5 min-w-[20px] text-xs">
                    {unreadFriends > 99 ? '99+' : unreadFriends}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex-1 text-base py-3">
                <User className="w-5 h-5 mr-2" />
                Профиль
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="rooms" className="h-full m-0">
              <RoomList onSelectRoom={(room) => setSelectedRoom(room)} />
            </TabsContent>

            <TabsContent value="messages" className="h-full m-0">
              <DirectMessagesList onSelectDM={(dm) => setSelectedDM(dm)} />
            </TabsContent>

            <TabsContent value="friends" className="h-full m-0">
              <UserProfile 
                showFriendsTab={true}
                onOpenChat={(room) => setSelectedRoom(room)}
                onOpenDM={(dm) => setSelectedDM(dm)}
                onViewUser={(userId) => setViewingUserId(userId)}
              />
            </TabsContent>

            <TabsContent value="profile" className="h-full m-0">
              <UserProfile />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <NotificationToast 
        onOpenChat={(room) => setSelectedRoom(room)}
        onOpenDM={(dm) => setSelectedDM(dm)}
        onOpenFriendRequests={handleOpenFriends}
        currentUserId={user?.id || ''}
      />
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <ConnectionProvider>
          <AuthProvider>
            <AchievementsProvider>
              <CryptoProvider>
                <MainApp />
              </CryptoProvider>
            </AchievementsProvider>
          </AuthProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}