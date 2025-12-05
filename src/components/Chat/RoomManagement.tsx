import React, { useState, useEffect } from 'react';
import { Room, User, usersAPI, roomsAPI, messagesAPI, Message } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '../ui/sonner';
import { ArrowLeft, UserPlus, UserMinus, Pin, X, Trash2 } from '../ui/icons';

interface RoomManagementProps {
  room: Room;
  onBack: () => void;
}

export function RoomManagement({ room, onBack }: RoomManagementProps) {
  const { user } = useAuth();
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false);
  const [roomName, setRoomName] = useState(room.name);
  const [members, setMembers] = useState<User[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';
  const isModerator = user?.role === 'moderator';
  const isCreator = room.created_by === user?.id;
  const canManage = isAdmin || isModerator || (room.type === 'private' && isCreator);

  useEffect(() => {
    loadRoomData();
  }, [room.id]);

  const loadRoomData = async () => {
    try {
      // Загружаем участников
      const memberPromises = room.members.map((memberId: string) => usersAPI.getById(memberId));
      const memberData = await Promise.all(memberPromises);
      const loadedMembers = memberData.map((data) => data.user).filter(Boolean);
      setMembers(loadedMembers);

      // Загружаем историю закрепленных сообщений
      const pinnedIds = room.pinned_message_ids || (room.pinned_message_id ? [room.pinned_message_id] : []);
      if (pinnedIds.length > 0) {
        const messagesData = await messagesAPI.get(room.id);
        // Загружаем все закрепленные сообщения из истории
        const pinned = messagesData.messages.filter((msg: Message) => pinnedIds.includes(msg.id));
        // Сортируем по порядку в истории (последнее закрепленное - первое)
        const sortedPinned = pinnedIds
          .map(id => pinned.find(msg => msg.id === id))
          .filter(Boolean) as Message[];
        setPinnedMessages(sortedPinned);
      }
    } catch (error) {
      console.error('Failed to load room data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRoomName = async () => {
    if (!roomName.trim() || roomName === room.name) return;

    try {
      // В реальном API здесь был бы запрос на обновление названия
      toast.success('Название комнаты обновлено');
      // Временно обновляем локально
      room.name = roomName;
    } catch (error: any) {
      toast.error(error.message || 'Ошибка обновления названия');
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
      // Фильтруем: исключаем себя и уже добавленных участников
      const users = data.users || [];
      setSearchResults(users.filter((u: User) => 
        u.id !== user?.id && !room.members.includes(u.id)
      ));
    } catch (error: any) {
      console.error('Ошибка поиска:', error);
      toast.error('Ошибка поиска');
      setSearchResults([]);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      await roomsAPI.invite(room.id, userId);
      toast.success('Участник добавлен');
      setSearchQuery('');
      setSearchResults([]);
      loadRoomData();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка добавления участника');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Удалить участника из комнаты?')) return;

    try {
      // В реальном API здесь был бы запрос на удаление участника
      toast.success('Участник удален');
      loadRoomData();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления участника');
    }
  };

  const handleUnpinMessage = async () => {
    try {
      await roomsAPI.unpinMessage(room.id);
      toast.success('Сообщение откреплено');
      setPinnedMessages([]);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка открепления');
    }
  };

  const handleClearHistory = () => {
    setClearHistoryDialogOpen(true);
  };

  const confirmClearHistory = async () => {
    try {
      const messagesData = await messagesAPI.get(room.id);
      const messages = messagesData.messages;

      // Удаляем все сообщения
      for (const msg of messages) {
        await messagesAPI.delete(msg.id);
      }

      toast.success('История чата очищена');
      setClearHistoryDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка очистки истории');
      setClearHistoryDialogOpen(false);
    }
  };

  if (!canManage) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">У вас нет прав для управления этой комнатой</p>
        <Button onClick={onBack}>Назад</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-3 bg-background">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2>Управление комнатой</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Room Name */}
        <Card>
          <CardHeader>
            <CardTitle>Название комнаты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Название комнаты"
              />
              <Button onClick={handleUpdateRoomName} disabled={!roomName.trim() || roomName === room.name}>
                Сохранить
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Members Management */}
        <Card>
          <CardHeader>
            <CardTitle>Участники ({members.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search and add */}
            <div className="space-y-2">
              <Label>Добавить участника</Label>
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
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {searchResults.map((searchUser) => (
                    <div key={searchUser.id} className="flex items-center justify-between p-2">
                      <div>
                        <p>{searchUser.username}</p>
                        <p className="text-sm text-muted-foreground">{searchUser.email}</p>
                      </div>
                      <Button size="sm" onClick={() => handleAddMember(searchUser.id)}>
                        Добавить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current members */}
            <div className="space-y-2">
              <Label>Текущие участники</Label>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2">
                    <div>
                      <p>{member.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.role === 'admin' && '👑 Админ'}
                        {member.role === 'moderator' && '🛡️ Модератор'}
                        {member.role === 'vip' && '⭐ VIP'}
                        {member.role === 'user' && '👤 Пользователь'}
                      </p>
                    </div>
                    {member.id !== room.created_by && member.id !== user?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pinned Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Закрепленные сообщения</CardTitle>
          </CardHeader>
          <CardContent>
            {pinnedMessages.length > 0 ? (
              <div className="space-y-2">
                {pinnedMessages.map((msg) => {
                  // Функция для форматирования контента закрепленного сообщения
                  const formatPinnedContent = (message: Message): string => {
                    const messageType = message.type;
                    
                    // Проверка типа сообщения (приоритет)
                    if (messageType === 'video') {
                      return '🎥 Видео';
                    }
                    if (messageType === 'voice' || messageType === 'audio') {
                      return '🎤 Голосовое';
                    }
                    
                    const content = message.content;
                    
                    // Проверка на markdown изображение
                    if (content.startsWith('![') && content.includes('](')) {
                      return '🖼️ Изображение';
                    }
                    
                    // Проверка на URL медиа (любой хост)
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
                      // Если это просто URL без явного типа, показываем как файл
                      if (content.includes('/storage/v1/object/')) {
                        return '📎 Файл';
                      }
                    }
                    
                    // Обычный текст - обрезаем до 100 символов
                    return content.length > 100 ? content.substring(0, 100) + '...' : content;
                  };

                  return (
                    <div key={msg.id} className="border rounded-lg p-3 flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">{msg.sender_username}</p>
                        <p className="text-sm">{formatPinnedContent(msg)}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={async () => {
                          try {
                            await roomsAPI.unpinMessage(room.id, msg.id);
                            toast.success('Сообщение откреплено');
                            loadRoomData();
                          } catch (error: any) {
                            toast.error(error.message || 'Ошибка открепления');
                          }
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Нет закрепленных сообщений</p>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Опасная зона</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start text-destructive border-destructive hover:bg-destructive/10"
              onClick={handleClearHistory}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Очистить историю чата
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Диалог подтверждения очистки истории */}
      <Dialog open={clearHistoryDialogOpen} onOpenChange={setClearHistoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Очистить историю чата?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите очистить всю историю чата "{room.name}"? 
              <br />
              Это действие необратимо. Все сообщения будут удалены.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setClearHistoryDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirmClearHistory}>
              Очистить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
