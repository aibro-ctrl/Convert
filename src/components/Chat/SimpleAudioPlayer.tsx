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
    <div className="flex flex-col gap-2 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 min-w-[250px] shadow-sm">
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
      
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlayPause}
          className="shrink-0 h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5 text-primary" /> : <Play className="w-5 h-5 text-primary ml-0.5" />}
        </Button>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground font-mono">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <Volume2 className="w-4 h-4 shrink-0 text-muted-foreground" />
        <Slider
          value={[volume]}
          min={0}
          max={1}
          step={0.1}
          onValueChange={handleVolumeChange}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground font-mono w-8 text-right">{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}
