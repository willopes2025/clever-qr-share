import { useState } from "react";
import { FileText, Download, Play, Pause, Loader2, FileAudio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MediaMessageProps {
  mediaUrl: string;
  messageType: string;
  messageId?: string;
  transcription?: string | null;
}

export const MediaMessage = ({ mediaUrl, messageType, messageId, transcription }: MediaMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [localTranscription, setLocalTranscription] = useState(transcription);

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

  const handleTranscribe = async () => {
    if (!messageId) return;
    
    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { messageId, audioUrl: mediaUrl },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setLocalTranscription(data.transcription);
      toast.success("Áudio transcrito!");
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error("Erro ao transcrever áudio");
    } finally {
      setIsTranscribing(false);
    }
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
      <div className="space-y-2">
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
          {messageId && !localTranscription && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleTranscribe}
              disabled={isTranscribing}
              title="Transcrever áudio"
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileAudio className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        
        {/* Transcription */}
        {localTranscription && (
          <div className="px-2 py-1.5 bg-background/30 rounded text-xs italic">
            📝 {localTranscription}
          </div>
        )}
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
