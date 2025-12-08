import React, { useState, useEffect, useRef } from 'react';
import { Room, Message, messagesAPI, roomsAPI, User, usersAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionCrypto } from '../../contexts/SessionCryptoContext';
import { useAchievements } from '../../contexts/AchievementsContext';
import { encryptMessageContent, decryptMessageContent } from '../../utils/messageEncryption';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { MembersModal } from './MembersModal';
import { RoomManagement } from './RoomManagement';
import { ForwardMessagesDialog } from './ForwardMessagesDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { toast } from '../ui/sonner';
import { ArrowLeft, Search, Users, Settings, UserPlus, Pin, MoreVertical, LogOut, ArrowDown, AtSign, Heart, MessageCircle } from '../ui/icons';

interface ChatRoomProps {
  room: Room;
  onBack: () => void;
  onUserClick?: (userId: string) => void;
  onOpenFriends?: () => void;
}

export function ChatRoom({ room, onBack, onUserClick: onUserClickProp, onOpenFriends }: ChatRoomProps) {
  const { user, godModeEnabled } = useAuth();
  const { tracker } = useAchievements();
  const sessionCrypto = useSessionCrypto();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room>(room);
  const [showUserProfile, setShowUserProfile] = useState<string | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<User[]>([]);
  const [showRoomManagement, setShowRoomManagement] = useState(false);
  const [showRoomOptions, setShowRoomOptions] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadMentions, setUnreadMentions] = useState(0);
  const [unreadReactions, setUnreadReactions] = useState(0);
  const [dmOtherUser, setDmOtherUser] = useState<User | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [showNewMessagesDivider, setShowNewMessagesDivider] = useState(false);

  const handleForwardMessages = (message: Message) => {
    setForwardingMessage(message);
    setShowForwardDialog(true);
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const canModerate = user && ['admin', 'moderator'].includes(user.role);
  const isCreator = room.created_by === user?.id;

  useEffect(() => {
    // Инициализируем счетчики меншенов и реакций из данных комнаты
    if (user && room.unread_mentions) {
      setUnreadMentions(room.unread_mentions[user.id] || 0);
    }
    if (user && room.unread_reactions) {
      setUnreadReactions(room.unread_reactions[user.id] || 0);
    }
    
    loadMessages();
    updateUnreadCounts();
    
    // Загружаем информацию о собеседнике для DM
    if (room.type === 'dm' && room.dm_participants && user) {
      const otherId = room.dm_participants.find(id => id !== user.id);
      if (otherId) {
        usersAPI.getById(otherId).then(data => setDmOtherUser(data.user)).catch(console.error);
      }
    }
    
    // Real-time обновление сообщений - как в Telegram (3 секунды)
    const interval = setInterval(() => {
      loadMessages();
      updateUnreadCounts();
    }, 3000); // Real-time: обновление каждые 3 секунды
    return () => clearInterval(interval);
  }, [room.id, room.unread_mentions, room.unread_reactions, user]);

  // Обновление счетчиков упоминаний и реакций
  const updateUnreadCounts = async () => {
    try {
      const data = await roomsAPI.getAll();
      const currentRoomData = data.rooms.find((r: Room) => r.id === room.id);
      if (currentRoomData && user) {
        setUnreadMentions(currentRoomData.unread_mentions?.[user.id] || 0);
        setUnreadReactions(currentRoomData.unread_reactions?.[user.id] || 0);
        setCurrentRoom(currentRoomData);
      }
    } catch (error) {
      console.error('Failed to update unread counts:', error);
    }
  };

  // Отслеживание скролла для показа кнопки
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      setShowScrollButton(!isNearBottom);
      
      // Скрываем разделитель "Новые сообщения" при скролле вниз
      if (showNewMessagesDivider && lastReadMessageId) {
        const lastReadElement = document.getElementById(`message-${lastReadMessageId}`);
        if (lastReadElement) {
          const containerRect = container.getBoundingClientRect();
          const messageRect = lastReadElement.getBoundingClientRect();
          // Если последнее прочитанное сообщение прокручено выше видимой области, скрываем разделитель
          if (messageRect.bottom < containerRect.top) {
            setShowNewMessagesDivider(false);
          }
        } else {
          // Если элемент не найден (возможно, отфильтрован), скрываем разделитель
          setShowNewMessagesDivider(false);
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [showNewMessagesDivider, lastReadMessageId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadRoomMembers = async () => {
    try {
      const memberPromises = room.members.map((memberId: string) => usersAPI.getById(memberId));
      const memberData = await Promise.all(memberPromises);
      const members = memberData.map((data) => data.user).filter(Boolean);
      setRoomMembers(members);
    } catch (error) {
      console.error('Failed to load room members:', error);
    }
  };

  const loadMessages = async (retryCount = 0) => {
    try {
      const data = await messagesAPI.get(room.id, 100, godModeEnabled);
      // Фильтруем null и undefined сообщения
      const newMessages = data.messages.filter((msg: Message | null) => msg !== null && msg !== undefined);
      
      // Проверяем новые упоминания
      if (messages.length > 0 && user) {
        const latestMessageId = messages[messages.length - 1]?.id;
        const newMessagesAfterLatest = newMessages.filter(
          (msg: Message) => msg && msg.created_at > (messages[messages.length - 1]?.created_at || '')
        );
        
        newMessagesAfterLatest.forEach((msg: Message) => {
          if (msg && msg.mentions?.includes(user.id) && msg.sender_id !== user.id) {
            const senderName = msg.sender_display_name || msg.sender_username;
            toast.info(`${senderName} упомянул вас`, {
              description: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : ''),
            });
          }
        });
      }
      
      // Сохраняем позицию скролла перед обновлением
      const container = messagesContainerRef.current;
      const wasAtBottom = container ? 
        container.scrollHeight - container.scrollTop - container.clientHeight < 150 : false;
      
      // Обновляем только если есть изменения (оптимизированная проверка)
      const messagesChanged = messages.length !== newMessages.length || 
        (newMessages.length > 0 && messages.length > 0 && 
         (messages[messages.length - 1]?.id !== newMessages[newMessages.length - 1]?.id ||
          messages[messages.length - 1]?.updated_at !== newMessages[newMessages.length - 1]?.updated_at));
      if (messagesChanged) {
        setMessages(newMessages);
        
        // Если были внизу, плавно прокручиваем к новым сообщениям
        if (wasAtBottom && container) {
          // Используем requestAnimationFrame для плавной прокрутки
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
          });
        }
      }
      
      // Успешная загрузка - отключаем loading
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      
      // Если ошибка "не являетесь участником" и это первая попытка, попробуем еще раз через секунду
      if (retryCount === 0 && error.message?.includes('участником')) {
        console.log('Retrying message load after 1 second...');
        setTimeout(() => loadMessages(1), 1000);
        // Не устанавливаем loading в false при retry
        return;
      }
      
      // После всех попыток или других ошибок - отключаем loading
      setLoading(false);
    }
  };

  const handleSendMessage = async (content: string, type: Message['type'], replyTo?: string, editingMessageId?: string) => {
    try {
      // Если редактируем сообщение
      if (editingMessageId) {
        // Шифруем отредактированное сообщение
        const encryptedContent = await encryptMessageContent(content, sessionCrypto);
        await messagesAPI.edit(editingMessageId, encryptedContent);
        setEditingMessage(null);
        // Обновляем сообщения после редактирования
        loadMessages();
        return;
      }

      // Шифрование (не блокируем отправку, если не готово - используется базовое шифрование)
      let encryptedContent: string;

      // Опросы не шифруются, так как их нужно парсить на сервере
      if (type === 'poll') {
        encryptedContent = content;
      } else {
        // Шифруем сообщение перед отправкой в базу
        encryptedContent = await encryptMessageContent(content, sessionCrypto);
        console.log('SessionCrypto: Message encrypted for database');
      }
      
      // Отправляем сообщение (зашифрованное или опрос)
      await messagesAPI.send(room.id, encryptedContent, type, replyTo);
      setReplyingTo(null);
      
      // Трекинг достижений
      if (tracker) {
        // Первое сообщение (общее)
        tracker.checkFirstMessage();
        
        // Общее количество сообщений
        tracker.checkTotalMessages();
        
        // Ночное сообщение
        tracker.checkNightMessage();
        
        // Скорострел (10 сообщений за 15 секунд)
        tracker.checkSpeedShooter();
        
        // Новогоднее чудо
        tracker.checkNewYearMessage();
        
        // Ежедневная активность
        tracker.checkDailyActivity();
        
        // Проверка на парадокс
        tracker.checkParadoxMessage(content, new Date().toISOString());
        
        // Проверка упоминаний (5+ человек в одном сообщении)
        tracker.checkMentions(content);
        
        // Голосовое сообщение
        if (type === 'voice') {
          tracker.checkVoiceMessage();
        }
        
        // Фото
        if (type === 'image') {
          tracker.checkPhotoSent();
        }
        
        // Файл
        if (type === 'file') {
          tracker.checkFileSent();
        }
        
        // Видео кружочек
        if (type === 'video') {
          tracker.checkVideoCircleSent();
        }
        
        // Ответ на сообщение
        if (replyTo) {
          tracker.checkReply();
        }
      }
      
      // Обновляем сообщения и прокручиваем вниз
      await loadMessages();
      setTimeout(scrollToBottom, 100);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отправки сообщения');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await messagesAPI.delete(messageId);
      // Немедленно обновляем список сообщений
      await loadMessages();
    } catch (error: any) {
      console.error('Ошибка удаления:', error);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      await roomsAPI.pinMessage(room.id, messageId);
      const roomsData = await roomsAPI.getAll();
      const updatedRoom = roomsData.rooms.find((r: Room) => r.id === room.id);
      if (updatedRoom) {
        setCurrentRoom(updatedRoom);
      }
    } catch (error: any) {
      console.error('Ошибка закрепления:', error);
    }
  };

  const handleUnpinMessage = async () => {
    try {
      await roomsAPI.unpinMessage(room.id);
      const roomsData = await roomsAPI.getAll();
      const updatedRoom = roomsData.rooms.find((r: Room) => r.id === room.id);
      if (updatedRoom) {
        setCurrentRoom(updatedRoom);
      }
    } catch (error: any) {
      console.error('Ошибка открепления:', error);
    }
  };

  const handleSearchUsers = async () => {
    if (!inviteQuery.trim()) return;

    try {
      const data = await usersAPI.search(inviteQuery);
      setSearchResults(data.users);
    } catch (error: any) {
      console.error('Ошибка поиска:', error);
    }
  };

  const handleInviteUser = async (userId: string) => {
    try {
      await roomsAPI.invite(room.id, userId);
      setShowInvite(false);
      setInviteQuery('');
      setSearchResults([]);
    } catch (error: any) {
      console.error('Ошибка приглашения:', error);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      // Проверяем, это Азкабан и пользователь забанен
      const isAzkaban = room.name === '🔒 Азкабан';
      if (isAzkaban && user?.banned) {
        toast.error('Забаненные пользователи не могут покинуть Азкабан');
        return;
      }
      
      await roomsAPI.leave(room.id);
      onBack();
    } catch (error: any) {
      console.error('Ошибка выхода:', error);
      toast.error(error.message || 'Не удалось покинуть комнату');
    }
  };

  const handleUserClick = (userId: string) => {
    if (onUserClickProp) {
      onUserClickProp(userId);
    }
  };

  // Прокрутка к следующему упоминанию
  const scrollToNextMention = async () => {
    if (!user) return;
    
    const mentionedMessages = messages.filter(m => 
      m && m.mentions && m.mentions.includes(user.id) && m.sender_id !== user.id
    );
    
    if (mentionedMessages.length > 0) {
      const firstMention = mentionedMessages[0];
      const element = document.getElementById(`message-${firstMention.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlight-message');
        setTimeout(() => element.classList.remove('highlight-message'), 2000);
      }
    } else {
      toast.info('Нет новых упоминаний');
    }

    // Сбрасываем счетчик упоминаний (кроме режима Глаз Бога)
    if (!room.isGodMode) {
      try {
        await roomsAPI.markAsRead(room.id, true, false);
        setUnreadMentions(0);
      } catch (error: any) {
        console.error('Ошибка при отметке упоминаний как прочитанных:', error);
      }
    }
  };

  // Прокрутка к сообщениям с реакциями
  const scrollToNextReaction = async () => {
    const reactedMessages = messages.filter(m => 
      m.sender_id === user!.id && 
      m.reactions && 
      Object.values(m.reactions).some(userIds => userIds.length > 0)
    );
    
    if (reactedMessages.length > 0) {
      const firstReaction = reactedMessages[reactedMessages.length - 1]; // Последнее сообщение с реакциями
      const element = document.getElementById(`message-${firstReaction.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlight-message');
        setTimeout(() => element.classList.remove('highlight-message'), 2000);
      }
    }

    // Сбрасываем счетчик реакций (кроме режима Глаз Бога)
    if (!room.isGodMode) {
      await roomsAPI.markAsRead(room.id, false, true);
      setUnreadReactions(0);
    }
  };

  // Отметить все как прочитанное при входе и прокрутить к последнему прочитанному сообщению
  useEffect(() => {
    const markAsReadOnEnter = async () => {
      if (user && !room.isGodMode && messages.length > 0) {
        // Находим последнее прочитанное сообщение
        const lastReadTime = room.last_read?.[user.id] ? new Date(room.last_read[user.id]).getTime() : 0;
        
        // Находим последнее прочитанное сообщение (последнее сообщение до непрочитанных)
        let lastReadMessage: Message | null = null;
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          const msgTime = new Date(msg.created_at).getTime();
          // Ищем последнее сообщение, которое было прочитано (время <= lastReadTime)
          // И которое не от текущего пользователя (чтобы не считать свои сообщения как прочитанные)
          if (msgTime <= lastReadTime && msg.sender_id !== user.id) {
            lastReadMessage = msg;
            break;
          }
        }
        
        // Если не нашли прочитанное сообщение от других пользователей, ищем любое последнее прочитанное
        if (!lastReadMessage) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const msgTime = new Date(msg.created_at).getTime();
            if (msgTime <= lastReadTime) {
              lastReadMessage = msg;
              break;
            }
          }
        }
        
        if (lastReadMessage) {
          setLastReadMessageId(lastReadMessage.id);
          setShowNewMessagesDivider(true);
          
          // Прокручиваем к последнему прочитанному сообщению
          setTimeout(() => {
            const messageElement = document.getElementById(`message-${lastReadMessage!.id}`);
            if (messageElement) {
              messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              // Если элемент еще не загружен, прокручиваем вниз
              scrollToBottom();
            }
          }, 300);
        } else {
          // Если нет прочитанных сообщений, прокручиваем вниз
          setLastReadMessageId(null);
          setShowNewMessagesDivider(false);
          setTimeout(() => scrollToBottom(), 300);
        }
        
        // НЕ сбрасываем счетчики упоминаний при входе - они должны оставаться до явного просмотра
        // await roomsAPI.markAsRead(room.id, false, false);
      } else {
        // В режиме Глаз Бога просто прокручиваем вниз
        setLastReadMessageId(null);
        setShowNewMessagesDivider(false);
        setTimeout(() => scrollToBottom(), 300);
      }
    };
    
    // Выполняем только после загрузки сообщений
    if (!loading && messages.length > 0) {
      markAsReadOnEnter();
    }
  }, [room.id, room.isGodMode, user, messages.length, loading, room.last_read]);

  const pinnedMessage = currentRoom.pinned_message_id
    ? messages.find(m => m.id === currentRoom.pinned_message_id)
    : null;
  
  const [pinnedMessageDecrypted, setPinnedMessageDecrypted] = useState<string | null>(null);
  
  // Расшифровка закрепленного сообщения
  useEffect(() => {
    const decryptPinned = async () => {
      if (!pinnedMessage) {
        setPinnedMessageDecrypted(null);
        return;
      }
      
      if (sessionCrypto && sessionCrypto.isReady) {
        try {
          const decrypted = await decryptMessageContent(pinnedMessage.content, sessionCrypto, pinnedMessage);
          setPinnedMessageDecrypted(decrypted);
        } catch (error) {
          console.error('SessionCrypto: Failed to decrypt pinned message:', error);
          setPinnedMessageDecrypted('[🔒 Не удалось расшифровать]');
        }
      } else {
        // Проверяем, зашифровано ли сообщение
        try {
          const parsed = JSON.parse(pinnedMessage.content);
          if (parsed && parsed.version && parsed.ciphertext) {
            setPinnedMessageDecrypted('[🔒 Зашифровано - ожидание ключей...]');
          } else {
            setPinnedMessageDecrypted(pinnedMessage.content);
          }
        } catch {
          setPinnedMessageDecrypted(pinnedMessage.content);
        }
      }
    };
    
    decryptPinned();
  }, [pinnedMessage, sessionCrypto]);

  const isMuted = user?.muted;
  const isBanned = user?.banned;
  const isAzkaban = room.name === '🔒 Азкабан';
  // В Азкабане забаненные могут писать, но мут действует
  const canSend = isAzkaban ? !isMuted : (!isMuted && !isBanned);
  const canLeaveRoom = !(isAzkaban && isBanned); // Нельзя покинуть Азкабан, если забанен

  // Показываем компонент управления комнатой, если он открыт
  if (showRoomManagement) {
    return <RoomManagement room={currentRoom} onBack={() => setShowRoomManagement(false)} />;
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-background/95 to-background/90">
      {/* Header - Sticky */}
      <div className="sticky top-0 z-30 border-b px-4 py-4 flex items-center justify-between bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            disabled={isAzkaban && isBanned}
            title={isAzkaban && isBanned ? 'Вы не можете покинуть Азкабан, пока забанены' : 'Назад'}
          >
            <ArrowLeft className="w-5 h-5 transition-transform duration-200 hover:-translate-x-0.5" />
          </Button>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              {room.type === 'dm' && dmOtherUser 
                ? ((dmOtherUser as any).display_name || dmOtherUser.username)
                : room.name}
              {room.isGodMode && (
                <Badge variant="secondary" className="text-xs animate-pulse">Режим наблюдения</Badge>
              )}
              {/* Отображение меншенов через '@' */}
              {unreadMentions > 0 && !room.isGodMode && (
                <Badge variant="default" className="bg-red-500 text-white border-2 border-red-600 flex items-center gap-1 text-xs">
                  <AtSign className="w-3 h-3" />
                  {unreadMentions}
                </Badge>
              )}
            </h2>
            {room.type === 'dm' ? (
              <p className="text-sm text-muted-foreground">
                Личные сообщения
              </p>
            ) : (
              <button
                onClick={() => {
                  loadRoomMembers();
                  setShowMembersModal(true);
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {room.members.length} участников • {room.type === 'public' ? 'Публичная' : 'Приватная'}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {room.type === 'private' && !room.isGodMode && (
            <Dialog open={showInvite} onOpenChange={setShowInvite}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <UserPlus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Пригласить пользователя</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={inviteQuery}
                      onChange={(e) => setInviteQuery(e.target.value)}
                      placeholder="Поиск пользователя..."
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                    />
                    <Button onClick={handleSearchUsers}>Найти</Button>
                  </div>

                  <div className="space-y-2">
                    {searchResults.map((searchUser) => (
                      <div
                        key={searchUser.id}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <div>
                          <p>{searchUser.username}</p>
                          <p className="text-sm text-muted-foreground">{searchUser.email}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleInviteUser(searchUser.id)}
                          disabled={room.members.includes(searchUser.id)}
                        >
                          {room.members.includes(searchUser.id) ? 'В комнате' : 'Пригласить'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="w-4 h-4" />
          </Button>

          {!room.isGodMode && (
            <Popover open={showRoomOptions} onOpenChange={setShowRoomOptions}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  {/* Меню для забаненных в Азкабане */}
                  {isAzkaban && isBanned && (
                    <>
                      {onOpenFriends && (
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => {
                            setShowRoomOptions(false);
                            if (onOpenFriends) onOpenFriends();
                          }}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Личные сообщения
                        </Button>
                      )}
                    </>
                  )}
                  
                  {/* Управление комнатой для модераторов (только не в Азкабане) */}
                  {(canModerate || isCreator) && !isAzkaban && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        setShowRoomOptions(false);
                        setShowRoomManagement(true);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Управление комнатой
                    </Button>
                  )}
                  
                  {/* Покинуть комнату (НЕ показываем в Азкабане для забаненных) */}
                  {canLeaveRoom && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setShowRoomOptions(false);
                        handleLeaveRoom();
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Покинуть чат
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Pinned Message - Sticky */}
      {pinnedMessage && (
        <div className="sticky top-[73px] z-20 border-b p-3 bg-yellow-50 dark:bg-yellow-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Pin className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">
                <span className="text-muted-foreground">{pinnedMessage.sender_display_name || pinnedMessage.sender_username}: </span>
                {(() => {
                  const messageType = pinnedMessage.type;
                  
                  // Проверка типа сообщения (приоритет)
                  if (messageType === 'video') {
                    return '🎥 Видео';
                  }
                  if (messageType === 'voice' || messageType === 'audio') {
                    return '🎤 Голосовое';
                  }
                  
                  // Используем расшифрованное содержимое
                  const content = pinnedMessageDecrypted || pinnedMessage.content;
                  
                  // Проверка на markdown изображение
                  if (content && content.startsWith('![') && content.includes('](')) {
                    return '🖼️ Изображение';
                  }
                  
                  // Проверка на URL медиа (любой хост)
                  if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
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
                  
                  // Обычный текст (расшифрованный)
                  if (content) {
                    return content.length > 50 ? content.substring(0, 50) + '...' : content;
                  }
                  
                  return '[🔒 Зашифровано]';
                })()}
              </p>
            </div>
          </div>
          {user && ['admin', 'moderator', 'vip'].includes(user.role) && (
            <Button variant="ghost" size="sm" onClick={handleUnpinMessage}>
              Открепить
            </Button>
          )}
        </div>
      )}

      {/* Search Bar - Sticky */}
      {showSearch && (
        <div className="sticky top-[73px] z-20 border-b px-4 py-3 bg-muted/60 backdrop-blur-md">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по сообщениям..."
            className="bg-background/80 border-border/60 focus-visible:ring-primary/60 transition-colors"
          />
        </div>
      )}

      {/* Messages Container with scroll button */}
      <div className="flex-1 relative">
        <div
          ref={messagesContainerRef}
          className="absolute inset-0 overflow-y-auto p-4 space-y-1 lg:space-y-1.5 bg-gradient-to-b from-background/40 via-background/70 to-background/95"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              Загрузка сообщений...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Нет сообщений. Начните общение!
            </div>
          ) : (
            <>
              {messages
                .filter(msg => msg !== null && msg !== undefined)
                .filter(msg =>
                  !searchQuery ||
                  msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  msg.sender_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (msg.sender_display_name && msg.sender_display_name.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .map((message, index) => {
                  const replyToMsg = message.reply_to 
                    ? messages.find(m => m && m.id === message.reply_to)
                    : null;
                  
                  // Показываем разделитель "Новые сообщения" ПЕРЕД первым непрочитанным сообщением
                  // Первое непрочитанное сообщение - это первое сообщение после lastReadMessageId
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const isFirstUnread = showNewMessagesDivider && 
                                       lastReadMessageId && 
                                       prevMessage?.id === lastReadMessageId;
                  
                  return (
                    <React.Fragment key={message.id}>
                      {isFirstUnread && (
                        <div className="sticky top-0 z-10 flex items-center gap-2 my-2 py-2 bg-background/95 backdrop-blur-sm border-y border-primary/30">
                          <div className="flex-1 h-px bg-primary/30"></div>
                          <span className="text-xs font-semibold text-primary px-3 py-1 bg-primary/10 rounded-full">
                            Новые сообщения
                          </span>
                          <div className="flex-1 h-px bg-primary/30"></div>
                        </div>
                      )}
                      <div
                        id={`message-${message.id}`}
                        className="animate-message-in transition-transform duration-200 ease-out hover:-translate-y-0.5"
                      >
                        <MessageBubble
                          message={message}
                          onReply={setReplyingTo}
                          onPin={handlePinMessage}
                          onDelete={handleDeleteMessage}
                          onUserClick={handleUserClick}
                          isPinned={message.id === currentRoom.pinned_message_id}
                          replyToMessage={replyToMsg}
                          onEdit={loadMessages}
                          onForward={handleForwardMessages}
                          onStartEdit={(msg) => {
                            setEditingMessage(msg);
                            setReplyingTo(null); // Отменяем ответ при начале редактирования
                          }}
                        />
                      </div>
                    </React.Fragment>
                  );
                })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
        {/* Кнопки управления - зафиксированы в правом нижнем углу контейнера */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
          {/* Кнопка упоминаний */}
          {unreadMentions > 0 && (
            <Button
              onClick={scrollToNextMention}
              size="icon"
              className="rounded-full shadow-lg hover:shadow-xl transition-shadow bg-destructive hover:bg-destructive/90"
              variant="default"
            >
              <AtSign className="w-5 h-5" />
              {unreadMentions > 1 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive-foreground text-destructive text-xs rounded-full flex items-center justify-center">
                  {unreadMentions}
                </span>
              )}
            </Button>
          )}
          
          {/* Кнопка реакций */}
          {unreadReactions > 0 && (
            <Button
              onClick={scrollToNextReaction}
              size="icon"
              className="rounded-full shadow-lg hover:shadow-xl transition-shadow bg-pink-500 hover:bg-pink-600"
              variant="default"
            >
              <Heart className="w-5 h-5" />
              {unreadReactions > 1 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-pink-500 text-xs rounded-full flex items-center justify-center">
                  {unreadReactions}
                </span>
              )}
            </Button>
          )}
          
          {/* Кнопка прокрутки вниз */}
          {showScrollButton && (
            <Button
              onClick={scrollToBottom}
              size="icon"
              className="rounded-full shadow-lg hover:shadow-xl transition-shadow bg-primary text-primary-foreground z-30"
              variant="default"
            >
              <ArrowDown className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Input - Закреплен внизу */}
      <div className="sticky bottom-0 z-20 bg-background border-t">
        {isBanned && !isAzkaban ? (
          <div className="p-4 bg-destructive/10 text-center">
            <p className="text-destructive">Вы заблокированы и находитесь в Азкабане</p>
          </div>
        ) : isMuted ? (
          <div className="p-4 bg-warning/10 text-center">
            <p className="text-warning">Вы в муте и не можете отправлять сообщения</p>
          </div>
        ) : (
          <MessageInput
            onSend={handleSendMessage}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            disabled={!canSend || room.isGodMode}
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
          />
        )}
      </div>

      {/* Members Modal */}
      <MembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        members={roomMembers}
        roomId={room.id}
        canModerate={canModerate || false}
        onUserClick={handleUserClick}
        godModeEnabled={godModeEnabled}
        currentUserId={user?.id}
      />

      {/* Диалог пересылки сообщений */}
      {forwardingMessage && (
        <ForwardMessagesDialog
          open={showForwardDialog}
          onOpenChange={setShowForwardDialog}
          messages={[forwardingMessage]}
          onForwardComplete={() => {
            setForwardingMessage(null);
            setSelectedMessages(new Set());
          }}
        />
      )}
    </div>
  );
}