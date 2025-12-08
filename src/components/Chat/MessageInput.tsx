import React, { useState, useRef, useEffect } from 'react';
import { Message, storageAPI } from '../../utils/api';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { X, Send, Mic, Video, BarChart3, Circle, Square, Paperclip, Camera, SwitchCamera, Image as ImageIcon, Smile } from '../ui/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import { toast } from '../ui/sonner';
import { compressImage, compressAudio, compressVideo } from '../../utils/imageCompression';
import { CustomEmojiPicker } from './CustomEmojiPicker';
import { useSessionCrypto } from '../../contexts/SessionCryptoContext';
import { decryptMessageContent } from '../../utils/messageEncryption';
import { usersAPI, User } from '../../utils/api';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { fixMediaUrl } from '../../utils/urlFix';

interface MessageInputProps {
  onSend: (content: string, type: Message['type'], replyTo?: string, editingMessageId?: string) => void;
  replyingTo: Message | null;
  onCancelReply: () => void;
  disabled?: boolean;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
}

export function MessageInput({ onSend, replyingTo, onCancelReply, disabled, editingMessage, onCancelEdit }: MessageInputProps) {
  const [content, setContent] = useState('');
  const sessionCrypto = useSessionCrypto();
  
  // Устанавливаем текст редактируемого сообщения в поле ввода
  useEffect(() => {
    if (editingMessage) {
      // Расшифровываем сообщение для редактирования
      const decryptAndSetContent = async () => {
        try {
          const decrypted = await decryptMessageContent(editingMessage.content, sessionCrypto, editingMessage);
          setContent(decrypted);
          // Фокусируемся на поле ввода после небольшой задержки
          setTimeout(() => {
            textareaRef.current?.focus();
            // Устанавливаем курсор в конец текста
            if (textareaRef.current) {
              const length = textareaRef.current.value.length;
              textareaRef.current.setSelectionRange(length, length);
            }
          }, 100);
        } catch (error) {
          // Если не удалось расшифровать, используем оригинальный контент
          setContent(editingMessage.content);
          setTimeout(() => {
            textareaRef.current?.focus();
            if (textareaRef.current) {
              const length = textareaRef.current.value.length;
              textareaRef.current.setSelectionRange(length, length);
            }
          }, 100);
        }
      };
      decryptAndSetContent();
    } else {
      setContent('');
    }
  }, [editingMessage, sessionCrypto]);

  // Все состояния и ref'ы должны быть объявлены ДО useEffect
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isAnonymousPoll, setIsAnonymousPoll] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showAttachDialog, setShowAttachDialog] = useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 });
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Состояния для записи аудио
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecordingTime, setAudioRecordingTime] = useState(0);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAudioCancelledRef = useRef<boolean>(false);

  // Состояния для записи видео - ДОЛЖНЫ быть ДО useEffect, который их использует
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoRecordingTime, setVideoRecordingTime] = useState(0);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isVideoCancelledRef = useRef<boolean>(false);

  // Обновляем превью видео когда диалог открывается и поток готов
  useEffect(() => {
    if (showVideoDialog && streamRef.current) {
      // Небольшая задержка для того, чтобы video элемент успел отрендериться в DOM
      const timer = setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          console.log('Setting video srcObject for preview in useEffect');
          try {
            videoRef.current.srcObject = streamRef.current;
            // Убеждаемся, что видео воспроизводится
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch((err) => {
                console.error('Error playing video preview:', err);
              });
            }
          } catch (err) {
            console.error('Error setting video srcObject:', err);
          }
        } else {
          console.warn('videoRef or streamRef is null in useEffect');
        }
      }, 200);
      
      return () => clearTimeout(timer);
    } else if (!showVideoDialog && videoRef.current) {
      // Очищаем поток когда диалог закрывается
      videoRef.current.srcObject = null;
    }
  }, [showVideoDialog]);

  const handleSend = () => {
    if (!content.trim() || disabled) return;

    // Если редактируем сообщение, передаем его ID
    const editingMessageId = editingMessage?.id;
    onSend(content, 'text', replyingTo?.id, editingMessageId);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    // Отменяем редактирование после отправки
    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Если открыты подсказки меншенов, обрабатываем навигацию
    if (showMentionSuggestions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        // TODO: Реализовать навигацию по подсказкам
        if (e.key === 'Enter') {
          // Выбираем первую подсказку
          handleSelectMention(mentionSuggestions[0]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowMentionSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Автоматическое изменение высоты
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }

    // Поиск меншенов при вводе @
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = newContent.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Проверяем, что после @ нет пробела (значит это начало меншена)
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        // Ищем совпадающих пользователей
        const query = textAfterAt.toLowerCase();
        setMentionQuery(query);
        setMentionPosition({ start: lastAtIndex, end: cursorPosition });
        searchMentionUsers(query);
        setShowMentionSuggestions(true);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const searchMentionUsers = async (query: string) => {
    if (!query.trim()) {
      setMentionSuggestions([]);
      return;
    }

    try {
      const data = await usersAPI.search(query);
      // Фильтруем по query и сортируем по display_name или username
      const filtered = (data.users || []).filter((user: User) => {
        const username = user.username?.toLowerCase() || '';
        const displayName = user.display_name?.toLowerCase() || '';
        return username.includes(query) || displayName.includes(query);
      });
      setMentionSuggestions(filtered.slice(0, 10)); // Ограничиваем до 10 результатов
    } catch (error) {
      console.error('Ошибка поиска пользователей для меншена:', error);
      setMentionSuggestions([]);
    }
  };

  const handleSelectMention = (user: User) => {
    if (!textareaRef.current) return;

    // В сообщение всегда подставляем username (логин), а не display_name
    const username = user.username || '';
    const mentionText = `@${username} `;
    
    // Заменяем @query на @username
    const beforeMention = content.substring(0, mentionPosition.start);
    const afterMention = content.substring(mentionPosition.end);
    const newContent = beforeMention + mentionText + afterMention;
    
    setContent(newContent);
    setShowMentionSuggestions(false);
    
    // Устанавливаем курсор после меншена
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Проверяем наличие изображений в буфере обмена
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.startsWith('image/')) {
        e.preventDefault(); // Предотвращаем стандартную вставку
        
        const file = item.getAsFile();
        if (!file) continue;

        try {
          // Сжимаем изображение
          setUploadProgress({ show: true, message: 'Сжатие изображения...' });
          const compressedFile = await compressImage(file);

          // Загружаем в Supabase Storage
          setUploadProgress({ show: true, message: 'Загрузка изображения...' });
          const { url } = await storageAPI.uploadFile(compressedFile);

          // Отправляем изображение
          onSend(`![image](${url})`, 'text', replyingTo?.id);
          setUploadProgress({ show: false, message: '' });
          toast.success('Изображение из буфера обмена отправлено');
        } catch (error: any) {
          console.error('Error uploading pasted image:', error);
          setUploadProgress({ show: false, message: '' });
          toast.error(error.message || 'Ошибка загрузки изображения');
        }
        
        return; // Обрабатываем только первое изображение
      }
    }
    
    // Если изображений нет, текст вставится автоматически
  };

  const formatPollText = (question: string, options: string[], isAnonymous: boolean) => {
    const anonymousTag = isAnonymous ? ' 🔒 [Анонимный]' : '';
    return `📊 ${question}${anonymousTag}\n\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`;
  };

  const handleCreatePoll = () => {
    if (!pollQuestion.trim()) return;
    
    const validOptions = pollOptions.filter(opt => opt.trim());
    if (validOptions.length < 2) return;

    const anonymousTag = isAnonymousPoll ? ' 🔒 [Анонимный]' : '';
    const pollText = `📊 ${pollQuestion}\n\n${validOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`;
    onSend(pollText, 'poll', replyingTo?.id);
    
    setShowPollDialog(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setIsAnonymousPoll(false);
  };

  const addPollOption = () => {
    setPollOptions([...pollOptions, '']);
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  // Функции для записи аудио
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      audioRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Если запись была отменена, не отправляем
        if (isAudioCancelledRef.current) {
          isAudioCancelledRef.current = false;
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          // Создаем файл из blob
          const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
          
          // Загружаем в Supabase Storage
          setUploadProgress({ show: true, message: 'Загрузка голосового сообщения...' });
          const { url } = await storageAPI.uploadFile(audioFile);
          
          // Отправляем голосовое сообщение
          onSend(url, 'voice', replyingTo?.id);
          setUploadProgress({ show: false, message: '' });
          toast.success('Голосовое сообщение отправлено');
        } catch (error: any) {
          console.error('Error uploading audio:', error);
          setUploadProgress({ show: false, message: '' });
          toast.error(error.message || 'Ошибка загрузки аудио');
        } finally {
          // Останавливаем все треки
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            audioStreamRef.current = null;
          }
          
          // Сбрасываем таймер
          setAudioRecordingTime(0);
          if (audioTimerRef.current) {
            clearInterval(audioTimerRef.current);
            audioTimerRef.current = null;
          }
        }
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setShowAttachMenu(false);
      setShowAttachDialog(false);
      
      // Запускаем таймер
      audioTimerRef.current = setInterval(() => {
        setAudioRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error: any) {
      console.error('Ошибка при записи аудио:', error);
      
      let errorMessage = 'Не удалось получить доступ к микрофону.\n\n';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Необходимо разрешить доступ к микрофону:\n\n';
        
        // Определяем тип устройства
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
          errorMessage += '📱 На мобильном устройстве:\n';
          errorMessage += '1. В диалоге браузера нажмите "Разрешить"\n';
          errorMessage += '2. Если диалог не появился, проверьте настройки сайта в браузере\n';
          errorMessage += '3. iOS: Настройки > Safari > Камера и Микрофон\n';
          errorMessage += '4. Android: Настройки приложения браузера > Разрешения';
        } else {
          errorMessage += '💻 На компьютере:\n';
          errorMessage += '1. Нажмите на иконку 🔒 в адресной строке\n';
          errorMessage += '2. Найдите "Микрофон" и выберите "Разрешить"\n';
          errorMessage += '3. Обновите страницу';
        }
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'Микрофон не обнаружен. Проверьте подключение микрофона.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Микрофон занят другим приложением. Закройте другие приложения, использующие микрофон.';
      } else {
        errorMessage += 'Убедитесь, что:\n';
        errorMessage += '• Микрофон подключен и работает\n';
        errorMessage += '• Разрешения для микрофона включены\n';
        errorMessage += '• Сайт открыт по HTTPS';
      }
      
      toast.error(errorMessage, { duration: 8000 });
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorderRef.current && isRecordingAudio) {
      audioRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  const cancelAudioRecording = () => {
    // Устанавливаем флаг отмены
    isAudioCancelledRef.current = true;
    
    if (audioRecorderRef.current && isRecordingAudio) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    
    // Останавливаем все треки медиа-потока
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    setIsRecordingAudio(false);
    audioChunksRef.current = [];
    setAudioRecordingTime(0);
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
  };

  // Функции для записи видео
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode }, 
        audio: true 
      });
      
      streamRef.current = stream;
      
      // Открываем диалог ПЕРЕД установкой потока, чтобы video элемент был в DOM
      setShowVideoDialog(true);
      
      // Небольшая задержка для того, чтобы диалог успел отрендериться
      // useEffect также установит поток, но здесь делаем дополнительную установку для надежности
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Устанавливаем поток в video элемент для превью в реальном времени
      if (videoRef.current && streamRef.current) {
        console.log('Setting video srcObject in startVideoRecording');
        videoRef.current.srcObject = streamRef.current;
        // Убеждаемся, что видео воспроизводится
        videoRef.current.play().catch((err) => {
          console.error('Error playing video preview:', err);
        });
      }

      const mediaRecorder = new MediaRecorder(stream);
      videoRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Если запись была отменена, не отправляем
        if (isVideoCancelledRef.current) {
          isVideoCancelledRef.current = false;
          return;
        }
        
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        
        try {
          // Создаем файл из blob
          const videoFile = new File([videoBlob], `video-${Date.now()}.webm`, { type: 'video/webm' });
          
          // Загружаем в Supabase Storage
          setUploadProgress({ show: true, message: 'Загрузка видео...' });
          const { url } = await storageAPI.uploadFile(videoFile);
          
          // Отправляем видео сообщение
          onSend(url, 'video', replyingTo?.id);
          setUploadProgress({ show: false, message: '' });
          toast.success('Видео отправлено');
        } catch (error: any) {
          console.error('Error uploading video:', error);
          setUploadProgress({ show: false, message: '' });
          toast.error(error.message || 'Ошибка загрузки видео');
        } finally {
          // Останавливаем все треки
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          
          // Закрываем диалог и сбрасываем таймер
          setShowVideoDialog(false);
          setVideoRecordingTime(0);
          if (videoTimerRef.current) {
            clearInterval(videoTimerRef.current);
          }
        }
      };

      // Диалог уже открыт выше, просто запускаем запись
      setShowAttachMenu(false);
      setShowAttachDialog(false);
      setIsRecordingVideo(true);
      mediaRecorder.start();
      
      // Запускаем таймер
      videoTimerRef.current = setInterval(() => {
        setVideoRecordingTime(prev => {
          const newTime = prev + 1;
          // Автоматически останавливаем через 60 секунд
          if (newTime >= 60) {
            stopVideoRecording();
          }
          return newTime;
        });
      }, 1000);

    } catch (error: any) {
      console.error('Ошибка при записи видео:', error);
      
      let errorMessage = 'Не удалось получить доступ к камере.\n\n';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Необходимо разрешить доступ к камере и микрофону:\n\n';
        
        // Определяем тип устройства
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
          errorMessage += '📱 На мобильном устройстве:\n';
          errorMessage += '1. В диалоге браузера нажмите "Разрешить"\n';
          errorMessage += '2. Если диалог не появился, проверьте настройки сайта\n';
          errorMessage += '3. iOS: Настройки > Safari > Камера и Микрофон\n';
          errorMessage += '4. Android: Настройки приложения браузера > Разрешения';
        } else {
          errorMessage += '💻 На компьютере:\n';
          errorMessage += '1. Нажмите на иконку 🔒 в адресной строке\n';
          errorMessage += '2. Найдите "Камера" и "Микрофон"\n';
          errorMessage += '3. Выберите "Разрешить" для обоих\n';
          errorMessage += '4. Обновите страницу';
        }
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'Камера не обнаружена. Проверьте подключение камеры.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Камера занята другим приложением. Закройте другие приложения, использующие камеру.';
      } else {
        errorMessage += 'Убедитесь, что:\n';
        errorMessage += '• Камера подключена и работает\n';
        errorMessage += '• Разрешения для камеры включены\n';
        errorMessage += '• Сайт открыт по HTTPS';
      }
      
      toast.error(errorMessage, { duration: 8000 });
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && isRecordingVideo) {
      videoRecorderRef.current.stop();
      setIsRecordingVideo(false);
    }
  };

  const cancelVideoRecording = () => {
    // Устанавливаем флаг отмены
    isVideoCancelledRef.current = true;
    
    if (videoRecorderRef.current && isRecordingVideo) {
      videoRecorderRef.current.stop();
      videoRecorderRef.current = null;
    }
    
    // Останавливаем все треки медиа-потока
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Останавливаем видео элемент
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsRecordingVideo(false);
    videoChunksRef.current = [];
    setShowVideoDialog(false);
    setVideoRecordingTime(0);
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
  };

  const switchCamera = async () => {
    if (!isRecordingVideo) return;
    
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    // Останавливаем только видео треки для превью, но не останавливаем MediaRecorder
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => track.stop());
    }
    
    // Запускаем новый поток с новой камерой только для превью
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: newFacingMode }, 
        audio: false // Не нужен новый аудио поток
      });
      
      // Обновляем только превью, НЕ затрагивая MediaRecorder
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Сохраняем новый поток для превью
      if (streamRef.current) {
        const audioTracks = streamRef.current.getAudioTracks();
        streamRef.current = new MediaStream([...stream.getVideoTracks(), ...audioTracks]);
      }

      // MediaRecorder продолжает запись с исходного потока
    } catch (error: any) {
      console.error('Ошибка переключения камеры:', error);
    }
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileSelect = (type: 'file' | 'camera') => {
    if (type === 'camera') {
      cameraInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
    setShowAttachMenu(false);
    setShowAttachDialog(false);
  };

  const handleAddEmoji = (emoji: any) => {
    // Поддержка как объекта emoji-mart, так и строки
    const native = typeof emoji === 'string' ? emoji : (emoji.native || emoji.shortcodes || '');
    if (!native) return;
    setContent((prev) => prev + native);
    setShowEmojiMenu(false);
    textareaRef.current?.focus();
  };

  // Вычисляем позицию emoji picker при открытии - убрано, позиция устанавливается в onClick

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Сбрасываем input сразу
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }

    try {
      let processedFile = file;
      const fileType = file.type;

      // Сжимаем изображения
      if (fileType.startsWith('image/')) {
        setUploadProgress({ show: true, message: 'Сжатие изображения...' });
        processedFile = await compressImage(file);
      }

      // Проверка размера после сжатия
      const maxSize = 50 * 1024 * 1024; // 50 МБ
      if (processedFile.size > maxSize) {
        setUploadProgress({ show: false, message: '' });
        toast.error('Файл слишком большой. Максимальный размер: 50 МБ');
        return;
      }

      // Загружаем файл в Supabase Storage
      setUploadProgress({ show: true, message: 'Загрузка файла...' });
      const { url } = await storageAPI.uploadFile(processedFile);

      // Определяем тип сообщения и отправляем
      let messageType: Message['type'] = 'text';
      if (fileType.startsWith('image/')) {
        messageType = 'text';
        onSend(`![image](${url})`, messageType, replyingTo?.id);
      } else if (fileType.startsWith('video/')) {
        messageType = 'video';
        onSend(url, messageType, replyingTo?.id);
      } else if (fileType.startsWith('audio/')) {
        messageType = 'voice';
        onSend(url, messageType, replyingTo?.id);
      } else {
        messageType = 'text';
        onSend(`📎 [${file.name}](${url})`, messageType, replyingTo?.id);
      }

      setUploadProgress({ show: false, message: '' });
      toast.success('Файл отправлен');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      setUploadProgress({ show: false, message: '' });
      toast.error(error.message || 'Ошибка загрузки файла');
    }
  };

  return (
    <div className="border-t p-4 pb-8 bg-background relative">
      {/* Индикатор загрузки */}
      {uploadProgress.show && (
        <div className="mb-3 flex items-center gap-3 bg-blue-50 dark:bg-blue-950 rounded-lg px-4 py-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-700 dark:text-blue-300">{uploadProgress.message}</span>
          </div>
        </div>
      )}

      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border-l-4 border-primary">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">
              Ответ на {replyingTo.sender_username}
            </p>
            <p className="text-sm truncate text-foreground/80">
              {replyingTo.content.substring(0, 100)}
              {replyingTo.content.length > 100 ? '...' : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancelReply}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Индикатор записи аудио - Telegram стиль */}
      {isRecordingAudio && (
        <div className="mb-3 flex items-center gap-3 bg-primary/10 dark:bg-primary/20 rounded-2xl px-4 py-3 border-2 border-primary/30">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              <Circle className="w-4 h-4 fill-red-500 text-red-500 animate-pulse" />
              <div className="absolute inset-0 w-4 h-4 border-2 border-red-500 rounded-full animate-ping" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Запись голосового сообщения</span>
                <span className="text-sm font-mono text-muted-foreground">{formatTime(audioRecordingTime)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={cancelAudioRecording}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={stopAudioRecording}
              className="bg-primary hover:bg-primary/90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Скрытые inputs для файлов */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        />
        <input
          ref={cameraInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*"
          capture="environment"
        />

        {/* Поле ввода в стиле Telegram - улучшенный дизайн */}
        <div className="flex-1 relative flex items-end bg-muted/50 backdrop-blur-sm rounded-3xl border border-border/40 shadow-sm hover:border-border/60 focus-within:border-primary/50 focus-within:shadow-md transition-all duration-300">
          {/* Кнопка скрепки слева внутри поля */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAttachDialog(true)}
            disabled={disabled || isRecordingAudio || isRecordingVideo}
            title="Прикрепить"
            className="shrink-0 h-11 w-11 rounded-l-3xl hover:bg-muted/80 transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          {/* Поле ввода текста */}
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={disabled ? "Вы не можете отправлять сообщения" : "Сообщение..."}
            disabled={disabled || isRecordingAudio}
            className="flex-1 min-h-[44px] max-h-[200px] resize-none px-3 py-2.5 border-0 bg-transparent focus:ring-0 focus-visible:ring-0 text-base placeholder:text-muted-foreground/60"
            rows={1}
          />

          {/* Кнопка эмодзи справа внутри поля */}
          <Button
            ref={emojiButtonRef}
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              if (emojiButtonRef.current) {
                const rect = emojiButtonRef.current.getBoundingClientRect();
                // Передаем правый нижний угол кнопки
                setEmojiPickerPosition({
                  x: rect.right,
                  y: rect.bottom
                });
              }
              setShowEmojiMenu((v) => !v);
            }}
            disabled={disabled || isRecordingAudio || isRecordingVideo}
            title="Эмодзи"
            className="shrink-0 h-11 w-11 hover:bg-muted/80 transition-colors"
          >
            <Smile className="w-5 h-5" />
          </Button>

          {/* Кнопка отправки справа внутри поля (если есть текст) или кнопка микрофона */}
          {content.trim() ? (
            <Button
              onClick={handleSend}
              disabled={disabled || isRecordingAudio}
              size="icon"
              className="shrink-0 h-11 w-11 rounded-r-3xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all"
            >
              <Send className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={startAudioRecording}
              disabled={disabled || isRecordingVideo || isRecordingAudio}
              size="icon"
              className="shrink-0 h-11 w-11 rounded-r-3xl hover:bg-muted/80 transition-colors"
              title="Голосовое сообщение"
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Кастомное окно выбора эмодзи с эффектом стекла */}
      {showEmojiMenu && (
        <CustomEmojiPicker
          onEmojiSelect={(emoji) => {
            handleAddEmoji(emoji);
            setShowEmojiMenu(false);
          }}
          onClose={() => setShowEmojiMenu(false)}
          position={emojiPickerPosition}
        />
      )}

      {/* Подсказки меншенов */}
      {showMentionSuggestions && mentionSuggestions.length > 0 && textareaRef.current && (
        <div 
          className="absolute bottom-full left-0 mb-2 w-64 max-h-64 overflow-y-auto bg-background/95 backdrop-blur-md border border-border/80 rounded-lg shadow-lg z-50"
          style={{
            bottom: `${textareaRef.current.offsetHeight + 8}px`
          }}
        >
          {mentionSuggestions.map((user) => (
            <div
              key={user.id}
              onClick={() => handleSelectMention(user)}
              className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={fixMediaUrl(user.avatar_url || user.avatar)} />
                <AvatarFallback>
                  {(user.display_name || user.username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.display_name || user.username}
                </p>
                {user.display_name && (
                  <p className="text-xs text-muted-foreground truncate">
                    @{user.username}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Диалог создания опроса */}
      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать опрос</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pollQuestion">Вопрос опроса</Label>
              <Input
                id="pollQuestion"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Что вы думаете о...?"
              />
            </div>

            <div className="space-y-2">
              <Label>Варианты ответов</Label>
              {pollOptions.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                    placeholder={`Вариант ${index + 1}`}
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removePollOption(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" onClick={addPollOption} className="w-full">
                Добавить вариант
              </Button>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="anonymous-poll"
                checked={isAnonymousPoll}
                onCheckedChange={(checked) => setIsAnonymousPoll(checked as boolean)}
              />
              <Label htmlFor="anonymous-poll" className="cursor-pointer text-sm">
                Анонимный опрос (голоса не будут видны другим пользователям)
              </Label>
            </div>

            <Button
              onClick={handleCreatePoll}
              disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
              className="w-full"
            >
              Создать опрос
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог записи видео */}
      <Dialog open={showVideoDialog} onOpenChange={(open) => {
        if (!open) cancelVideoRecording();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Запись видео сообщения</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Превью видео - Telegram стиль */}
            <div className="relative w-full aspect-square max-w-md mx-auto bg-black rounded-2xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} // Зеркальное отображение для фронтальной камеры
              />
              {isRecordingVideo && (
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full flex items-center gap-2">
                  <div className="relative">
                    <Circle className="w-2 h-2 fill-red-500 text-red-500" />
                    <div className="absolute inset-0 w-2 h-2 border border-red-500 rounded-full animate-ping" />
                  </div>
                  <span className="text-sm font-mono font-medium">{formatTime(videoRecordingTime)}</span>
                </div>
              )}
              
              {/* Кнопка переключения камеры */}
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-4 right-4 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white border-0"
                onClick={switchCamera}
                disabled={!isRecordingVideo}
              >
                <SwitchCamera className="w-5 h-5" />
              </Button>
            </div>

            {/* Прогресс бар */}
            <div className="space-y-2">
              <Progress value={(videoRecordingTime / 60) * 100} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Максимальная длительность: 60 секунд
              </p>
            </div>

            {/* Кнопки управления */}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={cancelVideoRecording}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Отмена
              </Button>
              <Button
                variant="default"
                onClick={stopVideoRecording}
                disabled={!isRecordingVideo || videoRecordingTime < 1}
                className="flex-1"
              >
                <Send className="w-4 h-4 mr-2" />
                Отправить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог прикрепления файлов */}
      <Dialog open={showAttachDialog} onOpenChange={setShowAttachDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Прикрепить</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => handleFileSelect('camera')}
            >
              <Camera className="w-8 h-8" />
              <span className="text-sm">Отправить фото</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => handleFileSelect('file')}
            >
              <Paperclip className="w-8 h-8" />
              <span className="text-sm">Прикрепить файл</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={startVideoRecording}
            >
              <Video className="w-8 h-8" />
              <span className="text-sm">Записать кружок</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 col-span-2"
              onClick={() => {
                setShowPollDialog(true);
                setShowAttachDialog(false);
              }}
            >
              <BarChart3 className="w-8 h-8" />
              <span className="text-sm">Опрос</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}