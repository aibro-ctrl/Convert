import React, { useState, useEffect } from 'react';
import { DirectMessage, dmAPI, usersAPI, User, roomsAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionCrypto } from '../../contexts/SessionCryptoContext';
import { decryptMessageContent } from '../../utils/messageEncryption';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { toast } from '../ui/sonner';
import { Plus, MessageCircle, Search, Trash2 } from '../ui/icons';
import { fixMediaUrl } from '../../utils/urlFix';

interface DirectMessagesListProps {
  onSelectDM: (dm: DirectMessage) => void;
}

export function DirectMessagesList({ onSelectDM }: DirectMessagesListProps) {
  const { user } = useAuth();
  const sessionCrypto = useSessionCrypto();
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [dmUsers, setDmUsers] = useState<Map<string, User>>(new Map());
  const [decryptedPreviews, setDecryptedPreviews] = useState<Map<string, string>>(new Map());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dmToDelete, setDmToDelete] = useState<DirectMessage | null>(null);

  useEffect(() => {
    loadDMs();
    // Обновление списка DM - не так часто как сообщения, но достаточно для актуальности (15 секунд)
    const interval = setInterval(loadDMs, 15000);
    return () => clearInterval(interval);
  }, []);

  // Расшифровка превью сообщений (как в Telegram - всегда показываем расшифрованный текст)
  useEffect(() => {
    const decryptPreviews = async () => {
      if (dms.length === 0) {
        setDecryptedPreviews(new Map());
        return;
      }

      const previewMap = new Map<string, string>();
      
      for (const dm of dms) {
        if (dm.last_message && dm.last_message.content) {
          try {
            const originalContent = dm.last_message.content;
            
            // Проверяем, является ли контент зашифрованным
            let isEncrypted = false;
            try {
              const parsed = JSON.parse(originalContent);
              isEncrypted = parsed && parsed.version && parsed.ciphertext;
            } catch {
              // Не JSON, значит незашифрованное сообщение
              isEncrypted = false;
            }

            // Если не зашифровано, используем как есть
            if (!isEncrypted) {
              previewMap.set(dm.id, originalContent);
              continue;
            }

            // Если зашифровано, пытаемся расшифровать
            // Для DM room_id = dm.id, sender_id берем из last_message
            const messageForDecryption = {
              id: dm.last_message.id || '',
              content: originalContent,
              sender_id: dm.last_message.sender_id || '',
              room_id: dm.id, // Для DM room_id = dm.id
              type: (dm.last_message as any).type || 'text',
              created_at: dm.last_message.created_at || new Date().toISOString(),
            } as any;

            // Пытаемся расшифровать (decryptMessageContent автоматически использует базовое расшифрование если основное не готово)
            const decrypted = await decryptMessageContent(
              originalContent,
              sessionCrypto,
              messageForDecryption
            );
            
            // Используем расшифрованный контент (даже если это заглушка, decryptMessageContent вернет что-то разумное)
            previewMap.set(dm.id, decrypted);
          } catch (error) {
            console.error(`Failed to decrypt preview for DM ${dm.id}:`, error);
            // В случае ошибки показываем оригинал (может быть незашифрованное сообщение)
            previewMap.set(dm.id, dm.last_message.content);
          }
        }
      }

      setDecryptedPreviews(previewMap);
    };

    decryptPreviews();
  }, [dms, sessionCrypto, sessionCrypto.sessionKey, sessionCrypto.isReady]);

  const loadDMs = async () => {
    const startTime = Date.now();
    try {
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
      setHasError(false); // Сбрасываем ошибку при успешной загрузке
    } catch (error: any) {
      console.error('Failed to load DMs:', error);
      setHasError(true);
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

  const handleDeleteDM = (dmId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем открытие чата
    
    const dm = dms.find(d => d.id === dmId);
    if (!dm) return;
    
    setDmToDelete(dm);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteDM = async () => {
    if (!dmToDelete) return;

    try {
      await roomsAPI.delete(dmToDelete.id);
      toast.success('Чат удален');
      await loadDMs();
      setDeleteDialogOpen(false);
      setDmToDelete(null);
    } catch (error: any) {
      console.error('Error deleting DM:', error);
      toast.error(error.message || 'Не удалось удалить чат');
      setDeleteDialogOpen(false);
      setDmToDelete(null);
    }
  };

  // Если есть критическая ошибка и не загружается, не показываем компонент
  if (hasError && !loading) {
    return null;
  }

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

  // Если есть критическая ошибка и не загружается, не показываем компонент
  if (hasError && !loading) {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 z-30 bg-background p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl">Личные сообщения</h2>
          {dms.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {dms.length} {dms.length === 1 ? 'чат' : dms.length < 5 ? 'чата' : 'чатов'}
            </Badge>
          )}
        </div>
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
                          <AvatarImage src={fixMediaUrl((searchUser as any).avatar)} alt={searchUser.username} />
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
                className="relative cursor-pointer border border-border/60 bg-card/80 hover:bg-card/95 hover:border-primary/60 shadow-sm hover:shadow-lg transition-all duration-200 ease-out hover:-translate-y-0.5 group"
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
                        <AvatarImage src={fixMediaUrl((otherUser as any).avatar)} alt={otherUser.username} />
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
                      
                      {dm.last_message && dm.last_message.content && dm.last_message.content.trim() && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {dm.last_message.sender_id === user!.id && 'Вы: '}
                          {(() => {
                            // Используем расшифрованный контент, если доступен
                            let content = decryptedPreviews.get(dm.id);
                            
                            // Если расшифрованный контент не найден, используем оригинал
                            // (расшифровка должна произойти в useEffect, но на всякий случай используем оригинал)
                            if (!content) {
                              content = dm.last_message.content;
                            }
                            
                            // Если контент пустой после расшифровки, не показываем превью
                            if (!content || !content.trim()) {
                              return null;
                            }
                            
                            // Если контент все еще выглядит как зашифрованный JSON, пытаемся расшифровать на лету
                            if (content && content.trim().startsWith('{') && content.includes('"version"') && content.includes('"ciphertext"')) {
                              // Это зашифрованное сообщение, но расшифровка еще не произошла
                              // Показываем оригинал (лучше чем заглушка) - расшифровка произойдет при следующем обновлении
                              content = dm.last_message.content;
                            }
                            
                            // Если после всех проверок контент пустой, не показываем превью
                            if (!content || !content.trim()) {
                              return null;
                            }
                            
                            // Проверка на markdown изображение
                            if (content.startsWith('![') && content.includes('](')) {
                              return '🖼️ Изображение';
                            }
                            // Проверка типа сообщения (приоритет)
                            const messageType = (dm.last_message as any).type;
                            if (messageType === 'video') {
                              return '🎥 Видео';
                            }
                            if (messageType === 'voice' || messageType === 'audio') {
                              return '🎤 Голосовое';
                            }
                            
                            // Проверка на URL медиа (любой хост, не только supabase.co)
                            if (content.startsWith('http://') || content.startsWith('https://')) {
                              if (content.includes('/voice/') || content.includes('/audio/') || content.includes('voice') || content.includes('audio')) {
                                return '🎤 Голосовое';
                              }
                              if (content.includes('/video/') || content.includes('video')) {
                                return '🎥 Видео';
                              }
                              if (content.includes('/images/') || content.includes('/image/') || content.includes('images') || content.includes('image')) {
                                return '🖼️ Изображение';
                              }
                              // Если это просто URL без явного типа, проверяем по storage путям
                              if (content.includes('/storage/v1/object/')) {
                                // Это может быть любой медиафайл, но без явного типа показываем как файл
                                return '📎 Файл';
                              }
                            }
                            return content.substring(0, 40);
                          })()}
                        </p>
                      )}
                      
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="mt-2 border-2 border-red-600">
                          {unreadCount} {unreadCount === 1 ? 'новое' : unreadCount < 5 ? 'новых' : 'новых'}
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

      {/* Диалог подтверждения удаления чата */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить чат?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить этот чат? 
              <br />
              Это действие необратимо. Все сообщения будут удалены.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setDmToDelete(null);
            }}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirmDeleteDM}>
              Удалить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
