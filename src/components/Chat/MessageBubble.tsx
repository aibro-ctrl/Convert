import React, { useState, useMemo } from 'react';
import { Message, messagesAPI, roomsAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';
import { toast } from '../ui/sonner';
import { Smile, Reply, Pin, Trash2, Edit, MoreHorizontal, Copy } from '../ui/icons';
import { PollMessage } from './PollMessage';
import { SimpleAudioPlayer } from './SimpleAudioPlayer';
import { VideoPlayer } from './VideoPlayer';

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
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  
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
    if (!editedContent.trim() || editedContent === message.content) {
      setIsEditing(false);
      return;
    }

    try {
      await messagesAPI.edit(message.id, editedContent);
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
      await navigator.clipboard.writeText(message.content);
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Не удалось скопировать сообщение:', error);
    }
  };

  // Функция для рендеринга контента с изображениями и упоминаниями
  const renderContent = (content: string) => {
    // Проверяем, является ли это изображением в формате markdown
    const imageRegex = /^!\[.*?\]\((https?:\/\/[^\s)]+)\)$/;
    const imageMatch = content.match(imageRegex);
    
    if (imageMatch) {
      const imageUrl = imageMatch[1];
      return (
        <img 
          src={imageUrl} 
          alt="Изображение" 
          className="max-w-full max-h-96 rounded-lg cursor-pointer object-contain"
          onClick={() => window.open(imageUrl, '_blank')}
          loading="lazy"
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
        parts.push(
          <img 
            key={`img-${match.index}`}
            src={imageUrl} 
            alt="Изображение" 
            className="max-w-full max-h-96 rounded-lg cursor-pointer object-contain my-2"
            onClick={() => window.open(imageUrl, '_blank')}
            loading="lazy"
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
            <AvatarImage src={message.sender_avatar} alt={displayName} />
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
                {replyToMessage.content.substring(0, 50)}
                {replyToMessage.content.length > 50 ? '...' : ''}
              </span>
            </div>
          )}

          {/* Message bubble */}
          <div
            className={`${message.type === 'video' ? 'p-0' : 'rounded-lg px-4 py-2'} relative ${
              message.type === 'video' ? '' : (
                isOwnMessage
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )
            } ${isPinned ? 'ring-2 ring-yellow-500' : ''} ${
              isMentioned && !isOwnMessage ? 'ring-2 ring-yellow-300 dark:ring-yellow-700' : ''
            }`}
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
                      setEditedContent(message.content);
                    }
                  }}
                  className="text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEdit}>Сохранить</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setIsEditing(false);
                    setEditedContent(message.content);
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
                    <SimpleAudioPlayer src={message.content} />
                  </div>
                ) : message.type === 'video' ? (
                  <div>
                    <VideoPlayer src={message.content} />
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">
                    {renderContent(message.content)}
                  </div>
                )}
                <div className="text-xs opacity-70 mt-1">
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
              {Object.entries(message.reactions).map(([emoji, userIds]) => (
                <Badge
                  key={emoji}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-accent"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji} {userIds.length}
                </Badge>
              ))}
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
                className="fixed z-50 w-56 p-2 bg-background border border-border rounded-lg shadow-lg"
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
                            className="h-8 w-8 p-0 hover:bg-accent"
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
