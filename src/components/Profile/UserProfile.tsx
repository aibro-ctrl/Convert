import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, usersAPI, Room, DirectMessage, roomsAPI, dmAPI, notificationsAPI } from '../../utils/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '../ui/sonner';
import { User as UserIcon, Shield, Crown, Star, Ban, Volume2, VolumeX, ArrowLeft, MessageCircle, UserPlus, UserMinus, Users as UsersIcon, Bell, Settings, Eye, Upload, Image as ImageIcon, Trash2 } from '../ui/icons';
import { ProfileSettings } from './ProfileSettings';
import { NotificationsPanel } from './NotificationsPanel';
import { compressImage } from '../../utils/imageCompression';
import { AchievementsPanel } from './AchievementsPanel';
import { ACHIEVEMENTS, UserAchievementData } from '../../utils/achievements';
import { fetchAPI } from '../../utils/api';
import { fixMediaUrl } from '../../utils/urlFix';
import { useAchievements } from '../../contexts/AchievementsContext';

interface UserProfileProps {
  userId?: string; // Если указан, показываем профиль другого пользователя
  onBack?: () => void;
  onOpenChat?: (room: Room) => void;
  onOpenDM?: (dm: DirectMessage) => void;
  onViewUser?: (userId: string) => void;
  showFriendsTab?: boolean; // Показать вкладку друзей
}

