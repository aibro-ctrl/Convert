import React, { useState, useEffect, useRef } from 'react';
import { DirectMessage, Message, dmAPI, messagesAPI, usersAPI, User } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useAchievements } from '../../contexts/AchievementsContext';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Button } from '../ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { toast } from '../ui/sonner';
import { ArrowLeft, ArrowDown } from '../ui/icons';

interface DirectMessageChatProps {
  dm: DirectMessage;
  onBack: () => void;
  onUserClick?: (userId: string) => void;
}

export function DirectMessageChat({ dm, onBack, onUserClick: onUserClickProp }: DirectMessageChatProps) {
  const { user } = useAuth();
  const { tracker } = useAchievements();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    loadOtherUser();
    
    const interval = setInterval(() => {
      loadMessages();
    }, 3000); // Обновление каждые 3 секунды
    
    return () => clearInterval(interval);
  }, [dm.id]);

  // Отслеживание скролла для показа кнопки
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const loadOtherUser = async () => {
    const otherId = dm.participants.find(id => id !== user!.id);
    if (otherId) {
      try {
        const data = await usersAPI.getById(otherId);
        setOtherUser(data.user);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    }
  };

  const loadMessages = async () => {
    try {
      const data = await dmAPI.getMessages(dm.id, 100);
      const newMessages = data.messages.filter((msg: Message | null) => msg !== null && msg !== undefined);
      
      // Сохраняем позицию скролла перед обновлением
      const container = messagesContainerRef.current;
      const wasAtBottom = container ? 
        container.scrollHeight - container.scrollTop - container.clientHeight < 150 : false;
      
      // Обновляем только если есть изменения
      const messagesChanged = messages.length !== newMessages.length || 
        (newMessages.length > 0 && messages.length > 0 && 
         messages[messages.length - 1]?.id !== newMessages[newMessages.length - 1]?.id);
         
      if (messagesChanged) {
        setMessages(newMessages);
        
        // Если были внизу, плавно прокручиваем к новым сообщениям
        if (wasAtBottom && container) {
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
          });
        }
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string, type: Message['type'], replyTo?: string) => {
    try {
      await dmAPI.sendMessage(dm.id, content, type, replyTo);
      setReplyingTo(null);
      
      // Проверка на первое сообщение в ЛС
      if (!hasSentFirstMessage && tracker) {
        await tracker.checkFirstMessage();
        setHasSentFirstMessage(true);
      }
      
      // Проверка на голосовое сообщение
      if (type === 'voice' && tracker) {
        await tracker.checkVoiceMessage();
      }
      
      // Проверка на видео кружочек
      if (type === 'video' && tracker) {
        await tracker.checkVideoCircleSent();
      }
      
      // Проверка на ответ
      if (replyTo && tracker) {
        await tracker.checkReply();
      }
      
      // Дополнительные проверки
      if (tracker) {
        // Общее количество сообщений
        await tracker.checkTotalMessages();
        
        // Ночное сообщение
        await tracker.checkNightMessage();
        
        // Скорострел
        await tracker.checkSpeedShooter();
        
        // Упоминания
        await tracker.checkMentions(content);
        
        // Новогоднее чудо
        await tracker.checkNewYearMessage();
        
        // Парадокс
        await tracker.checkParadoxMessage(content, new Date().toISOString());
        
        // Ежедневная активность
        await tracker.checkDailyActivity();
      }
      
      await loadMessages();
      setTimeout(scrollToBottom, 100);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отправки сообщения');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await messagesAPI.delete(messageId);
      await loadMessages();
    } catch (error: any) {
      console.error('Ошибка удаления:', error);
      toast.error('Не удалось удалить сообщение');
    }
  };

  const handleUserClick = (userId: string) => {
    if (onUserClickProp) {
      onUserClickProp(userId);
    }
  };

  // Отметить как прочитанное при входе
  useEffect(() => {
    const markAsRead = async () => {
      try {
        await dmAPI.markAsRead(dm.id);
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    };
    markAsRead();
  }, [dm.id]);

  const isMuted = user?.muted;
  const isBanned = user?.banned;
  const canSend = !isMuted && !isBanned;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b p-4 pt-6 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {otherUser && (
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                {(otherUser as any).avatar ? (
                  <AvatarImage src={(otherUser as any).avatar} alt={otherUser.username} />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {((otherUser as any).display_name || otherUser.username).charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <h2 className="font-semibold">
                  {(otherUser as any).display_name || otherUser.username}
                </h2>
                <p className="text-sm text-muted-foreground">
                  @{otherUser.username}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 relative">
        <div ref={messagesContainerRef} className="absolute inset-0 overflow-y-auto p-4">
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
                .map((message) => {
                  const replyToMsg = message.reply_to 
                    ? messages.find(m => m && m.id === message.reply_to)
                    : null;
                  
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onReply={setReplyingTo}
                      onPin={() => {}} // DM не поддерживает закрепление
                      onDelete={handleDeleteMessage}
                      onUserClick={handleUserClick}
                      isPinned={false}
                      replyToMessage={replyToMsg}
                      onEdit={loadMessages}
                    />
                  );
                })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
        {/* Кнопка прокрутки вниз */}
        {showScrollButton && (
          <div className="absolute bottom-4 right-4 z-20">
            <Button
              onClick={scrollToBottom}
              size="icon"
              className="rounded-full shadow-lg hover:shadow-xl transition-shadow"
              variant="secondary"
            >
              <ArrowDown className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 z-20 bg-background border-t">
        {isBanned ? (
          <div className="p-4 bg-destructive/10 text-center">
            <p className="text-destructive">Вы заблокированы и не можете отправлять сообщения</p>
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
            disabled={!canSend}
          />
        )}
      </div>
    </div>
  );
}