import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Message, messagesAPI, roomsAPI, usersAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionCrypto } from '../../contexts/SessionCryptoContext';
import { decryptMessageContent, encryptMessageContent } from '../../utils/messageEncryption';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';
import { Dialog, DialogContent } from '../ui/dialog';
import { toast } from '../ui/sonner';
import { Smile, Reply, Pin, Trash2, Edit, MoreHorizontal, Copy, Star, RefreshCw, ArrowRight } from '../ui/icons';
import { quickFix } from '../../utils/keyboardLayout';
import { PollMessage } from './PollMessage';
import { SimpleAudioPlayer } from './SimpleAudioPlayer';
import { VideoPlayer } from './VideoPlayer';
import { fixMediaUrl } from '../../utils/urlFix';
import { CustomEmojiPicker } from './CustomEmojiPicker';

interface MessageBubbleProps {
  message: Message;
  onReply: (message: Message) => void;
  onPin: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onUserClick?: (userId: string) => void;
  isPinned: boolean;
  replyToMessage?: Message | null;
  onEdit?: () => void;
  onForward?: (message: Message) => void;
  onStartEdit?: (message: Message) => void;
}

export function MessageBubble({ 
  message, 
  onReply, 
  onPin, 
  onDelete, 
  onUserClick,
  isPinned,
  replyToMessage,
  onEdit,
  onForward,
  onStartEdit
}: MessageBubbleProps) {
  const { user } = useAuth();
  const sessionCrypto = useSessionCrypto();
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<string>(message.content);
  const [editedContent, setEditedContent] = useState(message.content);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [emojiModalPosition, setEmojiModalPosition] = useState({ x: 0, y: 0 });
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  
  // Расшифровка сообщения при загрузке
  useEffect(() => {
    const decryptMessage = async () => {
      // Для медиа-файлов (video, voice, audio) используем оригинальный content (URL не шифруется)
      if (message.type === 'video' || message.type === 'voice' || message.type === 'audio') {
        setDecryptedContent(message.content);
        setEditedContent(message.content);
        return;
      }
      
      // Расшифровываем сообщение при получении из базы
      try {
        const decrypted = await decryptMessageContent(message.content, sessionCrypto, message);
        setDecryptedContent(decrypted);
        setEditedContent(decrypted); // Также обновляем для редактирования
      } catch (error) {
        console.error('SessionCrypto: Failed to decrypt message:', error);
        // При ошибке показываем оригинал (может быть незашифрованное сообщение)
        setDecryptedContent(message.content);
      }
    };
    
    decryptMessage();
  }, [message.content, message.id, message.type, sessionCrypto]);
  
  const isOwnMessage = message.sender_id === user?.id;
  const canModerate = user && ['admin', 'moderator'].includes(user.role);
  const canPin = user && ['admin', 'moderator', 'vip'].includes(user.role);
  const isMentioned = message.mentions?.includes(user?.id || '');

  const handleReaction = async (emoji: string) => {
    if (!user) return;
    
    try {
      // Проверяем, есть ли уже реакция от текущего пользователя
      const currentReaction = message.reactions?.[emoji] || [];
      const isCurrentUserReacted = currentReaction.includes(user.id);
      
      if (isCurrentUserReacted) {
        // Убираем реакцию - как в Telegram, просто клик по уже поставленной реакции
        console.log('Removing reaction:', emoji, 'from message:', message.id);
        const result = await messagesAPI.removeReaction(message.id, emoji);
        console.log('Reaction removed successfully:', result);
      } else {
        // Добавляем реакцию
        console.log('Adding reaction:', emoji, 'to message:', message.id);
        const result = await messagesAPI.addReaction(message.id, emoji);
        console.log('Reaction added successfully:', result);
      }
      
      setShowEmojiPicker(false);
      // Немедленно обновляем сообщения - увеличиваем задержку для надежности
      if (onEdit) {
        setTimeout(() => {
          onEdit();
        }, 500);
      }
    } catch (error: any) {
      console.error('Ошибка добавления/удаления реакции:', error);
      // Не показываем ошибку для 404 - это нормально, если реакция уже удалена
      if (!error.message?.includes('404') && !error.message?.includes('не найдена')) {
        toast.error(error.message || 'Не удалось изменить реакцию');
      }
    }
  };

  const handleEdit = async () => {
    if (!editedContent.trim() || editedContent === decryptedContent) {
      setIsEditing(false);
      return;
    }

    try {
      // Шифруем отредактированное сообщение перед отправкой в базу
      const encryptedEditedContent = await encryptMessageContent(editedContent, sessionCrypto);
      
      await messagesAPI.edit(message.id, encryptedEditedContent);
      setIsEditing(false);
      // Немедленно обновляем сообщения
      if (onEdit) {
        onEdit();
      }
    } catch (error: any) {
      console.error('Ошибка редактирования:', error);
    }
  };

  const handleUserClick = () => {
    if (onUserClick) {
      onUserClick(message.sender_id);
    }
  };

  const handleAddToFavorites = async () => {
    try {
      // Получаем или создаем комнату избранного
      const favoritesRoom = await roomsAPI.getOrCreateFavorites();
      
      // Используем расшифрованный контент для избранного
      let favoritesContent = decryptedContent;
      
      // Если это медиафайл, сохраняем URL (не шифруем)
      if (message.type === 'video' || message.type === 'voice' || message.type === 'audio') {
        favoritesContent = message.content; // Медиа-файлы не шифруются
      } else if (message.content.startsWith('![') && message.content.includes('](')) {
        // Если это markdown изображение, сохраняем как есть (не шифруем)
        favoritesContent = message.content;
      } else {
        // Шифруем текстовый контент перед отправкой в базу
        favoritesContent = await encryptMessageContent(decryptedContent, sessionCrypto);
      }
      
      // Отправляем сообщение в избранное
      await messagesAPI.send(
        favoritesRoom.id,
        favoritesContent,
        message.type,
        undefined
      );
      
      toast.success('Сообщение добавлено в избранное');
      setShowEmojiPicker(false);
    } catch (error: any) {
      console.error('Ошибка добавления в избранное:', error);
      toast.error(error.message || 'Не удалось добавить в избранное');
    }
  };

  const handleQuickFix = async () => {
    try {
      // Применяем быстрое исправление к расшифрованному контенту
      const fixedContent = quickFix(decryptedContent);
      
      if (fixedContent === decryptedContent) {
        toast.info('Текст не требует исправления');
        setShowEmojiPicker(false);
        return;
      }

      // Обновляем отредактированный контент
      setEditedContent(fixedContent);
      
      // Шифруем исправленное сообщение перед отправкой в базу
      const encryptedFixedContent = await encryptMessageContent(fixedContent, sessionCrypto);
      
      // Отправляем исправленное сообщение
      await messagesAPI.edit(message.id, encryptedFixedContent);
      
      // Обновляем локальное состояние
      setDecryptedContent(fixedContent);
      setEditedContent(fixedContent);
      
      toast.success('Сообщение исправлено');
      setShowEmojiPicker(false);
      
      // Немедленно обновляем сообщения
      if (onEdit) {
        onEdit();
      }
    } catch (error: any) {
      console.error('Ошибка быстрого исправления:', error);
      toast.error(error.message || 'Не удалось исправить сообщение');
    }
  };

  // Обработчики long press - только на самом сообщении
  const handleTouchStart = (e: React.TouchEvent) => {
    // Останавливаем всплытие, чтобы не вызывать меню на других элементах
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      const safePos = getSafeMenuPosition(touch.clientX, touch.clientY, rect);
      setMenuPosition(safePos);
      setShowEmojiPicker(true);
    }, 500);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Останавливаем всплытие, чтобы не вызывать меню на других элементах
    e.stopPropagation();
    if (e.button === 0) { // Левая кнопка мыши
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      longPressTimer.current = setTimeout(() => {
        const safePos = getSafeMenuPosition(e.clientX, e.clientY, rect);
        setMenuPosition(safePos);
        setShowEmojiPicker(true);
      }, 500);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Функция для безопасного позиционирования меню - всегда в поле видимости чата
  const getSafeMenuPosition = (x: number, y: number, elementRect?: DOMRect) => {
    const menuWidth = 256; // w-64 = 16rem = 256px
    const menuHeight = 400; // примерная высота меню
    const padding = 16; // отступ от края экрана
    const chatContainer = document.querySelector('[class*="flex-1"]') || document.body;
    const containerRect = chatContainer.getBoundingClientRect();

    let safeX = x;
    let safeY = y;

    // Если меню должно открываться вверх (над точкой клика)
    const openUp = y - menuHeight > containerRect.top + padding;
    
    if (openUp) {
      // Открываем вверх
      safeY = y;
      // Проверяем верхнюю границу контейнера
      if (safeY - menuHeight < containerRect.top + padding) {
        safeY = containerRect.top + menuHeight + padding;
      }
    } else {
      // Открываем вниз
      safeY = y + 20; // Небольшой отступ от точки клика
      // Проверяем нижнюю границу контейнера
      if (safeY + menuHeight > containerRect.bottom - padding) {
        safeY = containerRect.bottom - menuHeight - padding;
        // Если не помещается вниз, открываем вверх
        if (safeY < containerRect.top + padding) {
          safeY = y - 20;
        }
      }
    }

    // Проверяем правую границу контейнера
    if (safeX + menuWidth / 2 > containerRect.right - padding) {
      safeX = containerRect.right - menuWidth / 2 - padding;
    }
    // Проверяем левую границу контейнера
    if (safeX - menuWidth / 2 < containerRect.left + padding) {
      safeX = containerRect.left + menuWidth / 2 + padding;
    }

    return { x: safeX, y: safeY };
  };

  // Обработчик правого клика - только на самом сообщении
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const safePos = getSafeMenuPosition(e.clientX, e.clientY, rect);
    setMenuPosition(safePos);
    setShowEmojiPicker(true);
  };

  // Очистка таймера
  React.useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleCopyMessage = async () => {
    try {
      // Копируем расшифрованное содержимое
      await navigator.clipboard.writeText(decryptedContent);
      setShowEmojiPicker(false);
      toast.success('Сообщение скопировано');
    } catch (error) {
      console.error('Не удалось скопировать сообщение:', error);
      toast.error('Не удалось скопировать сообщение');
    }
  };

  // Функция для рендеринга контента с изображениями и упоминаниями
  const renderContent = (content: string) => {
    // Проверяем, является ли это изображением в формате markdown
    const imageRegex = /^!\[.*?\]\((https?:\/\/[^\s)]+)\)$/;
    const imageMatch = content.match(imageRegex);
    
    if (imageMatch) {
      const imageUrl = imageMatch[1];
      const fixedImageUrl = fixMediaUrl(imageUrl);
      return (
        <img 
          src={fixedImageUrl} 
          alt="Изображение" 
          className="max-w-full max-h-96 rounded-lg cursor-pointer object-contain"
          onClick={() => window.open(fixedImageUrl, '_blank')}
          loading="lazy"
          onError={(e) => {
            console.error('Image load error:', e, 'URL:', fixedImageUrl);
          }}
        />
      );
    }

    // Проверяем встроенные изображения
    const inlineImageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    const hasInlineImages = content.match(inlineImageRegex);
    
    if (hasInlineImages) {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      const regex = new RegExp(inlineImageRegex);
      
      while ((match = regex.exec(content)) !== null) {
        // Добавляем текст перед изображением
        if (match.index > lastIndex) {
          const textBefore = content.substring(lastIndex, match.index);
          parts.push(
            <span key={`text-${lastIndex}`}>
              {renderContentWithMentions(textBefore)}
            </span>
          );
        }
        
        // Добавляем изображение
        const imageUrl = match[1];
        const fixedImageUrl = fixMediaUrl(imageUrl);
        parts.push(
          <img 
            key={`img-${match.index}`}
            src={fixedImageUrl} 
            alt="Изображение" 
            className="max-w-full max-h-96 rounded-lg cursor-pointer object-contain my-2"
            onClick={() => window.open(fixedImageUrl, '_blank')}
            loading="lazy"
            onError={(e) => {
              console.error('Image load error:', e, 'URL:', fixedImageUrl);
            }}
          />
        );
        
        lastIndex = regex.lastIndex;
      }
      
      // Добавляем оставшийся текст
      if (lastIndex < content.length) {
        const textAfter = content.substring(lastIndex);
        parts.push(
          <span key={`text-${lastIndex}`}>
            {renderContentWithMentions(textAfter)}
          </span>
        );
      }
      
      return <>{parts}</>;
    }
    
    // Обычный текст с упоминаниями
    return renderContentWithMentions(content);
  };

  // Функция для подсветки упоминаний в тексте
  const renderContentWithMentions = (content: string) => {
    const mentionRegex = /(@\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (part.match(mentionRegex)) {
        const username = part.substring(1);
        const isCurrentUser = user?.username && username.toLowerCase() === user.username.toLowerCase();
        
        return (
          <span 
            key={index} 
            className={`${isCurrentUser ? 'bg-yellow-200 dark:bg-yellow-900 px-1 rounded font-semibold' : 'text-yellow-500 dark:text-yellow-400 font-semibold'}`}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Расширенный список эмодзи для реакций (как в Telegram)
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🙏', '🤔', '😍', '🤯', '😱', '😴', '🤮', '💯', '🎉', '🤝', '👎'];

  // Сообщение состоит только из эмодзи (для красивого отображения)
  const isEmojiOnly = useMemo(() => {
    const text = decryptedContent.trim();
    if (!text) return false;
    // Простая эвристика: немного символов и только emoji/пробелы
    if (text.length > 8) return false;
    const emojiRegex = /\p{Extended_Pictographic}/u;
    // Должна быть хотя бы одна emoji
    if (!emojiRegex.test(text)) return false;
    // И не должно быть букв/цифр
    const nonEmojiRegex = /[a-zA-Zа-яА-Я0-9]/u;
    if (nonEmojiRegex.test(text)) return false;
    return true;
  }, [decryptedContent]);

  const [reactionDetails, setReactionDetails] = useState<{ emoji: string; userIds: string[]; position?: { x: number; y: number } } | null>(null);
  const [reactionUsers, setReactionUsers] = useState<Array<{ id: string; username: string; display_name?: string }>>([]);
  const messageBubbleRef = useRef<HTMLDivElement>(null);

  // Загружаем информацию о пользователях при открытии reactionDetails
  useEffect(() => {
    if (reactionDetails && reactionDetails.userIds.length > 0) {
      const loadUsers = async () => {
        try {
          const users = await Promise.all(
            reactionDetails.userIds.map(async (userId) => {
              try {
                const response = await usersAPI.getById(userId);
                // API возвращает { user: {...} }
                const user = response.user || response;
                if (!user || !user.username) {
                  console.warn('User data incomplete for userId:', userId, response);
                  return {
                    id: userId,
                    username: 'Неизвестный',
                    display_name: undefined,
                  };
                }
                return {
                  id: userId,
                  username: user.username,
                  display_name: user.display_name,
                };
              } catch (error: any) {
                console.error('Error loading user:', userId, error);
                return {
                  id: userId,
                  username: 'Неизвестный',
                  display_name: undefined,
                };
              }
            })
          );
          setReactionUsers(users.filter(u => u.username !== 'Неизвестный' || u.id === user?.id));
        } catch (error) {
          console.error('Ошибка загрузки пользователей:', error);
          setReactionUsers([]);
        }
      };
      loadUsers();
    } else {
      setReactionUsers([]);
    }
  }, [reactionDetails, user?.id]);

  // Мемоизированные значения для оптимизации
  const displayName = useMemo(() => {
    return message.sender_display_name || message.sender_username;
  }, [message.sender_display_name, message.sender_username]);

  const initials = useMemo(() => {
    return displayName.charAt(0).toUpperCase();
  }, [displayName]);

  return (
    <div
      id={`message-${message.id}`}
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4 group relative`}
    >
      <div 
        className={`flex gap-2 max-w-[75%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} relative`}
      >
        {/* Avatar - показываем для всех сообщений */}
        <Avatar 
          className="w-8 h-8 cursor-pointer flex-shrink-0" 
          onClick={handleUserClick}
        >
          {message.sender_avatar ? (
            <AvatarImage src={fixMediaUrl(message.sender_avatar)} alt={displayName} />
          ) : (
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>

        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
          {/* Sender name - показываем для всех */}
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="text-sm cursor-pointer hover:underline"
              onClick={handleUserClick}
            >
              {isOwnMessage ? 'Вы' : displayName}
            </span>
            {isMentioned && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 dark:bg-yellow-900">
                упоминание
              </Badge>
            )}
          </div>

          {/* Reply preview */}
          {replyToMessage && (
            <div className="text-xs bg-muted/70 rounded px-2 py-1.5 mb-1 max-w-full border-l-2 border-primary/50">
              <span className="text-muted-foreground block">
                Ответ на {replyToMessage.sender_display_name || replyToMessage.sender_username}
              </span>
              <span className="text-foreground/80 line-clamp-1">
                {(() => {
                  // Расшифровываем контент ответа для превью
                  try {
                    // Для превью ответа показываем оригинальный контент (расшифровка произойдет при необходимости)
                    return replyToMessage.content.substring(0, 50) + (replyToMessage.content.length > 50 ? '...' : '');
                  } catch {
                    return '[🔒 Зашифровано]';
                  }
                })()}
              </span>
            </div>
          )}

          {/* Message bubble - обработчики long press только здесь */}
          <div
            ref={messageBubbleRef}
            className={`relative overflow-hidden ${
              message.type === 'video' ? 'p-0 rounded-2xl' : 'rounded-2xl px-4 py-2'
            } ${
              message.type === 'video'
                ? ''
                : isOwnMessage
                  ? 'shadow-lg'
                  : 'bg-muted/90 border border-border/70 shadow-sm text-foreground'
            } ${isPinned ? 'ring-2 ring-yellow-500' : ''} ${
              isMentioned && !isOwnMessage ? 'ring-2 ring-yellow-300 dark:ring-yellow-700' : ''
            } transition-transform duration-200 ease-out group-hover:-translate-y-0.5`}
            style={
              message.type !== 'video' && isOwnMessage
                ? { backgroundColor: 'var(--primary)', color: '#000000' }
                : undefined
            }
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onContextMenu={handleContextMenu}
          >
            {isPinned && (
              <div className="flex items-center gap-1 text-xs mb-1 opacity-70">
                <Pin className="w-3 h-3" />
                Закреплено
              </div>
            )}
            
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleEdit();
                    } else if (e.key === 'Escape') {
                      setIsEditing(false);
                      setEditedContent(decryptedContent);
                    }
                  }}
                  className="text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEdit}>Сохранить</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setIsEditing(false);
                    setEditedContent(decryptedContent);
                  }}>Отмена</Button>
                </div>
              </div>
            ) : (
              <>
                {/* Опросы */}
                {message.type === 'poll' ? (
                  <PollMessage 
                    content={message.content} 
                    pollId={message.id}
                    onVote={() => {
                      // Обновление произойдет автоматически через интервал в ChatRoom
                    }}
                  />
                ) : message.type === 'voice' ? (
                  <SimpleAudioPlayer src={fixMediaUrl(message.content)} />
                ) : message.type === 'video' ? (
                  <div className="space-y-2">
                    <p className="text-sm opacity-70">🎥 Видео</p>
                    <VideoPlayer src={fixMediaUrl(message.content)} />
                  </div>
                ) : isEmojiOnly ? (
                  <div className="whitespace-pre-wrap break-words text-4xl md:text-5xl leading-none animate-emoji-pop">
                    {decryptedContent}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">
                    {renderContent(decryptedContent)}
                  </div>
                )}
                <div className="text-[6px] mt-1 text-foreground/60">
                  {new Date(message.created_at).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {message.edited && <span className="ml-1">(изменено)</span>}
                </div>
              </>
            )}
          </div>

          {/* Reactions */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(message.reactions).map(([emoji, userIds]) => {
                const isCurrentUserReacted = userIds.includes(user?.id || '');
                return (
                <Badge
                  key={emoji}
                  variant="secondary"
                  className={`text-xs cursor-pointer hover:bg-accent transition-transform duration-150 hover:scale-110 ${
                    isCurrentUserReacted ? 'border border-primary/60 bg-primary/5' : ''
                  } animate-reaction-pop`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleReaction(emoji);
                  }}
                  onMouseDown={(e) => {
                    // Удержание для просмотра деталей реакции (как в Telegram)
                    // Используем отдельный обработчик для long press, чтобы не мешать onClick
                    e.stopPropagation();
                    let longPressTimer: NodeJS.Timeout | null = null;
                    
                    longPressTimer = setTimeout(() => {
                      // Вычисляем позицию около сообщения
                      const rect = messageBubbleRef.current?.getBoundingClientRect();
                      const position = rect ? {
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10
                      } : undefined;
                      setReactionDetails({ emoji, userIds, position });
                    }, 500);
                    
                    const handleMouseUp = (upEvent: MouseEvent) => {
                      if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                      }
                      if (e.currentTarget) {
                        e.currentTarget.removeEventListener('mouseup', handleMouseUp);
                        e.currentTarget.removeEventListener('mouseleave', handleMouseUp);
                      }
                    };
                    
                    if (e.currentTarget) {
                      e.currentTarget.addEventListener('mouseup', handleMouseUp);
                      e.currentTarget.addEventListener('mouseleave', handleMouseUp);
                    }
                  }}
                  onTouchStart={(e) => {
                    // Удержание на touch для просмотра деталей реакции
                    let longPressTimer: NodeJS.Timeout | null = null;
                    
                    longPressTimer = setTimeout(() => {
                      // Вычисляем позицию около сообщения
                      const rect = messageBubbleRef.current?.getBoundingClientRect();
                      const position = rect ? {
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10
                      } : undefined;
                      setReactionDetails({ emoji, userIds, position });
                    }, 500);
                    
                    const cleanup = () => {
                      if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                      }
                    };
                    
                    const handleTouchEnd = () => {
                      cleanup();
                      if (e.currentTarget) {
                        e.currentTarget.removeEventListener('touchend', handleTouchEnd);
                        e.currentTarget.removeEventListener('touchcancel', handleTouchEnd);
                      }
                    };
                    
                    if (e.currentTarget) {
                      e.currentTarget.addEventListener('touchend', handleTouchEnd);
                      e.currentTarget.addEventListener('touchcancel', handleTouchEnd);
                    }
                  }}
                >
                  <span className="mr-1">{emoji}</span>
                  <span>{userIds.length}</span>
                </Badge>
                );
              })}
            </div>
          )}

          {/* Reaction details (кто поставил) - список пользователей - поверх сообщений с эффектом стекла */}
          {reactionDetails && (
            <>
              {/* Backdrop для закрытия при клике в любом месте */}
              <div 
                className="fixed inset-0 z-[60]" 
                onClick={() => setReactionDetails(null)}
              />
              <div 
                className="fixed z-[70] px-3 py-2 rounded-xl bg-background/98 backdrop-blur-md border border-border/60 shadow-2xl text-xs max-w-xs"
                style={{
                  top: reactionDetails.position ? `${Math.max(10, reactionDetails.position.y - 10)}px` : '50%',
                  left: reactionDetails.position ? `${reactionDetails.position.x}px` : '50%',
                  transform: reactionDetails.position ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)',
                  maxHeight: '60vh',
                  marginBottom: reactionDetails.position ? '8px' : '0'
                }}
              >
                <div className="flex items-center justify-center mb-2">
                  <span className="font-semibold text-foreground">
                    {reactionDetails.emoji} {reactionDetails.userIds.length}
                  </span>
                </div>
                <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                  {reactionUsers.length > 0 ? (
                    reactionUsers.map((u) => (
                      <div 
                        key={u.id} 
                        className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-accent/50 transition-colors"
                      >
                        <span className="text-foreground">
                          {u.id === user?.id ? (
                            <span className="font-semibold text-primary">Вы</span>
                          ) : (
                            <span>{u.display_name || u.username || `ID: ${u.id.substring(0, 8)}...`}</span>
                          )}
                        </span>
                      </div>
                    ))
                  ) : reactionDetails.userIds.length > 0 ? (
                    <div className="text-muted-foreground py-2 text-center">Загрузка пользователей...</div>
                  ) : (
                    <div className="text-muted-foreground py-2 text-center">Нет пользователей</div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Actions menu - Context menu style */}
          {showEmojiPicker && !isEditing && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowEmojiPicker(false)}
              />
              
              {/* Context Menu - эффект стекла, всегда в поле видимости */}
              <div 
                className="fixed z-50 w-64 p-3 bg-background/98 backdrop-blur-md border border-border/60 rounded-2xl shadow-2xl animate-context-menu-pop"
                style={{
                  top: `${menuPosition.y}px`,
                  left: `${menuPosition.x}px`,
                  transform: menuPosition.y > window.innerHeight / 2 
                    ? 'translate(-50%, -100%) translateY(-8px)' 
                    : 'translate(-50%, 0) translateY(8px)',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  maxHeight: '80vh',
                  overflowY: 'auto'
                }}
              >
                <div className="space-y-1">
                  <div className="space-y-1">
                    {/* Emoji Reactions - горизонтально в 3 строки */}
                    <div className="border-b pb-2 mb-2">
                      <div className="flex items-center justify-between mb-2 px-2">
                        <p className="text-xs text-muted-foreground">Реакции</p>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {quickEmojis.map((emoji) => (
                          <Button
                            key={emoji}
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 hover:bg-accent/80 text-xl transition-transform duration-150 hover:scale-125 active:scale-100 animate-reaction-pop rounded-lg"
                            onClick={() => handleReaction(emoji)}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8"
                      onClick={() => {
                        onReply(message);
                        setShowEmojiPicker(false);
                      }}
                    >
                      <Reply className="w-4 h-4 mr-2" />
                      Ответить
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8"
                      onClick={handleCopyMessage}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Копировать
                    </Button>

                    {onForward && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8"
                        onClick={() => {
                          if (onForward) {
                            onForward(message);
                          }
                          setShowEmojiPicker(false);
                        }}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Переслать
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8"
                      onClick={handleAddToFavorites}
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Добавить в избранное
                    </Button>

                    {/* Быстрое исправление - доступно для своих сообщений или модераторам */}
                    {(isOwnMessage || canModerate) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8"
                        onClick={handleQuickFix}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Быстрое исправление
                      </Button>
                    )}

                    {isOwnMessage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8"
                        onClick={() => {
                          if (onStartEdit) {
                            onStartEdit(message);
                          }
                          setShowEmojiPicker(false);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Редактировать
                      </Button>
                    )}

                    {canPin && !isPinned && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8"
                        onClick={() => {
                          onPin(message.id);
                          setShowEmojiPicker(false);
                        }}
                      >
                        <Pin className="w-4 h-4 mr-2" />
                        Закрепить
                      </Button>
                    )}

                    {(isOwnMessage || canModerate) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          onDelete(message.id);
                          setShowEmojiPicker(false);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Кастомное окно выбора эмодзи с эффектом стекла - вне вложенных div для правильного позиционирования */}
      {showEmojiModal && (
        <CustomEmojiPicker
          onEmojiSelect={(emoji) => {
            handleReaction(emoji);
            setShowEmojiModal(false);
          }}
          onClose={() => setShowEmojiModal(false)}
          position={emojiModalPosition}
        />
      )}
    </div>
  );
}