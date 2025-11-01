import React, { useState, useRef } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Play, Pause, Volume2, VolumeX } from '../ui/icons';
import { Button } from '../ui/button';

interface VideoPlayerProps {
  src: string;
}

export function VideoPlayer({ src }: VideoPlayerProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);

  const togglePlayPause = (videoElement: HTMLVideoElement | null) => {
    if (!videoElement) return;

    if (isPlaying) {
      videoElement.pause();
    } else {
      videoElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) videoRef.current.muted = !isMuted;
    if (fullscreenVideoRef.current) fullscreenVideoRef.current.muted = !isMuted;
  };

  const handleVideoClick = () => {
    // Клик - открыть в полноэкранном режиме
    setShowFullscreen(true);
  };

  const handlePlayPauseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePlayPause(videoRef.current);
  };

  return (
    <>
      <div className="relative w-64 h-64 group">
        <video
          ref={videoRef}
          src={src}
          loop
          muted={isMuted}
          autoPlay={false}
          className="w-full h-full rounded-full object-cover cursor-pointer"
          onClick={handleVideoClick}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {/* Круговая обводка с прогрессом воспроизведения */}
        <div className="absolute inset-0 rounded-full border-4 border-primary/20 pointer-events-none" />
        
        {/* Play/Pause overlay button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayPauseClick}
              className="w-full h-full text-white hover:bg-transparent"
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Mute button overlay */}
        <div className="absolute bottom-2 right-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="w-10 h-10 bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 rounded-full"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Fullscreen dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-4xl">
          <div className="relative">
            <video
              ref={fullscreenVideoRef}
              src={src}
              loop
              muted={isMuted}
              autoPlay
              controls
              className="w-full rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
