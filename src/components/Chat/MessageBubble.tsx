import React, { useState, useMemo, useEffect } from 'react';
import { Message, messagesAPI, roomsAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionCrypto } from '../../contexts/SessionCryptoContext';
import { decryptMessageContent, encryptMessageContent } from '../../utils/messageEncryption';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';
import { toast } from '../ui/sonner';
import { Smile, Reply, Pin, Trash2, Edit, MoreHorizontal, Copy, Star, RefreshCw } from '../ui/icons';
import { quickFix } from '../../utils/keyboardLayout';
import { PollMessage } from './PollMessage';
import { SimpleAudioPlayer } from './SimpleAudioPlayer';
import { VideoPlayer } from './VideoPlayer';
import { fixMediaUrl } from '../../utils/urlFix';

interface MessageBubbleProps {
  message: Message;
  onReply: (message: Message) => void;
  onPin: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onUserClick?: (userId: string) => void;
  isPinned: boolean;
  replyToMessage?: Message | null;
  onEdit?: () => void;
}

export function MessageBubble({ 
  message, 
  onReply, 
  onPin, 
  onDelete, 
  onUserClick,
  isPinned,
  replyToMessage,
  onEdit
}: MessageBubbleProps) {
  const { user } = useAuth();
  const sessionCrypto = useSessionCrypto();
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<string>(message.content);
  const [editedContent, setEditedContent] = useState(message.content);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
    try {
      await messagesAPI.addReaction(message.id, emoji);
      setShowEmojiPicker(false);
      // Немедленно обновляем сообщения
      if (onEdit) {
        setTimeout(() => onEdit(), 300);
      }
    } catch (error: any) {
      console.error('Ошибка добавления реакции:', error);
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

  // Обработчики long press
  const handleTouchStart = (e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      const safePos = getSafeMenuPosition(touch.clientX, touch.clientY);
      setMenuPosition(safePos);
      setShowEmojiPicker(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Левая кнопка мыши
      longPressTimer.current = setTimeout(() => {
        const safePos = getSafeMenuPosition(e.clientX, e.clientY);
        setMenuPosition(safePos);
        setShowEmojiPicker(true);
      }, 500);
    }
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Функция для безопасного позиционирования меню
  const getSafeMenuPosition = (x: number, y: number) => {
    const menuWidth = 224; // w-56 = 14rem = 224px
    const menuHeight = 300; // примерная высота меню
    const padding = 16; // отступ от края экрана

    let safeX = x;
    let safeY = y;

    // Проверяем правую границу
    if (safeX + menuWidth / 2 > window.innerWidth - padding) {
      safeX = window.innerWidth - menuWidth / 2 - padding;
    }
    // Проверяем левую границу
    if (safeX - menuWidth / 2 < padding) {
      safeX = menuWidth / 2 + padding;
    }

    // Проверяем верхнюю границу
    if (safeY - menuHeight < padding) {
      safeY = menuHeight + padding;
    }
    // Проверяем нижнюю границу
    if (safeY > window.innerHeight - padding) {
      safeY = window.innerHeight - padding;
    }

    return { x: safeX, y: safeY };
  };

  // Обработчик правого клика
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const safePos = getSafeMenuPosition(e.clientX, e.clientY);
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
            className={`${isCurrentUser ? 'bg-yellow-200 dark:bg-yellow-900 px-1 rounded font-semibold' : 'text-blue-500 font-semibold'}`}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

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

  const [reactionDetails, setReactionDetails] = useState<{ emoji: string; userIds: string[] } | null>(null);

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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
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

          {/* Message bubble */}
          <div
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
                ? { backgroundColor: '#1d9bf0', color: '#ffffff' }
                : undefined
            }
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
                  <div className="space-y-2">
                    <p className="text-sm opacity-70">🎤 Голосовое сообщение</p>
                    <SimpleAudioPlayer src={fixMediaUrl(message.content)} />
                  </div>
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
                <div className="text-[11px] mt-1 text-foreground/80">
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
                    onClick={() => handleReaction(emoji)}
                    onMouseDown={(e) => {
                      // Долгое нажатие для просмотра деталей реакции
                      e.preventDefault();
                      setReactionDetails({ emoji, userIds });
                    }}
                  >
                    <span className="mr-1">{emoji}</span>
                    <span>{userIds.length}</span>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Reaction details (кто поставил) */}
          {reactionDetails && (
            <div className="mt-1 px-2 py-1 rounded-lg bg-background/90 border border-border text-xs text-muted-foreground shadow-sm">
              <span className="font-medium mr-1">Реакция {reactionDetails.emoji}:</span>
              {(() => {
                const { userIds } = reactionDetails;
                const you = userIds.includes(user?.id || '');
                const othersCount = you ? userIds.length - 1 : userIds.length;
                if (you && othersCount > 0) {
                  return <>Вы и ещё {othersCount}</>;
                }
                if (you && othersCount === 0) {
                  return <>Только вы</>;
                }
                return <>Пользователей: {userIds.length}</>;
              })()}
              <button
                className="ml-2 text-[10px] uppercase tracking-wide text-primary hover:underline"
                onClick={() => setReactionDetails(null)}
              >
                скрыть
              </button>
            </div>
          )}

          {/* Actions menu - Context menu style */}
          {showEmojiPicker && !isEditing && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowEmojiPicker(false)}
              />
              
              {/* Context Menu */}
              <div 
                className="fixed z-50 w-64 p-3 bg-background/95 border border-border/80 rounded-2xl shadow-xl animate-context-menu-pop"
                style={{
                  top: `${menuPosition.y}px`,
                  left: `${menuPosition.x}px`,
                  transform: 'translate(-50%, -100%) translateY(-8px)'
                }}
              >
                <div className="space-y-1">
                  <div className="space-y-1">
                    {/* Emoji Reactions */}
                    <div className="border-b pb-2 mb-2">
                      <p className="text-xs text-muted-foreground mb-2 px-2">Реакции</p>
                      <div className="grid grid-cols-6 gap-1">
                        {quickEmojis.map((emoji) => (
                          <Button
                            key={emoji}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-accent text-xl transition-transform duration-150 hover:scale-125 active:scale-100 animate-reaction-pop"
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
                          setIsEditing(true);
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
    </div>
  );
}