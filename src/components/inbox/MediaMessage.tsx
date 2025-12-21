import { useState } from "react";
import { FileText, Download, Play, Pause, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MediaMessageProps {
  mediaUrl: string;
  messageType: string;
}

export const MediaMessage = ({ mediaUrl, messageType }: MediaMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  const getFileNameFromUrl = (url: string) => {
    try {
      const parts = url.split('/');
      return parts[parts.length - 1].split('?')[0];
    } catch {
      return 'arquivo';
    }
  };

  const handleAudioToggle = () => {
    if (!audioRef) return;
    
    if (isPlaying) {
      audioRef.pause();
    } else {
      audioRef.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Image
  if (messageType === 'image' || mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <img
            src={mediaUrl}
            alt="Imagem"
            className="max-w-[280px] max-h-[200px] rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity"
          />
        </DialogTrigger>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/90">
          <img
            src={mediaUrl}
            alt="Imagem"
            className="w-full h-auto max-h-[90vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Audio/Voice
  if (messageType === 'audio' || messageType === 'voice' || mediaUrl.match(/\.(mp3|wav|ogg|webm|m4a)$/i)) {
    return (
      <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg min-w-[200px]">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleAudioToggle}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <audio
          ref={(ref) => setAudioRef(ref)}
          src={mediaUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
        <div className="flex-1">
          <div className="h-1 bg-muted-foreground/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: isPlaying ? '100%' : '0%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Video
  if (messageType === 'video' || mediaUrl.match(/\.(mp4|webm|mov)$/i)) {
    return (
      <video
        src={mediaUrl}
        controls
        className="max-w-[280px] max-h-[200px] rounded-md"
      />
    );
  }

  // Document/File
  return (
    <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg min-w-[200px]">
      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {getFileNameFromUrl(mediaUrl)}
        </p>
        <p className="text-xs text-muted-foreground">Documento</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        asChild
      >
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" download>
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
};
