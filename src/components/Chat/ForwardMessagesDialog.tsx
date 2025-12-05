import React, { useState, useEffect } from 'react';
import { Room, Message, roomsAPI, messagesAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from '../ui/sonner';
import { Search, ArrowRight, Check } from '../ui/icons';
import { useSessionCrypto } from '../../contexts/SessionCryptoContext';
import { encryptMessageContent, decryptMessageContent } from '../../utils/messageEncryption';

interface ForwardMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  onForwardComplete?: () => void;
}

export function ForwardMessagesDialog({ 
  open, 
  onOpenChange, 
  messages,
  onForwardComplete 
}: ForwardMessagesDialogProps) {
  const { user } = useAuth();
  const sessionCrypto = useSessionCrypto();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [decryptedPreviews, setDecryptedPreviews] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open) {
      loadRooms();
    }
  }, [open]);

  // Расшифровка превью сообщений
  useEffect(() => {
    if (!sessionCrypto.isReady || rooms.length === 0) {
      return;
    }

    const decryptPreviews = async () => {
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
            try {
              const decrypted = await decryptMessageContent(originalContent, sessionCrypto);
              previewMap.set(room.id, decrypted);
            } catch (error) {
              // Если не удалось расшифровать, показываем оригинал
              previewMap.set(room.id, originalContent);
            }
          } catch (error) {
            // В случае ошибки используем оригинальный контент
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
      setLoading(true);
      const data = await roomsAPI.getAll();
      // Фильтруем комнаты: показываем только те, в которые можно переслать
      // Исключаем комнаты "Избранное" и системные комнаты
      const availableRooms = data.rooms.filter((room: Room) => 
        !room.is_favorites && 
        !room.deleted &&
        room.name !== '🔒 Азкабан' &&
        (room.type === 'public' || room.members.includes(user?.id || ''))
      );
      setRooms(availableRooms);
    } catch (error: any) {
      console.error('Ошибка загрузки комнат:', error);
      toast.error('Не удалось загрузить список чатов');
    } finally {
      setLoading(false);
    }
  };

  const toggleRoomSelection = (roomId: string) => {
    const newSelection = new Set(selectedRooms);
    if (newSelection.has(roomId)) {
      newSelection.delete(roomId);
    } else {
      newSelection.add(roomId);
    }
    setSelectedRooms(newSelection);
  };

  const handleForward = async () => {
    if (selectedRooms.size === 0) {
      toast.error('Выберите хотя бы один чат');
      return;
    }

    if (messages.length === 0) {
      toast.error('Нет сообщений для пересылки');
      return;
    }

    try {
      setForwarding(true);
      
      // Пересылаем каждое сообщение в каждый выбранный чат
      for (const roomId of selectedRooms) {
        for (const message of messages) {
          try {
            // Расшифровываем сообщение для пересылки
            let content = message.content;
            if (message.type === 'text' || message.type === 'poll') {
              try {
                content = await decryptMessageContent(message.content, sessionCrypto, message);
                // Шифруем заново для нового чата
                content = await encryptMessageContent(content, sessionCrypto);
              } catch (error) {
                console.error('Ошибка расшифровки/шифрования при пересылке:', error);
                // Если не удалось расшифровать, отправляем как есть (может быть незашифрованное)
              }
            }
            
            // Для медиа-файлов используем оригинальный URL
            if (message.type === 'video' || message.type === 'voice' || message.type === 'audio') {
              content = message.content;
            }

            // Отправляем сообщение в новый чат
            await messagesAPI.send(
              roomId,
              content,
              message.type,
              undefined
            );
          } catch (error: any) {
            console.error(`Ошибка пересылки сообщения ${message.id} в комнату ${roomId}:`, error);
          }
        }
      }

      toast.success(`Сообщения пересланы в ${selectedRooms.size} ${selectedRooms.size === 1 ? 'чат' : 'чата'}`);
      setSelectedRooms(new Set());
      setSearchQuery('');
      onOpenChange(false);
      if (onForwardComplete) {
        onForwardComplete();
      }
    } catch (error: any) {
      console.error('Ошибка пересылки:', error);
      toast.error('Не удалось переслать сообщения');
    } finally {
      setForwarding(false);
    }
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Переслать {messages.length} {messages.length === 1 ? 'сообщение' : 'сообщений'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Поиск */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск чатов..."
              className="pl-10"
            />
          </div>

          {/* Список чатов */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Чаты не найдены' : 'Нет доступных чатов'}
              </div>
            ) : (
              filteredRooms.map((room) => (
                <Card
                  key={room.id}
                  className={`cursor-pointer transition-all hover:bg-accent ${
                    selectedRooms.has(room.id) ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => toggleRoomSelection(room.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{room.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {room.type === 'public' ? 'Публичный' : 'Приватный'}
                        </Badge>
                      </div>
                      {room.last_message && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {room.last_message.sender_username}: {(
                            decryptedPreviews.get(room.id) || room.last_message.content
                          ).substring(0, 50)}
                        </p>
                      )}
                    </div>
                    {selectedRooms.has(room.id) && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Кнопки */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setSelectedRooms(new Set());
                setSearchQuery('');
              }}
              disabled={forwarding}
            >
              Отмена
            </Button>
            <Button
              onClick={handleForward}
              disabled={selectedRooms.size === 0 || forwarding}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Переслать в {selectedRooms.size} {selectedRooms.size === 1 ? 'чат' : 'чата'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

