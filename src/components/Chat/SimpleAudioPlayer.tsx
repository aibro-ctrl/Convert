import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Play, Pause, Volume2 } from '../ui/icons';
import { fixMediaUrl } from '../../utils/urlFix';

interface SimpleAudioPlayerProps {
  src: string;
}

export function SimpleAudioPlayer({ src }: SimpleAudioPlayerProps) {
  // Исправляем URL перед использованием
  const fixedSrc = useMemo(() => fixMediaUrl(src), [src]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
    };
  }, [volume]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-primary rounded-2xl min-w-[280px] shadow-lg">
      <audio
        ref={audioRef}
        src={fixedSrc}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={(e) => {
          console.error('Audio playback error:', e, 'URL:', fixedSrc);
        }}
      />
      
      {/* Кнопка Play/Pause */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlayPause}
        className="h-12 w-12 shrink-0 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
      >
        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
      </Button>

      {/* Воспроизведение */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-white text-xs font-mono min-w-[35px]">{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1"
          />
          <span className="text-white text-xs font-mono min-w-[35px] text-right">{formatTime(duration)}</span>
        </div>

        {/* Громкость */}
        <div className="flex items-center gap-2">
          <Volume2 className="w-3 h-3 shrink-0 text-white/80" />
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.1}
            onValueChange={handleVolumeChange}
            className="flex-1 h-1"
          />
          <span className="text-white text-[10px] font-mono min-w-[35px] text-right">{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