export function UserProfile({ userId, onBack, onOpenChat, onOpenDM, onViewUser, showFriendsTab }: UserProfileProps) {
  const { user, signout, refreshUser, godModeEnabled, setGodModeEnabled } = useAuth();
  const { tracker } = useAchievements();
  const [viewedUser, setViewedUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [favoriteRoom, setFavoriteRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [activeTab, setActiveTab] = useState('profile');
  const [pendingRequests, setPendingRequests] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [dmRooms, setDmRooms] = useState<Room[]>([]);
  const [dmUsers, setDmUsers] = useState<Record<string, User>>({});
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarModalUrl, setAvatarModalUrl] = useState<string | null>(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [achievementData, setAchievementData] = useState<UserAchievementData | null>(null);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  
  // Moderation states
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [muteHours, setMuteHours] = useState(1);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banHours, setBanHours] = useState(24);
  const [banRoomId, setBanRoomId] = useState('');
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false);
  const [showRemoveFriendDialog, setShowRemoveFriendDialog] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const isViewingOtherUser = !!userId && userId !== user?.id;
  const isAdmin = user?.role === 'admin';
  const isModerator = user?.role === 'moderator' || isAdmin;
  const isFirstUser = user?.username === 'iBro'; // Первый пользователь

  useEffect(() => {
    if (userId && userId !== user?.id) {
      loadUserProfile(userId);
      loadAchievements(userId);
      
      // Обновляем профиль каждые 2 секунды для real-time статуса друзей
      const interval = setInterval(() => {
        loadUserProfile(userId);
      }, 2000);
      
      return () => clearInterval(interval);
    } else if (user && !userId) {
      // Загружаем достижения для своего профиля
      console.log('UserProfile: Loading achievements for own profile, userId:', user.id);
      loadAchievements(user.id);
    }
  }, [userId, user?.id]);

  // Закрыть меню аватара при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAvatarMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setShowAvatarMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAvatarMenu]);

  useEffect(() => {
    if (showFriendsTab) {
      loadFriends();
      loadDMRooms();
      loadFavorites();
      
      // Обновляем каждые 2 секунды для real-time эффекта
      const interval = setInterval(() => {
        loadFriends(); // Добавляем обновление списка друзей
        loadDMRooms();
        loadFavorites();
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [showFriendsTab]);

  useEffect(() => {
    if (user && !showFriendsTab && !userId) {
      loadNotificationCount();
      // Refresh notification count every 30 seconds
      const interval = setInterval(loadNotificationCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, showFriendsTab, userId]);

  const loadNotificationCount = async () => {
    // Проверяем наличие токена перед запросом
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.log('loadNotificationCount: No token available, skipping');
      return;
    }
    
    try {
      const data = await notificationsAPI.getAll();
      const unread = data.notifications?.filter((n: any) => !n.read).length || 0;
      setNotificationCount(unread);
    } catch (error: any) {
      console.error('Failed to load notification count:', error);
      // Не показываем ошибку пользователю, если это просто отсутствие токена
      if (error.message !== 'Request failed') {
        console.error('Notification error details:', error);
      }
    }
  };

  const loadAchievements = async (targetUserId: string) => {
    try {
      console.log('UserProfile: loadAchievements called for userId:', targetUserId);
      const data = await fetchAPI(`/achievements/${targetUserId}`);
      console.log('UserProfile: Achievements data received:', data);
      setAchievementData(data);
    } catch (error: any) {
      console.error('UserProfile: Error loading achievements:', error);
      // Устанавливаем пустые данные при ошибке
      setAchievementData({
        userId: targetUserId,
        achievements: {},
        lastUpdated: new Date().toISOString(),
      });
    }
  };

  const loadUserProfile = async (id: string) => {
    const isInitialLoad = !viewedUser; // Первая загрузка
    if (isInitialLoad) {
      setLoading(true);
    }
    
    try {
      const data = await usersAPI.getById(id);
      console.log('Loaded user profile:', {
        id: data.user.id,
        username: data.user.username,
        hasAvatar: !!(data.user as any).avatar,
        avatarUrl: (data.user as any).avatar?.substring(0, 80) + '...' || 'none'
      });
      setViewedUser(data.user);
      
      // Обновляем информацию о дружбе
      await refreshUser(); // Обновляем данные текущего пользователя
      
      // Проверяем наличие активного запроса в друзья
      if (user) {
        const isFriendNow = user.friends?.includes(id) || false;
        if (!isFriendNow) {
          try {
            const requestCheck = await usersAPI.checkFriendRequest(id);
            if (requestCheck.pending) {
              setPendingRequests(prev => ({ ...prev, [id]: true }));
            } else {
              // Убираем статус pending, если запрос больше не активен
              setPendingRequests(prev => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
              });
            }
          } catch (error) {
            console.log('Error checking friend request:', error);
          }
        } else {
          // Если стали друзьями, убираем pending статус
          setPendingRequests(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
          });
        }
      }
    } catch (error: any) {
      if (isInitialLoad) {
        toast.error('Ошибка загрузки профиля');
        if (onBack) onBack();
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  const loadFriends = async () => {
    try {
      const data = await usersAPI.getFriends();
      const friendsCount = data.friends?.length || 0;
      console.log('Loaded friends:', friendsCount, 'friends');
      if (data.friends && data.friends.length > 0) {
        console.log('Friends with avatars:', data.friends.filter((f: any) => f.avatar).length);
      }
      setFriends(data.friends || []);
      
      // Проверяем достижение "Чипс-крендель" при загрузке друзей (только для своего профиля)
      if (tracker && !userId) {
        await tracker.checkFriendsCount(friendsCount);
      }
    } catch (error: any) {
      console.error('Failed to load friends:', error);
    }
  };

  const loadDMRooms = async () => {
    try {
      const data = await roomsAPI.getAll();
      const dms = data.rooms.filter((room: Room) => room.type === 'dm');
      setDmRooms(dms);
      
      // Загружаем информацию о пользователях для каждого DM
      const userCache: Record<string, User> = {};
      for (const dm of dms) {
        if (dm.dm_participants && user) {
          const otherId = dm.dm_participants.find(id => id !== user.id);
          if (otherId && !userCache[otherId]) {
            try {
              const userData = await usersAPI.getById(otherId);
              userCache[otherId] = userData.user;
            } catch (error) {
              console.error(`Failed to load user ${otherId}:`, error);
            }
          }
        }
      }
      setDmUsers(userCache);
    } catch (error: any) {
      console.error('Failed to load DM rooms:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const data = await roomsAPI.getAll();
      const favorite = data.rooms.find((room: Room) => 
        room.name.includes('⭐ Избранное') || room.name.includes('Избранное')
      );
      setFavoriteRoom(favorite || null);
    } catch (error: any) {
      console.error('Failed to load favorites:', error);
    }
  };

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-red-500" />;
      case 'moderator':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'vip':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleLabel = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'Администратор';
      case 'moderator':
        return 'Модератор';
      case 'vip':
        return 'VIP';
      default:
        return 'Пользователь';
    }
  };

  const handleUpdateRole = async (userId: string, newRole: User['role']) => {
    // Проверка: нельзя убрать роль администратора у первого пользователя
    if (viewedUser?.username === 'iBro' && newRole !== 'admin') {
      toast.error('Нельзя изменить роль первого пользователя');
      return;
    }

    try {
      await usersAPI.updateRole(userId, newRole);
      toast.success('Роль изменена');
      await refreshUser();
      if (isViewingOtherUser) {
        loadUserProfile(userId);
      }
    } catch (error: any) {
      toast.error(error.message || 'Ошибка изменения роли');
    }
  };

  const handleMuteUser = async () => {
    if (!viewedUser) return;

    try {
      await usersAPI.mute(viewedUser.id, muteHours);
      toast.success(`Пользователь замучен на ${muteHours} ч.`);
      setShowMuteDialog(false);
      loadUserProfile(viewedUser.id);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка мута');
    }
  };

  const handleUnmuteUser = async () => {
    if (!viewedUser) return;

    try {
      await usersAPI.unmute(viewedUser.id);
      toast.success('Мут снят');
      loadUserProfile(viewedUser.id);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка размута');
    }
  };

  const handleBanUser = async () => {
    if (!viewedUser) return;

    try {
      await usersAPI.ban(viewedUser.id, banHours);
      toast.success(`Пользователь отправлен в Азкабан на ${banHours} ч.`);
      setShowBanDialog(false);
      loadUserProfile(viewedUser.id);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отправки в Азкабан');
    }
  };

  const handleUnbanUser = async () => {
    if (!viewedUser) return;

    try {
      await usersAPI.unban(viewedUser.id);
      toast.success('Пользователь освобожден из Азкабана');
      loadUserProfile(viewedUser.id);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка освобождения');
    }
  };

  const handleAddFriend = async (friendId: string) => {
    try {
      await usersAPI.sendFriendRequest(friendId);
      // Mark request as pending
      setPendingRequests(prev => ({ ...prev, [friendId]: true }));
      toast.success('Запрос в друзья отправлен');
      await refreshUser();
      if (showFriendsTab) {
        loadFriends();
      }
      if (isViewingOtherUser) {
        loadUserProfile(friendId);
      }
    } catch (error: any) {
      console.error('Ошибка отправки запроса:', error);
      toast.error(error.message || 'Не удалось отправить запрос');
    }
  };

  const handleSendMessage = async (friendId: string) => {
    try {
      // Создаем или открываем DM чат с пользователем
      const dm = await dmAPI.create(friendId);
      if (onOpenDM) {
        onOpenDM(dm);
      }
    } catch (error: any) {
      toast.error('Не удалось открыть чат: ' + error.message);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      await usersAPI.removeFriend(friendId);
      // Clear pending request status
      setPendingRequests(prev => {
        const updated = { ...prev };
        delete updated[friendId];
        return updated;
      });
      toast.success('Пользователь удален из друзей');
      setShowRemoveFriendDialog(false);
      await refreshUser();
      if (showFriendsTab) {
        loadFriends();
      }
      if (isViewingOtherUser) {
        loadUserProfile(friendId);
      }
    } catch (error: any) {
      console.error('Ошибка удаления из друзей:', error);
      toast.error(error.message || 'Не удалось удалить из друзей');
    }
  };

  const handleBlockUser = async () => {
    if (!viewedUser) return;

    try {
      await usersAPI.blockUser(viewedUser.id);
      toast.success('Пользователь заблокирован');
      setShowBlockDialog(false);
      await refreshUser();
      if (onBack) onBack();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка блокировки');
    }
  };

  const handleUnblockUser = async () => {
    if (!viewedUser) return;

    try {
      await usersAPI.unblockUser(viewedUser.id);
      toast.success('Пользователь разблокирован');
      await refreshUser();
      loadUserProfile(viewedUser.id);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка разблокировки');
    }
  };

  const handleDeleteUser = async () => {
    if (!viewedUser) return;

    try {
      await usersAPI.deleteUser(viewedUser.id);
      toast.success('Пользователь удален');
      setShowDeleteUserDialog(false);
      if (onBack) onBack();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления');
    }
  };

  const handleDeleteDM = async (roomId: string) => {
    try {
      await roomsAPI.delete(roomId);
      toast.success('Чат удален');
      loadDMRooms();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления чата');
    }
  };

  const isUserBlocked = (userId: string) => {
    return user?.blocked_users?.includes(userId) || false;
  };

  const isFriend = (friendId: string) => {
    return user?.friends?.includes(friendId) || false;
  };

  // Поиск пользователей
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const data = await usersAPI.search(query);
      // Фильтруем себя из результатов
      const users = data.users || [];
      setSearchResults(users.filter((u: User) => u.id !== user?.id));
    } catch (error) {
      console.error('Ошибка поиска:', error);
      setSearchResults([]);
    }
  };

  const getOtherParticipant = (room: Room): string => {
    if (!room.dm_participants || !user) return 'Неизвестно';
    const otherId = room.dm_participants.find(id => id !== user.id);
    return otherId || 'Неизвестно';
  };

  const getOtherParticipantName = (room: Room): string => {
    const otherId = getOtherParticipant(room);
    // Сначала проверяем кеш пользователей DM
    const dmUser = dmUsers[otherId];
    if (dmUser) {
      return (dmUser as any)?.display_name || dmUser?.username;
    }
    // Затем проверяем друзей
    const friend = friends.find(f => f.id === otherId);
    if (friend) {
      return (friend as any)?.display_name || friend?.username;
    }
    return 'Загрузка...';
  };

  const getOtherParticipantAvatar = (room: Room): string | undefined => {
    const otherId = getOtherParticipant(room);
    // Сначала проверяем кеш пользователей DM
    const dmUser = dmUsers[otherId];
    if (dmUser) {
      return (dmUser as any)?.avatar;
    }
    // Затем проверяем друзей
    const friend = friends.find(f => f.id === otherId);
    return (friend as any)?.avatar;
  };

  // Получить последние 5 разблокированных достижений
  const getLatestAchievements = () => {
    if (!achievementData) return [];
    
    const unlockedAchievements = Object.values(achievementData.achievements)
      .filter(a => a.isUnlocked && a.unlockedAt)
      .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
      .slice(0, 5);

    return unlockedAchievements.map(ua => {
      const achievement = ACHIEVEMENTS.find(a => a.id === ua.achievementId);
      return achievement;
    }).filter(Boolean);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      toast.error('Можно загружать только изображения');
      return;
    }

    // Проверка размера (5 МБ)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой. Максимальный размер: 5 МБ');
      return;
    }

    try {
      setUploadingAvatar(true);
      
      // Сжимаем изображение
      const compressedFile = await compressImage(file, 512, 512, 0.85);
      
      // Загружае�� на сервер
      await usersAPI.uploadAvatar(compressedFile);
      
      toast.success('Аватар успешно обновлен!');
      
      // Обновляем профиль
      await refreshUser();
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast.error(error.message || 'Ошибка загрузки аватара');
    } finally {
      setUploadingAvatar(false);
      // Clear input
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleViewAvatar = (url: string) => {
    setAvatarModalUrl(url);
    setShowAvatarModal(true);
  };

  const handleChangeAvatar = () => {
    setShowAvatarMenu(false);
    avatarInputRef.current?.click();
  };

  // Если просмотр профиля другого пользователя
  if (isViewingOtherUser && viewedUser) {
    const canShowEmail = isModerator; // Почта видна только админам и модераторам
    
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h2 className="text-xl">Профиль пользователя</h2>
        </div>

        {/* User Info */}
        <div className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="pt-6">
              {/* Avatar at the top center */}
              <div className="flex flex-col items-center gap-2 pb-4 mb-6 border-b">
                <div 
                  className={`w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden ${(viewedUser as any).avatar ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                  onClick={() => {
                    if ((viewedUser as any).avatar) {
                      handleViewAvatar(fixMediaUrl((viewedUser as any).avatar));
                    }
                  }}
                  title={(viewedUser as any).avatar ? 'Нажмите для просмотра' : ''}
                >
                  {(viewedUser as any).avatar ? (
                    <img src={fixMediaUrl((viewedUser as any).avatar)} alt={viewedUser.username} className="w-full h-full object-cover" onError={(e) => console.error('Avatar load error:', e)} />
                  ) : (
                    <UserIcon className="w-16 h-16" />
                  )}
                </div>
                <div className="text-center">
                  <h3 className="text-2xl mb-2">{(viewedUser as any).display_name || viewedUser.username}</h3>
                  {(viewedUser as any).display_name && (
                    <p className="text-sm text-muted-foreground mb-2">@{viewedUser.username}</p>
                  )}
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      {getRoleIcon(viewedUser.role)}
                      {getRoleLabel(viewedUser.role)}
                    </Badge>
                    {(() => {
                      const lastActivity = viewedUser.last_activity;
                      if (!lastActivity) return null;
                      
                      const lastActivityTime = new Date(lastActivity).getTime();
                      const now = new Date().getTime();
                      const diff = now - lastActivityTime;
                      
                      // Если активность была меньше 3 минут назад - онлайн
                      if (diff < 3 * 60 * 1000) {
                        return <Badge variant="default" className="bg-green-500">Онлайн</Badge>;
                      }
                      
                      // Иначе показываем время последней активности
                      const minutes = Math.floor(diff / (60 * 1000));
                      const hours = Math.floor(diff / (60 * 60 * 1000));
                      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                      
                      let timeText = '';
                      if (days > 0) {
                        timeText = `${days} д`;
                      } else if (hours > 0) {
                        timeText = `${hours} ч`;
                      } else if (minutes > 0) {
                        timeText = `${minutes} мин`;
                      } else {
                        timeText = 'только что';
                      }
                      
                      return <Badge variant="outline">{timeText}</Badge>;
                    })()}
                  </div>
                  
                  {/* Последние 5 достижений */}
                  {getLatestAchievements().length > 0 && (
                    <div className="mt-3">
                      <div 
                        className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setShowAllAchievements(true)}
                        title="Нажмите, чтобы увидеть все достижения"
                      >
                        {getLatestAchievements().map((achievement: any) => (
                          <div 
                            key={achievement.id}
                            className="text-2xl"
                            title={achievement.name}
                          >
                            {achievement.icon}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Все достижения
                      </p>
                    </div>
                  )}
                  
                  {canShowEmail && (
                    <p className="text-sm text-muted-foreground">{viewedUser.email}</p>
                  )}
                </div>
              </div>

              {viewedUser.banned && (
                <div className="p-4 bg-destructive/10 border border-destructive rounded mb-4">
                  <p className="text-destructive flex items-center gap-2">
                    <Ban className="w-4 h-4" />
                    Этот пользователь заблокирован
                  </p>
                </div>
              )}

              {viewedUser.muted && (
                <div className="p-4 bg-warning/10 border border-warning rounded mb-4">
                  <p className="text-warning flex items-center gap-2">
                    <VolumeX className="w-4 h-4" />
                    Этот пользователь в муте
                  </p>
                </div>
              )}

              {/* Additional profile info */}
              {((viewedUser as any).gender || (viewedUser as any).age || (viewedUser as any).interests) && (
                <div className="p-4 bg-muted/30 rounded mb-4 space-y-2">
                  {(viewedUser as any).gender && (viewedUser as any).privacySettings?.showGender && (
                    <div>
                      <p className="text-sm text-muted-foreground">Пол</p>
                      <p>
                        {(viewedUser as any).gender === 'male' ? 'Мужской' : 
                         (viewedUser as any).gender === 'female' ? 'Женский' : 'Другой'}
                      </p>
                    </div>
                  )}
                  {(viewedUser as any).age && (viewedUser as any).privacySettings?.showAge && (
                    <div>
                      <p className="text-sm text-muted-foreground">Возраст</p>
                      <p>{(viewedUser as any).age} лет</p>
                    </div>
                  )}
                  {(viewedUser as any).interests && (viewedUser as any).privacySettings?.showInterests && (
                    <div>
                      <p className="text-sm text-muted-foreground">Интересы</p>
                      <p>{(viewedUser as any).interests}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Moderation Actions for Admins/Moderators */}
              {isModerator && viewedUser.id !== user?.id && (
                <div className="space-y-3 mb-4 p-4 bg-muted/30 rounded">
                  <h4 className="font-semibold mb-2">Управление пользователем</h4>
                  
                  {/* Mute/Unmute */}
                  {!viewedUser.muted ? (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowMuteDialog(true)}
                      disabled={!isAdmin && viewedUser.role === 'admin'}
                      className="w-full justify-start"
                    >
                      <VolumeX className="w-4 h-4 mr-2" />
                      Мут
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={handleUnmuteUser}
                      disabled={!isAdmin && viewedUser.role === 'admin'}
                      className="w-full justify-start"
                    >
                      <Volume2 className="w-4 h-4 mr-2" />
                      Размутить
                    </Button>
                  )}

                  {/* Ban/Unban (Azkaban) */}
                  {!viewedUser.banned ? (
                    <Button 
                      variant="outline"
                      onClick={() => setShowBanDialog(true)}
                      disabled={viewedUser.role === 'vip' || (!isAdmin && viewedUser.role === 'admin')}
                      className="w-full justify-start"
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Азкабан
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      onClick={handleUnbanUser}
                      disabled={!isAdmin && viewedUser.role === 'admin'}
                      className="w-full justify-start"
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Освободить из Азкабана
                    </Button>
                  )}

                  {/* Role Management - только для администраторов */}
                  {isAdmin && (
                    <div className="space-y-2">
                      <Label>Изменить роль</Label>
                      <Select
                        value={viewedUser.role}
                        onValueChange={(value: User['role']) =>
                          handleUpdateRole(viewedUser.id, value)
                        }
                        disabled={viewedUser.username === 'iBro'}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Пользователь</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                          <SelectItem value="moderator">Модератор</SelectItem>
                          <SelectItem value="admin">Администратор</SelectItem>
                        </SelectContent>
                      </Select>
                      {viewedUser.username === 'iBro' && (
                        <p className="text-xs text-muted-foreground">
                          Роль первого пользователя нельзя изменить
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Friend Actions */}
              <div className="space-y-2">
                {isFriend(viewedUser.id) ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowRemoveFriendDialog(true)}
                    className="w-full"
                  >
                    <UserMinus className="w-4 h-4 mr-2" />
                    Удалить из друзей
                  </Button>
                ) : pendingRequests[viewedUser.id] ? (
                  <Button 
                    disabled
                    variant="outline"
                    className="w-full"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Запрос отправлен
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleAddFriend(viewedUser.id)}
                    className="w-full"
                    disabled={pendingRequests[viewedUser.id]}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Добавить в друзья
                  </Button>
                )}
                
                <Button 
                  variant="secondary"
                  onClick={() => handleSendMessage(viewedUser.id)}
                  className="w-full"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Написать
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mute Dialog */}
        <Dialog open={showMuteDialog} onOpenChange={setShowMuteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Мут пользователя</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Время мута (часов)</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={muteHours}
                  onChange={(e) => setMuteHours(Math.min(24, Math.max(1, parseInt(e.target.value) || 1)))}
                />
                <p className="text-sm text-muted-foreground">
                  Максимум: 24 часа. Пользователь сможет читать сообщения, но не сможет отправлять.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowMuteDialog(false)} className="flex-1">
                  Отмена
                </Button>
                <Button onClick={handleMuteUser} className="flex-1">
                  Применить мут
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Azkaban Dialog */}
        <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Отправить в Азкабан</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Пользователь будет отправлен в специальную комнату Азкабан и не сможет её покинуть до окончания срока наказания. Видеть эту комнату могут только администраторы и модераторы.
              </p>
              <div className="space-y-2">
                <Label>Время бана (часов)</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={banHours}
                  onChange={(e) => setBanHours(Math.min(24, Math.max(1, parseInt(e.target.value) || 1)))}
                />
                <p className="text-sm text-muted-foreground">
                  Максимум: 24 часа. Пользователь не сможет покинуть Азкабан и видеть другие комнаты.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowBanDialog(false)} className="flex-1">
                  Отмена
                </Button>
                <Button variant="destructive" onClick={handleBanUser} className="flex-1">
                  В Азкабан
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Friend Dialog */}
        <Dialog open={showRemoveFriendDialog} onOpenChange={(open) => {
          setShowRemoveFriendDialog(open);
          if (!open) setSelectedFriendId(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Удалить из друзей?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Вы уверены, что хотите удалить {(() => {
                  const friendToRemove = selectedFriendId 
                    ? friends.find(f => f.id === selectedFriendId) 
                    : viewedUser;
                  return (friendToRemove as any)?.display_name || friendToRemove?.username || 'этого пользователя';
                })()} из друзей? 
                После удаления вам нужно будет снова отправить запрос в друзья для восстановления.
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowRemoveFriendDialog(false);
                    setSelectedFriendId(null);
                  }} 
                  className="flex-1"
                >
                  Отмена
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    const idToRemove = selectedFriendId || viewedUser?.id;
                    if (idToRemove) {
                      handleRemoveFriend(idToRemove);
                    }
                  }} 
                  className="flex-1"
                >
                  Удалить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Модальное окно просмотра аватара */}
        <Dialog open={showAvatarModal} onOpenChange={setShowAvatarModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Просмотр аватара</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              {avatarModalUrl && (
                <img 
                  src={avatarModalUrl} 
                  alt="Avatar" 
                  className="max-w-full max-h-[70vh] rounded-lg object-contain"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Модальное окно всех достижений */}
        <Dialog open={showAllAchievements} onOpenChange={setShowAllAchievements}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Достижения пользователя</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <AchievementsPanel userId={viewedUser.id} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Если показываем вкладку друзей
  if (showFriendsTab) {
    return (
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-30 bg-background border-b p-4">
          <h2 className="text-xl">Друзья и Уведомления</h2>
        </div>

          <div className="flex-1 overflow-y-auto space-y-4 p-6">
            {/* Уведомления */}
            <div className="space-y-2">
              <NotificationsPanel 
                onClose={() => {}} 
                onFriendRequestHandled={() => {
                  loadFriends();
                  loadNotificationCount();
                }}
                hideHeader
                onNavigateToRoom={(roomId, messageId) => {
                  // TODO: Реализовать переход к комнате и сообщению
                  // Это будет работать после интеграции с навигацией в App.tsx
                  console.log('Navigate to room:', roomId, 'message:', messageId);
                }}
              />
            </div>

            {/* Поиск пользователей */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="search">Поиск пользователей</Label>
                <Input
                  id="search"
                  type="text"
                  placeholder="Введите имя пользователя..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

                {/* Результаты поиска */}
                {searchQuery.length >= 2 && searchResults.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Результаты поиска</h4>
                    {searchResults.map((result) => (
                      <Card key={result.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className={`w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden ${(result as any).avatar ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if ((result as any).avatar) {
                                  handleViewAvatar((result as any).avatar);
                                }
                              }}
                              title={(result as any).avatar ? 'Нажмите для просмотра' : ''}
                            >
                              {(result as any).avatar ? (
                                <img src={(result as any).avatar} alt={result.username} className="w-full h-full object-cover" />
                              ) : (
                                <UserIcon className="w-5 h-5" />
                              )}
                            </div>
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => onViewUser && onViewUser(result.id)}
                            >
                              <p className="mb-1">{result.display_name || result.username}</p>
                              <p className="text-xs text-muted-foreground">@{result.username}</p>
                              <Badge variant="outline" className="flex items-center gap-1 w-fit mt-1">
                                {getRoleIcon(result.role)}
                                {getRoleLabel(result.role)}
                              </Badge>
                            </div>
                            {!isFriend(result.id) && !pendingRequests[result.id] ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleAddFriend(result.id)}
                                disabled={pendingRequests[result.id]}
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                            ) : isFriend(result.id) ? (
                              <Badge variant="default">Друг</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                              >
                                <UserPlus className="w-4 h-4 mr-1" />
                                Отправлен
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <Card>
                  <CardContent className="py-4 text-center text-muted-foreground text-sm">
                    Пользователи не найдены
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Список друзей */}
            <div className="space-y-2">
                <h4 className="text-sm font-semibold">Мои друзья</h4>
                {friends.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      У вас пока нет друзей. Найдите пользователей через поиск и добавьте их!
                    </CardContent>
                  </Card>
                ) : (
                  friends.map((friend) => (
                <Card 
                  key={friend.id} 
                  className="cursor-pointer hover:bg-accent transition-colors"
                >
                  <CardContent className="p-4">
                    <div 
                      className="flex items-center gap-3 mb-3"
                    >
                      <div 
                        className={`w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden ${(friend as any).avatar ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if ((friend as any).avatar) {
                            handleViewAvatar((friend as any).avatar);
                          }
                        }}
                        title={(friend as any).avatar ? 'Нажмите для просмотра' : ''}
                      >
                        {(friend as any).avatar ? (
                          <img src={fixMediaUrl((friend as any).avatar)} alt={friend.username} className="w-full h-full object-cover" onError={(e) => console.error('Friend avatar load error:', e)} />
                        ) : (
                          <UserIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => onViewUser && onViewUser(friend.id)}
                      >
                        <p className="mb-1">{(friend as any).display_name || friend.username}</p>
                        {(friend as any).display_name && (
                          <p className="text-xs text-muted-foreground">@{friend.username}</p>
                        )}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className="flex items-center gap-1">
                            {getRoleIcon(friend.role)}
                            {getRoleLabel(friend.role)}
                          </Badge>
                          {(() => {
                            const lastActivity = friend.last_activity;
                            if (!lastActivity) return null;
                            
                            const diff = new Date().getTime() - new Date(lastActivity).getTime();
                            if (diff < 5 * 60 * 1000) {
                              return <Badge variant="default" className="text-xs">онлайн</Badge>;
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendMessage(friend.id);
                        }}
                        className="flex-1"
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        Написать
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFriendId(friend.id);
                          setShowRemoveFriendDialog(true);
                        }}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
              )}
            </div>
          </div>

          {/* Модальное окно просмотра аватара */}
          <Dialog open={showAvatarModal} onOpenChange={setShowAvatarModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Просмотр аватара</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center p-4">
                {avatarModalUrl && (
                  <img 
                    src={avatarModalUrl} 
                    alt="Avatar" 
                    className="max-w-full max-h-[70vh] rounded-lg object-contain"
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Remove Friend Dialog */}
          <Dialog open={showRemoveFriendDialog} onOpenChange={(open) => {
            setShowRemoveFriendDialog(open);
            if (!open) setSelectedFriendId(null);
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Удалить из друзей?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Вы уверены, что хотите удалить {(() => {
                    const friendToRemove = friends.find(f => f.id === selectedFriendId);
                    return (friendToRemove as any)?.display_name || friendToRemove?.username || 'этого пользователя';
                  })()} из друзей? 
                  После удаления вам нужно будет снова отправить запрос в друзья для восстановления.
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowRemoveFriendDialog(false);
                      setSelectedFriendId(null);
                    }} 
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      if (selectedFriendId) {
                        handleRemoveFriend(selectedFriendId);
                      }
                    }} 
                    className="flex-1"
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
      </div>
    );
  }

  // Обычный профиль текущего пользователя
  return (
    <div className="h-full flex flex-col">
      {/* Header с кнопкой "Назад" если профиль открыт из чата */}
      {onBack && (
        <div className="border-b p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl">Мой профиль</h2>
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="profile">
            <UserIcon className="w-4 h-4 mr-2" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="achievements">
            <Star className="w-4 h-4 mr-2" />
            Ачивки
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Настройки
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="profile" className="m-0 p-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div 
                      className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                    >
                      {(user as any).avatar ? (
                        <img src={fixMediaUrl((user as any).avatar)} alt={user.username} className="w-full h-full object-cover" onError={(e) => console.error('Avatar load error:', e)} />
                      ) : (
                        <UserIcon className="w-16 h-16" />
                      )}
                    </div>
                    {/* Меню выбора */}
                    {showAvatarMenu && (
                      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg z-50 min-w-[150px] overflow-hidden">
                        {(user as any).avatar && (
                          <button
                            onClick={() => {
                              setShowAvatarMenu(false);
                              handleViewAvatar(fixMediaUrl((user as any).avatar));
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-accent transition-colors flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Просмотреть
                          </button>
                        )}
                        <button
                          onClick={handleChangeAvatar}
                          disabled={uploadingAvatar}
                          className="w-full px-4 py-2 text-left hover:bg-accent transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {uploadingAvatar ? (
                            <>
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              Загрузка...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              Изменить
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div className="text-center">
                    <CardTitle className="text-2xl mb-2">
                      {(user as any)?.display_name || user?.username}
                    </CardTitle>
                    {(user as any)?.display_name && (
                      <p className="text-sm text-muted-foreground mb-2">@{user?.username}</p>
                    )}
                    <CardDescription>{user?.email}</CardDescription>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-2">
                    {getRoleIcon(user.role)}
                    {getRoleLabel(user.role)}
                  </Badge>
                  
                  {/* Последние 5 достижений */}
                  {getLatestAchievements().length > 0 && (
                    <div className="mt-3">
                      <div 
                        className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setShowAllAchievements(true)}
                        title="Нажмите, чтобы увидеть все достижения"
                      >
                        {getLatestAchievements().map((achievement: any) => (
                          <div 
                            key={achievement.id}
                            className="text-2xl"
                            title={achievement.name}
                          >
                            {achievement.icon}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Все достижения
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Дополнительная информация */}
            {((user as any)?.gender || (user as any)?.age || (user as any)?.interests) && (
              <Card>
                <CardHeader>
                  <CardTitle>Дополнительная информация</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(user as any)?.gender && (
                    <div>
                      <p className="text-sm text-muted-foreground">Пол</p>
                      <p>
                        {(user as any).gender === 'male' ? 'Мужской' : 
                         (user as any).gender === 'female' ? 'Женский' : 'Другой'}
                      </p>
                    </div>
                  )}
                  {(user as any)?.age && (
                    <div>
                      <p className="text-sm text-muted-foreground">Возраст</p>
                      <p>{(user as any).age} лет</p>
                    </div>
                  )}
                  {(user as any)?.interests && (
                    <div>
                      <p className="text-sm text-muted-foreground">Интересы</p>
                      <p>{(user as any).interests}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* God Mode для администраторов */}
            {isFirstUser && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Режим "Глаз Бога"
                  </CardTitle>
                  <CardDescription>
                    Просмотр всех комнат в режиме наблюдения
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="god-mode">Включить режим наблюдения</Label>
                    <Switch
                      id="god-mode"
                      checked={godModeEnabled}
                      onCheckedChange={setGodModeEnabled}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Кнопка выхода */}
            <Card>
              <CardContent className="pt-6">
                <Button 
                  variant="destructive" 
                  onClick={signout}
                  className="w-full"
                >
                  Выйти из аккаунта
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="achievements" className="m-0 p-6">
            <AchievementsPanel userId={user.id} />
          </TabsContent>

          <TabsContent value="settings" className="m-0 h-full">
            <ProfileSettings />
          </TabsContent>
        </div>
      </Tabs>

      {/* Модальное окно просмотра аватара */}
      <Dialog open={showAvatarModal} onOpenChange={setShowAvatarModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Просмотр аватара</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {avatarModalUrl && (
              <img 
                src={avatarModalUrl} 
                alt="Avatar" 
                className="max-w-full max-h-[70vh] rounded-lg object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Модальное окно всех достижений */}
      {user && (
        <Dialog open={showAllAchievements} onOpenChange={setShowAllAchievements}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Мои достижения</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <AchievementsPanel userId={user.id} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
