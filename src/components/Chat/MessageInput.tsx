import React, { useState, useRef, useEffect } from 'react';
import { Message, storageAPI } from '../../utils/api';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { X, Send, Mic, Video, BarChart3, Circle, Square, Paperclip, Camera, SwitchCamera, Image as ImageIcon } from '../ui/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import { toast } from '../ui/sonner';
import { compressImage, compressAudio, compressVideo } from '../../utils/imageCompression';

interface MessageInputProps {
  onSend: (content: string, type: Message['type'], replyTo?: string) => void;
  replyingTo: Message | null;
  onCancelReply: () => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, replyingTo, onCancelReply, disabled }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isAnonymousPoll, setIsAnonymousPoll] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showAttachDialog, setShowAttachDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Состояния для записи аудио
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecordingTime, setAudioRecordingTime] = useState(0);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Состояния для записи видео
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoRecordingTime, setVideoRecordingTime] = useState(0);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleSend = () => {
    if (!content.trim() || disabled) return;

    onSend(content, 'text', replyingTo?.id);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Автоматическое изменение высоты
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
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

          // Загружаем в PocketBase Storage
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
      const mediaRecorder = new MediaRecorder(stream);
      audioRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          // Создаем файл из blob
          const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
          
          // Загружаем в PocketBase Storage
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
          stream.getTracks().forEach(track => track.stop());
          
          // Сбрасываем таймер
          setAudioRecordingTime(0);
          if (audioTimerRef.current) {
            clearInterval(audioTimerRef.current);
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
    if (audioRecorderRef.current && isRecordingAudio) {
      audioRecorderRef.current.stop();
      setIsRecordingAudio(false);
      audioChunksRef.current = [];
      setAudioRecordingTime(0);
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current);
      }
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
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        
        try {
          // Создаем файл из blob
          const videoFile = new File([videoBlob], `video-${Date.now()}.webm`, { type: 'video/webm' });
          
          // Загружаем в PocketBase Storage
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

      setShowVideoDialog(true);
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
    if (videoRecorderRef.current && isRecordingVideo) {
      videoRecorderRef.current.stop();
      setIsRecordingVideo(false);
      videoChunksRef.current = [];
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setShowVideoDialog(false);
    setVideoRecordingTime(0);
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
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

      // Загружаем файл в PocketBase Storage
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
    <div className="border-t p-4 pb-8 bg-background">
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

      {/* Индикатор записи аудио */}
      {isRecordingAudio && (
        <div className="mb-3 flex items-center gap-3 bg-red-50 dark:bg-red-950 rounded-lg px-4 py-3 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 flex-1">
            <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
            <span className="text-sm">Запись голосового сообщения...</span>
            <span className="text-sm font-mono">{formatTime(audioRecordingTime)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={cancelAudioRecording}>
              Отмена
            </Button>
            <Button variant="default" size="sm" onClick={stopAudioRecording}>
              Отправить
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Единая кнопка скрепки с меню */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowAttachDialog(true)}
          disabled={disabled || isRecordingAudio || isRecordingVideo}
          title="Прикрепить"
          className="shrink-0"
        >
          <Paperclip className="w-5 h-5" />
        </Button>

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

        {/* Поле ввода */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={disabled ? "Вы не можете отправлять сообщения" : "Введите сообщение или вставьте изображение"}
            disabled={disabled || isRecordingAudio}
            className="min-h-[44px] max-h-[200px] resize-none pr-12"
            rows={1}
          />
        </div>

        {/* Кнопка отправки */}
        <Button
          onClick={handleSend}
          disabled={!content.trim() || disabled || isRecordingAudio}
          size="icon"
          className="shrink-0 h-14 w-14"
        >
          <Send className="w-6 h-6" />
        </Button>
      </div>

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
            {/* Круговое превью видео */}
            <div className="relative w-64 h-64 mx-auto">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded-full border-4 border-primary"
              />
              {isRecordingVideo && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-2">
                  <Circle className="w-2 h-2 fill-white animate-pulse" />
                  <span className="text-sm font-mono">{formatTime(videoRecordingTime)}</span>
                </div>
              )}
              
              {/* Кнопка переключения камеры */}
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-4 right-4 rounded-full"
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
              onClick={startAudioRecording}
            >
              <Mic className="w-8 h-8" />
              <span className="text-sm">Голосовое</span>
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