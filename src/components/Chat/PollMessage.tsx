import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { pollsAPI, usersAPI, User } from '../../utils/api';
import { toast } from '../ui/sonner';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle2, Users } from '../ui/icons';
import { fixMediaUrl } from '../../utils/urlFix';

interface PollMessageProps {
  content: string;
  pollId: string;
  onVote?: () => void;
}

interface PollData {
  id: string;
  message_id: string;
  question: string;
  options: string[];
  votes: Record<string, string[]>; // option index -> array of user IDs
  anonymous: boolean;
  created_by: string;
  created_at: string;
}

export function PollMessage({ content, pollId, onVote }: PollMessageProps) {
  const { user } = useAuth();
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVotersDialog, setShowVotersDialog] = useState(false);
  const [votersData, setVotersData] = useState<User[]>([]);

  // Загружаем данные опроса с сервера
  useEffect(() => {
    loadPollData();
    // Обновляем данные каждые 5 секунд (оптимизация)
    const interval = setInterval(loadPollData, 5000);
    return () => clearInterval(interval);
  }, [pollId]);

  const loadPollData = async () => {
    try {
      // Пытаемся загрузить данные опроса с сервера
      const response = await pollsAPI.get(pollId);
      
      if (response.poll) {
        setPollData(response.poll);
        
        // Проверяем, голосовал ли текущий пользователь
        if (user) {
          for (const [optionIndex, voterIds] of Object.entries(response.poll.votes)) {
            if (voterIds.includes(user.id)) {
              setHasVoted(true);
              setSelectedOption(parseInt(optionIndex));
              break;
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading poll from server:', error);
      
      // Если опрос не найден на сервере, парсим из текста (для старых опросов)
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) return;

      const firstLine = lines[0];
      const isAnonymous = firstLine.includes('🔒');
      const question = firstLine.replace('📊 ', '').replace(' 🔒 [Анонимый]', '').replace(' 🔒 [Анонимный]', '').trim();
      
      const options: string[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\d+)\.\s+(.+)$/);
        
        if (match) {
          const optionText = match[2];
          options.push(optionText);
        }
      }

      // Создаем временные данные опроса
      const tempPollData: PollData = {
        id: pollId,
        message_id: pollId,
        question,
        options,
        votes: {},
        anonymous: isAnonymous,
        created_by: '',
        created_at: new Date().toISOString()
      };

      setPollData(tempPollData);
    }
  };

  const handleVote = async (optionIndex: number) => {
    if (!pollId || !user || loading || hasVoted) return;

    setLoading(true);
    
    try {
      await pollsAPI.vote(pollId, optionIndex);
      setSelectedOption(optionIndex);
      setHasVoted(true);
      
      // Обновляем локальные данные
      if (pollData) {
        const newVotes = { ...pollData.votes };
        const optKey = optionIndex.toString();
        if (!newVotes[optKey]) {
          newVotes[optKey] = [];
        }
        newVotes[optKey] = [...newVotes[optKey], user.id];
        
        setPollData({
          ...pollData,
          votes: newVotes
        });
      }
      
      toast.success('Ваш голос учтен');
      // Принудительное обновление через 500мс для получения свежих данных
      setTimeout(() => loadPollData(), 500);
      if (onVote) onVote();
    } catch (error: any) {
      console.error('Error voting:', error);
      toast.error(error.message || 'Ошибка голосования');
    } finally {
      setLoading(false);
    }
  };

  if (!pollData) {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    );
  }

  const { question, options, anonymous, votes } = pollData;

  // Подсчитываем голоса для каждого варианта
  const voteCounts: Record<number, number> = {};
  const votersByOption: Record<number, string[]> = {};
  
  for (let i = 0; i < options.length; i++) {
    voteCounts[i] = 0;
    votersByOption[i] = [];
  }
  
  for (const [optionIndex, voterIds] of Object.entries(votes)) {
    const idx = parseInt(optionIndex);
    voteCounts[idx] = voterIds.length;
    votersByOption[idx] = voterIds;
  }
  
  const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);

  const handleShowVoters = async () => {
    if (anonymous) return;
    
    try {
      // Собираем всех проголосовавших пользователей
      const allVoterIds = new Set<string>();
      Object.values(votes).forEach(voterIds => {
        voterIds.forEach(id => allVoterIds.add(id));
      });
      
      // Загружаем данные пользователей
      const voterPromises = Array.from(allVoterIds).map(async (userId) => {
        try {
          const result = await usersAPI.getById(userId);
          return result.user;
        } catch (error) {
          console.error(`Failed to load voter ${userId}:`, error);
          return null;
        }
      });
      
      const voters = (await Promise.all(voterPromises)).filter(v => v !== null) as User[];
      setVotersData(voters);
      setShowVotersDialog(true);
    } catch (error) {
      console.error('Failed to load voters:', error);
      toast.error('Не удалось загрузить список проголосовавших');
    }
  };

  return (
    <div className="space-y-3 min-w-[280px]">
      {/* Вопрос опроса */}
      <div className="flex items-start gap-2">
        <span className="text-lg">📊</span>
        <div className="flex-1">
          <p className="font-semibold">{question}</p>
          {anonymous && (
            <Badge variant="secondary" className="mt-1 text-xs">
              🔒 Анонимный опрос
            </Badge>
          )}
        </div>
      </div>

      {/* Варианты ответов */}
      <div className="space-y-2">
        {options.map((option, index) => {
          const voteCount = voteCounts[index] || 0;
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
          const isSelected = selectedOption === index;
          const votersList = votersByOption[index] || [];

          return (
            <div key={index} className="space-y-1">
              <Button
                variant={isSelected ? "default" : "outline"}
                className="w-full justify-start h-auto py-3 px-4 relative overflow-hidden"
                onClick={() => !hasVoted && handleVote(index)}
                disabled={hasVoted || loading}
              >
                {/* Progress background */}
                {hasVoted && (
                  <div 
                    className="absolute inset-0 bg-primary/10 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                )}
                
                <div className="relative z-10 flex items-center justify-between w-full">
                  <span className="flex items-center gap-2">
                    {isSelected && <CheckCircle2 className="w-4 h-4" />}
                    {option}
                  </span>
                  
                  {hasVoted && (
                    <span className="text-sm font-semibold">
                      {percentage.toFixed(0)}% ({voteCount})
                    </span>
                  )}
                </div>
              </Button>

              {/* Показываем количество проголосовавших */}
              {hasVoted && votersList.length > 0 && (
                <p className="text-xs text-muted-foreground px-2">
                  {votersList.length} {votersList.length === 1 ? 'проголосовал' : votersList.length < 5 ? 'проголосовали' : 'проголосовало'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Итоги */}
      {hasVoted && (
        <div className="pt-2 border-t">
          {!anonymous ? (
            <button
              onClick={handleShowVoters}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Users className="w-4 h-4" />
              Всего голосов: {totalVotes}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Всего голосов: {totalVotes}
            </p>
          )}
        </div>
      )}

      {!hasVoted && (
        <p className="text-xs text-muted-foreground">
          Нажмите на вариант для голосования
        </p>
      )}

      {/* Диалог со списком проголосовавших */}
      <Dialog open={showVotersDialog} onOpenChange={setShowVotersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Проголосовали ({totalVotes})</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {votersData.map((voter) => {
              // Определяем за какой вариант проголосовал пользователь
              let votedOption = -1;
              for (const [optionIndex, voterIds] of Object.entries(votes)) {
                if (voterIds.includes(voter.id)) {
                  votedOption = parseInt(optionIndex);
                  break;
                }
              }
              
              return (
                <div key={voter.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent">
                  <Avatar className="w-10 h-10">
                    {(voter as any).avatar ? (
                      <AvatarImage src={fixMediaUrl((voter as any).avatar)} alt={voter.username} />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {((voter as any).display_name || voter.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {(voter as any).display_name || voter.username}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      @{voter.username}
                    </p>
                  </div>
                  {votedOption >= 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {options[votedOption]}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
