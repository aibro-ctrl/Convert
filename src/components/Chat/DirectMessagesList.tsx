import React, { useState, useEffect } from 'react';
import { DirectMessage, dmAPI, usersAPI, User, roomsAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { toast } from '../ui/sonner';
import { Plus, MessageCircle, Search, Trash2 } from '../ui/icons';

interface DirectMessagesListProps {
  onSelectDM: (dm: DirectMessage) => void;
}

export function DirectMessagesList({ onSelectDM }: DirectMessagesListProps) {
  const { user } = useAuth();
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [dmUsers, setDmUsers] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    loadDMs();
    const interval = setInterval(loadDMs, 5000); // Real-time: обновление каждые 5 секунд
    return () => clearInterval(interval);
  }, []);

  const loadDMs = async () => {
    try {
      const startTime = Date.now();
      const data = await dmAPI.getAll();
      
      // Быстрое обновление UI - показываем DMs сразу
      setDms(data.dms);
      
      // Загружаем информацию о пользователях параллельно (оптимизация)
      const userIds = data.dms.flatMap((dm: DirectMessage) => 
        dm.participants.filter(id => id !== user!.id)
      );
      
      const uniqueUserIds = [...new Set(userIds)];
      
      // Используем существующий кэш для быстрого отображения
      const userMap = new Map<string, User>(dmUsers);
      
      // Параллельная загрузка всех пользователей (максимум 10 одновременно)
      const batchSize = 10;
      for (let i = 0; i < uniqueUserIds.length; i += batchSize) {
        const batch = uniqueUserIds.slice(i, i + batchSize);
        const userPromises = batch.map((userId: string) => 
          usersAPI.getById(userId)
            .then(userData => ({ userId, user: userData.user }))
            .catch(error => {
              console.error(`Failed to load user ${userId}:`, error);
              return null;
            })
        );
        
        const users = await Promise.all(userPromises);
        users.forEach(result => {
          if (result) {
            userMap.set(result.userId, result.user);
          }
        });
        
        // Обновляем UI после каждой партии для быстрого отображения
        setDmUsers(new Map(userMap));
      }
      
      console.log(`DMs loaded in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      console.error('Failed to load DMs:', error);
      if (loading) { // Показываем ошибку только при первой загрузке
        toast.error('Не удалось загрузить чаты');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUsers = async (query?: string) => {
    const searchText = query ?? searchQuery;
    if (!searchText.trim() || searchText.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const data = await usersAPI.search(searchText);
      // Фильтруем текущего пользователя
      const filtered = data.users.filter((u: User) => u.id !== user!.id);
      setSearchResults(filtered);
    } catch (error: any) {
      console.error('Ошибка поиска:', error);
      toast.error('Не удалось найти пользователей');
    }
  };

  const handleStartChat = async (otherUser: User) => {
    try {
      const dm = await dmAPI.create(otherUser.id);
      setShowNewChatDialog(false);
      setSearchQuery('');
      setSearchResults([]);
      await loadDMs();
      onSelectDM(dm);
    } catch (error: any) {
      console.error('Ошибка создания чата:', error);
      toast.error(error.message || 'Не удалось создать чат');
    }
  };

  const handleSelectDM = (dm: DirectMessage) => {
    onSelectDM(dm);
  };

  const handleDeleteDM = async (dmId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем открытие чата
    
    if (!confirm('Вы уверены, что хотите удалить этот чат? Все сообщения будут удалены.')) {
      return;
    }
    
    try {
      await roomsAPI.delete(dmId);
      toast.success('Чат удален');
      await loadDMs();
    } catch (error: any) {
      console.error('Error deleting DM:', error);
      toast.error(error.message || 'Не удалось удалить чат');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-30 bg-background p-4 border-b flex items-center justify-between">
          <h2 className="text-xl">Личные сообщения</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getOtherUserId = (dm: DirectMessage) => {
    return dm.participants.find(id => id !== user!.id);
  };

  const getOtherUser = (dm: DirectMessage) => {
    const otherId = getOtherUserId(dm);
    return otherId ? dmUsers.get(otherId) : null;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин`;
    if (diffHours < 24) return `${diffHours} ч`;
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) return `${diffDays} д`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 z-30 bg-background p-4 border-b flex items-center justify-between">
        <h2 className="text-xl">Личные сообщения</h2>
        <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Новый чат
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый чат</DialogTitle>
              <DialogDescription>
                Найдите пользователя, чтобы начать общение
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchUsers(e.target.value);
                  }}
                  placeholder="Поиск пользователя..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                />
                <Button onClick={() => handleSearchUsers()}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((searchUser) => (
                  <div
                    key={searchUser.id}
                    className="flex items-center justify-between p-3 border rounded hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        {(searchUser as any).avatar ? (
                          <AvatarImage src={(searchUser as any).avatar} alt={searchUser.username} />
                        ) : (
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {((searchUser as any).display_name || searchUser.username).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {(searchUser as any).display_name || searchUser.username}
                        </p>
                        <p className="text-sm text-muted-foreground">@{searchUser.username}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartChat(searchUser)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Написать
                    </Button>
                  </div>
                ))}
                {searchQuery && searchResults.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    Пользователи не найдены
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {dms.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Нет активных чатов</p>
            <p className="text-sm mt-2">Начните новый чат с помощью кнопки выше</p>
          </div>
        ) : (
          dms.map((dm) => {
            const otherUser = getOtherUser(dm);
            const unreadCount = dm.unread_count?.[user!.id] || 0;
            
            if (!otherUser) return null;

            return (
              <Card
                key={dm.id}
                className="relative cursor-pointer hover:bg-accent transition-colors group"
                onClick={() => handleSelectDM(dm)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => handleDeleteDM(dm.id, e)}
                  title="Удалить чат"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <CardHeader className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 shrink-0">
                      {(otherUser as any).avatar ? (
                        <AvatarImage src={(otherUser as any).avatar} alt={otherUser.username} />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {((otherUser as any).display_name || otherUser.username).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base truncate">
                          {(otherUser as any).display_name || otherUser.username}
                        </CardTitle>
                        {dm.last_activity && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTime(dm.last_activity)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        @{otherUser.username}
                      </p>
                      
                      {dm.last_message && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {dm.last_message.sender_id === user!.id && 'Вы: '}
                          {(() => {
                            const content = dm.last_message.content;
                            // Проверка на markdown изображение
                            if (content.startsWith('![') && content.includes('](')) {
                              return '🖼️ Изображение';
                            }
                            // Проверка на URL медиа
                            if (content.startsWith('https://') && content.includes('supabase.co')) {
                              if (content.includes('/voice/')) return '🎤 Голосовое сооб��ение';
                              if (content.includes('/video/')) return '🎥 Видео-кружок';
                              if (content.includes('/images/')) return '🖼️ Изображение';
                            }
                            return content.substring(0, 40);
                          })()}
                        </p>
                      )}
                      
                      {unreadCount > 0 && (
                        <Badge variant="default" className="mt-2 bg-blue-500">
                          {unreadCount} {unreadCount === 1 ? 'новое' : 'новых'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
