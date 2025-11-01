import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { User as UserIcon, Shield, Crown } from '../ui/icons';
import { User } from '../../utils/api';

interface MembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: User[];
  roomId: string;
  canModerate: boolean;
  onUserClick?: (userId: string) => void;
  godModeEnabled?: boolean;
  currentUserId?: string;
}

export function MembersModal({ isOpen, onClose, members, roomId, canModerate, onUserClick, godModeEnabled, currentUserId }: MembersModalProps) {
  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-red-500" />;
      case 'moderator':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'vip':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleLabel = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'Администратор';
      case 'moderator':
        return 'Модератор';
      case 'vip':
        return 'VIP';
      default:
        return 'Пользователь';
    }
  };

  // Фильтруем пользователя iBro, если он в режиме Глаз Бога
  const filteredMembers = members.filter(member => {
    // Если это iBro в режиме Глаз Бога и он не владелец комнаты, скрываем его
    if (godModeEnabled && member.username === 'iBro' && member.id !== currentUserId) {
      return false;
    }
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Участники комнаты ({filteredMembers.length})</DialogTitle>
        </DialogHeader>
        
        <div className="max-h-96 overflow-y-auto space-y-2">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer"
              onClick={() => onUserClick && onUserClick(member.id)}
            >
              <Avatar className="w-10 h-10">
                {((member as any).avatar || (member as any).avatar_url) ? (
                  <AvatarImage 
                    src={(member as any).avatar || (member as any).avatar_url} 
                    alt={(member as any).display_name || member.username}
                  />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {((member as any).display_name || member.username).charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p>{(member as any).display_name || member.username}</p>
                  {(member as any).display_name && (
                    <span className="text-xs text-muted-foreground">@{member.username}</span>
                  )}
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getRoleIcon(member.role)}
                    {getRoleLabel(member.role)}
                  </Badge>
                </div>
                {(() => {
                  const lastActivity = member.last_activity;
                  if (!lastActivity) {
                    return (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        Не в сети
                      </div>
                    );
                  }
                  
                  const diff = new Date().getTime() - new Date(lastActivity).getTime();
                  
                  // Если активность была меньше 5 минут назад - онлайн
                  if (diff < 5 * 60 * 1000) {
                    return (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <div className="w-2 h-2 rounded-full bg-green-600" />
                        Онлайн
                      </div>
                    );
                  }
                  
                  // Иначе показываем время последней активности
                  const minutes = Math.floor(diff / (60 * 1000));
                  const hours = Math.floor(diff / (60 * 60 * 1000));
                  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                  
                  let timeText = '';
                  if (days > 0) {
                    timeText = `${days} д. назад`;
                  } else if (hours > 0) {
                    timeText = `${hours} ч. назад`;
                  } else if (minutes > 0) {
                    timeText = `${minutes} мин. назад`;
                  } else {
                    timeText = 'только что';
                  }
                  
                  return (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      {timeText}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
