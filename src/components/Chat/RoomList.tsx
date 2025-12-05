import React, { useState, useEffect } from 'react';
import { Room, roomsAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionCrypto } from '../../contexts/SessionCryptoContext';
import { decryptMessageContent } from '../../utils/messageEncryption';
import { RoomManagement } from './RoomManagement';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { toast } from '../ui/sonner';
import { Plus, Users, Lock, Eye, AtSign, Heart, MessageCircle, Edit, Trash2 } from '../ui/icons';

interface RoomListProps {
  onSelectRoom: (room: Room) => void;
}

export function RoomList({ onSelectRoom }: RoomListProps) {
  const { user, godModeEnabled } = useAuth();
  const sessionCrypto = useSessionCrypto();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'public' | 'private'>('private');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [managingRoom, setManagingRoom] = useState<Room | null>(null);
  const [decryptedPreviews, setDecryptedPreviews] = useState<Map<string, string>>(new Map());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  useEffect(() => {
    // Очистка дублирующих Азкабанов при первой загрузке (только для админа)
    if (user?.role === 'admin') {
      roomsAPI.cleanupAzkaban().catch(console.error);
    }
    
    loadRooms();
    // Обновление списка комнат - не так часто как сообщения, но достаточно для актуальности (15 секунд)
    const interval = setInterval(loadRooms, 15000);
    return () => clearInterval(interval);
  }, [godModeEnabled]); // Перезагружаем комнаты при изменении режима Глаза Бога

  // Расшифровка превью сообщений (как в Telegram - всегда показываем расшифрованный текст)
  useEffect(() => {
    const decryptPreviews = async () => {
      if (rooms.length === 0) {
        setDecryptedPreviews(new Map());
        return;
      }

      const previewMap = new Map<string, string>();
      
      for (const room of rooms) {
        if (room.last_message && room.last_message.content) {
          try {
            const originalContent = room.last_message.content;
            
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
              previewMap.set(room.id, originalContent);
              continue;
            }

            // Если зашифровано, пытаемся расшифровать
            // Создаем объект сообщения для расшифровки
            const messageForDecryption = {
              id: room.last_message.id || '',
              content: originalContent,
              sender_id: room.last_message.sender_id || '',
              room_id: room.id,
              type: (room.last_message as any).type || 'text',
              created_at: room.last_message.created_at || new Date().toISOString(),
            } as any;

            // Пытаемся расшифровать (decryptMessageContent автоматически использует базовое расшифрование если основное не готово)
            const decrypted = await decryptMessageContent(
              originalContent,
              sessionCrypto,
              messageForDecryption
            );
            
            // Используем расшифрованный контент
            previewMap.set(room.id, decrypted);
          } catch (error) {
            console.error(`Failed to decrypt preview for room ${room.id}:`, error);
            // В случае ошибки показываем оригинал (может быть незашифрованное сообщение)
            previewMap.set(room.id, room.last_message.content);
          }
        }
      }

      setDecryptedPreviews(previewMap);
    };

    decryptPreviews();
  }, [rooms, sessionCrypto, sessionCrypto.sessionKey, sessionCrypto.isReady]);

  const loadRooms = async () => {
    try {
      const data = await roomsAPI.getAll(godModeEnabled);
      setRooms(data.rooms);
      
      // Проверяем, забанен ли пользователь
      if (user?.banned) {
        // Ищем комнату Азкабан
        const azkaban = data.rooms.find((r: Room) => r.name === '🔒 Азкабан');
        if (azkaban) {
          // Автоматически присоединяемся к Азкабану, если забанены
          try {
            await roomsAPI.join(azkaban.id, false);
            // Автоматически открываем Азкабан для забаненного пользователя
            onSelectRoom(azkaban);
            toast.error('Вы забанены и перемещены в Азкабан');
          } catch (error) {
            console.error('Failed to auto-join Azkaban:', error);
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to load rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newRoomName.trim()) {
      return;
    }

    try {
      const data = await roomsAPI.create(newRoomName, newRoomType);
      setRooms([...rooms, data]);
      setDialogOpen(false);
      setNewRoomName('');
    } catch (error: any) {
      console.error('Ошибка создания комнаты:', error);
    }
  };

  const handleJoinRoom = async (room: Room) => {
    if (!room.members.includes(user!.id) && !godModeEnabled) {
      console.log(`User ${user!.id} (${user!.username}) joining room ${room.id} (${room.name}, type: ${room.type})`);
      try {
        const result = await roomsAPI.join(room.id, godModeEnabled);
        console.log('Join result received, members count:', result?.members?.length);
        // Обновляем локальный объект комнаты с новыми данными
        if (result) {
          // Результат join - это сама комната, не { data: room }
          room = result;
          console.log(`Room updated after join, user ${user!.id} is member: ${room.members.includes(user!.id)}`);
        }
        // Перезагружаем список комнат в фоне
        loadRooms();
      } catch (error: any) {
        console.error('Ошибка входа в комнату:', error);
        toast.error('Не удалось присоединиться к комнате: ' + (error.message || 'Неизвестная ошибка'));
        return;
      }
    }
    console.log(`Selecting room ${room.id} (${room.name}), user ${user!.id} is member: ${room.members.includes(user!.id)}, godMode: ${godModeEnabled}`);
    onSelectRoom(room);
  };

  const handleDeleteRoom = (room: Room) => {
    const canDelete = 
      (room.type === 'public' && user && ['admin', 'moderator'].includes(user.role)) ||
      (room.type === 'private' && room.created_by === user?.id) ||
      (user && user.role === 'admin'); // Админ может удалять любые комнаты

    if (!canDelete) {
      toast.error('У вас нет прав для удаления этой комнаты');
      return;
    }

    setRoomToDelete(room);
    setDeleteDialogOpen(true);
    setShowContextMenu(false);
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;

    try {
      await roomsAPI.delete(roomToDelete.id);
      toast.success('Комната удалена');
      loadRooms();
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
      setSelectedRoom(null);
    } catch (error: any) {
      console.error('Ошибка удаления комнаты:', error);
      toast.error(error.message || 'Не удалось удалить комнату');
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-30 bg-background p-4 border-b flex items-center justify-between">
          <h2 className="text-xl">Комнаты</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="p-4">
                <div className="space-y-3">
                  <div className="h-5 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="flex gap-2">
                    <div className="h-6 bg-muted rounded w-20" />
                    <div className="h-6 bg-muted rounded w-24" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Показываем компонент управления комнатой, если выбрана комната для редактирования
  if (managingRoom) {
    return <RoomManagement room={managingRoom} onBack={() => setManagingRoom(null)} />;
  }

  // Фильтруем DM комнаты и избранное (DM теперь в отдельной системе)
  let filteredRooms = rooms
    .filter(room => 
      room.type !== 'dm' && // Убираем личные диалоги (теперь в отдельной системе)
      !room.name.includes('⭐ Избранное') && !room.name.includes('Избранное') // Убираем избранное
    );
  
  // Фильтрация комнаты Азкабан:
  // - Забаненные видят ТОЛЬКО Азкабан
  // - Незабаненные НЕ ВИДЯТ Азкабан вообще
  if (user?.banned) {
    // Если пользователь забанен, показываем только Азкабан
    filteredRooms = filteredRooms.filter(room => room.name === '🔒 Азкабан');
  } else {
    // Если пользователь НЕ забанен, скрываем Азкабан
    filteredRooms = filteredRooms.filter(room => room.name !== '🔒 Азкабан');
  }
  
  filteredRooms = filteredRooms.sort((a, b) => {
    // Публичные комнаты всегда выше приватных
    if (a.type !== b.type) {
      return a.type === 'public' ? -1 : 1;
    }
    
    // Закрепленные комнаты всегда сверху в пределах своего типа
    const aPinned = a.pinned_message_id ? 1 : 0;
    const bPinned = b.pinned_message_id ? 1 : 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }
    
    // Незакрепленные комнаты сортируем по последней активности
    const aTime = a.last_activity || a.created_at;
    const bTime = b.last_activity || b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 z-30 bg-background p-4 border-b flex items-center justify-between">
        <h2 className="text-xl">Комнаты</h2>
        {!user?.banned && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Создать
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать комнату</DialogTitle>
              <DialogDescription>
                {user?.role === 'admin'
                  ? 'Администратор может создавать публичные и приватные комнаты'
                  : 'Вы можете создать только приватную комнату'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomName">Название комнаты</Label>
                <Input
                  id="roomName"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Моя комната"
                  required
                />
              </div>
              {user?.role === 'admin' && (
                <div className="space-y-2">
                  <Label>Тип комнаты</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="public"
                        checked={newRoomType === 'public'}
                        onChange={(e) => setNewRoomType('public')}
                      />
                      Публичная
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="private"
                        checked={newRoomType === 'private'}
                        onChange={(e) => setNewRoomType('private')}
                      />
                      Приватная
                    </label>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full">
                Создать комнату
              </Button>
            </form>
          </DialogContent>
        </Dialog>
          )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredRooms.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Нет доступных комнат. Создайте первую!
          </div>
        ) : (
          filteredRooms.map((room) => {
            const canManage = 
              (room.type === 'public' && user && ['admin', 'moderator'].includes(user.role)) ||
              (room.type === 'private' && room.created_by === user?.id);

            return (
              <div key={room.id} className="relative">
                <Card
                  className="cursor-pointer border border-border/60 bg-card/80 hover:bg-card/95 hover:border-primary/60 shadow-sm hover:shadow-lg transition-all duration-200 ease-out hover:-translate-y-0.5"
                  onClick={() => handleJoinRoom(room)}
                  onContextMenu={(e) => {
                    if (canManage) {
                      e.preventDefault();
                      setSelectedRoom(room);
                      setShowContextMenu(true);
                    }
                  }}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {room.type === 'public' ? (
                            <Users className="w-4 h-4" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                          {room.name}
                          {room.isGodMode && (
                            <Badge variant="secondary" className="ml-2">
                              <Eye className="w-3 h-3 mr-1" />
                              Глаз Бога
                            </Badge>
                          )}
                        </CardTitle>
                        
                        {/* Превью последнего сообщения */}
                        {room.last_message && room.last_message.content && room.last_message.content.trim() && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            <span className="font-medium">{room.last_message.sender_username}:</span>{' '}
                            {(() => {
                              // Используем расшифрованный контент, если доступен
                              let content = decryptedPreviews.get(room.id);
                              
                              // Если расшифрованный контент не найден, используем оригинал
                              // (расшифровка должна произойти в useEffect, но на всякий случай используем оригинал)
                              if (!content) {
                                content = room.last_message.content;
                              }
                              
                              // Если контент пустой после расшифровки, не показываем превью
                              if (!content || !content.trim()) {
                                return null;
                              }
                              
                              // Если контент все еще выглядит как зашифрованный JSON, пытаемся расшифровать на лету
                              if (content && content.trim().startsWith('{') && content.includes('"version"') && content.includes('"ciphertext"')) {
                                // Это зашифрованное сообщение, но расшифровка еще не произошла
                                // Показываем оригинал (лучше чем заглушка) - расшифровка произойдет при следующем обновлении
                                content = room.last_message.content;
                              }
                              
                              // Если после всех проверок контент пустой, не показываем превью
                              if (!content || !content.trim()) {
                                return null;
                              }
                              
                              const messageType = (room.last_message as any).type;
                              
                              // Проверка типа сообщения (приоритет)
                              if (messageType === 'video') {
                                return '🎥 Видео';
                              }
                              if (messageType === 'voice' || messageType === 'audio') {
                                return '🎤 Голосовое';
                              }
                              
                              // Проверка на markdown изображение
                              if (content.startsWith('![') && content.includes('](')) {
                                return '🖼️ Изображение';
                              }
                              
                              // Проверка на URL медиа (любой хост, не только supabase.co)
                              if (content.startsWith('http://') || content.startsWith('https://')) {
                                // Проверяем по пути в URL
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
                              
                              return content.substring(0, 50);
                            })()}
                          </p>
                        )}
                        
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <Badge variant={room.type === 'public' ? 'default' : 'outline'}>
                            {room.type === 'public' ? 'Публичная' : 'Приватная'}
                          </Badge>
                          <Badge variant="secondary">
                            {room.members.length} участников
                          </Badge>
                          
                          {/* Счетчик непрочитанных */}
                          {room.unread_count && room.unread_count[user!.id] > 0 && (
                            <Badge variant="default" className="bg-red-500 text-white border-2 border-red-600">
                              {room.unread_count[user!.id]} новых
                            </Badge>
                          )}
                          
                          {room.unread_mentions && room.unread_mentions[user!.id] > 0 && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AtSign className="w-3 h-3" />
                              {room.unread_mentions[user!.id]}
                            </Badge>
                          )}
                          {room.unread_reactions && room.unread_reactions[user!.id] > 0 && (
                            <Badge variant="default" className="flex items-center gap-1 bg-pink-500">
                              <Heart className="w-3 h-3" />
                              {room.unread_reactions[user!.id]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRoom(room);
                            setShowContextMenu(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                </Card>

                {/* Context menu */}
                {showContextMenu && selectedRoom?.id === room.id && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => {
                        setShowContextMenu(false);
                        setSelectedRoom(null);
                      }}
                    />
                    <div className="absolute top-full left-0 mt-1 w-48 bg-popover border rounded-md shadow-lg z-50 p-2">
                      <div className="space-y-1">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManagingRoom(room);
                            setShowContextMenu(false);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Редактировать
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Удалить
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Диалог подтверждения удаления комнаты */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить комнату?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить комнату "{roomToDelete?.name}"? 
              <br />
              Это действие необратимо. Все сообщения и данные комнаты будут удалены.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setRoomToDelete(null);
            }}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirmDeleteRoom}>
              Удалить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
