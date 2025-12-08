import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Checkbox } from '../ui/checkbox';
import { roomsAPI, directMessagesAPI, Message, Room, DirectMessage } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { fixMediaUrl } from '../../utils/urlFix';
import { toast } from '../ui/sonner';
import { Search, Send } from '../ui/icons';

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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [activeTab, setActiveTab] = useState<'rooms' | 'dms'>('rooms');

  useEffect(() => {
    if (open) {
      loadRoomsAndDMs();
    }
  }, [open]);

  const loadRoomsAndDMs = async () => {
    try {
      const [roomsData, dmsData] = await Promise.all([
        roomsAPI.getUserRooms(),
        directMessagesAPI.getUserDMs()
      ]);
      setRooms(roomsData || []);
      setDms(dmsData || []);
    } catch (error) {
      console.error('Failed to load rooms and DMs:', error);
      toast.error('Failed to load chats');
    }
  };

  const toggleTarget = (targetId: string) => {
    const newTargets = new Set(selectedTargets);
    if (newTargets.has(targetId)) {
      newTargets.delete(targetId);
    } else {
      newTargets.add(targetId);
    }
    setSelectedTargets(newTargets);
  };

  const handleForward = async () => {
    if (selectedTargets.size === 0) {
      toast.error('Please select at least one chat');
      return;
    }

    setIsForwarding(true);

    try {
      const forwardPromises: Promise<any>[] = [];

      for (const targetId of selectedTargets) {
        for (const message of messages) {
          // Determine if target is a room or DM based on the tab
          const isRoom = activeTab === 'rooms' || rooms.some(r => r.id === targetId);
          
          if (isRoom) {
            // Forward to room
            const forwardContent = `[Forwarded]\n${message.content}`;
            forwardPromises.push(
              roomsAPI.sendMessage(targetId, forwardContent, message.type)
            );
          } else {
            // Forward to DM
            const forwardContent = `[Forwarded]\n${message.content}`;
            forwardPromises.push(
              directMessagesAPI.sendMessage(targetId, forwardContent, message.type)
            );
          }
        }
      }

      await Promise.all(forwardPromises);

      toast.success(`Forwarded ${messages.length} message(s) to ${selectedTargets.size} chat(s)`);
      onForwardComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to forward messages:', error);
      toast.error('Failed to forward messages');
    } finally {
      setIsForwarding(false);
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDMs = dms.filter(dm =>
    dm.other_user?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dm.other_user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Forward {messages.length} message{messages.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'rooms'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Rooms ({rooms.length})
            </button>
            <button
              onClick={() => setActiveTab('dms')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'dms'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Direct Messages ({dms.length})
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* List */}
          <ScrollArea className="h-[300px] border rounded-md">
            <div className="p-2 space-y-1">
              {activeTab === 'rooms' ? (
                filteredRooms.length > 0 ? (
                  filteredRooms.map(room => (
                    <div
                      key={room.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => toggleTarget(room.id)}
                    >
                      <Checkbox
                        checked={selectedTargets.has(room.id)}
                        onCheckedChange={() => toggleTarget(room.id)}
                      />
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={fixMediaUrl(room.avatar)} />
                        <AvatarFallback>{room.name[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{room.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {room.description || 'No description'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No rooms found
                  </div>
                )
              ) : (
                filteredDMs.length > 0 ? (
                  filteredDMs.map(dm => (
                    <div
                      key={dm.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => toggleTarget(dm.id)}
                    >
                      <Checkbox
                        checked={selectedTargets.has(dm.id)}
                        onCheckedChange={() => toggleTarget(dm.id)}
                      />
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={fixMediaUrl(dm.other_user?.avatar)} />
                        <AvatarFallback>
                          {dm.other_user?.display_name?.[0]?.toUpperCase() || 
                           dm.other_user?.username?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {dm.other_user?.display_name || dm.other_user?.username}
                        </p>
                        {dm.other_user?.status && (
                          <p className="text-sm text-muted-foreground truncate">
                            {dm.other_user.status}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No direct messages found
                  </div>
                )
              )}
            </div>
          </ScrollArea>

          {/* Selected count */}
          {selectedTargets.size > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedTargets.size} chat{selectedTargets.size > 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isForwarding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleForward}
            disabled={selectedTargets.size === 0 || isForwarding}
          >
            <Send className="h-4 w-4 mr-2" />
            {isForwarding ? 'Forwarding...' : 'Forward'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
