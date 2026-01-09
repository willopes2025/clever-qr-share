import { useState, useRef } from "react";
import { FileText, Download, Play, Pause, Loader2, FileAudio, ExternalLink, AlertCircle, RotateCcw, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
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
  extractedContent?: string | null;
}

const ERROR_TRANSCRIPTIONS = [
  '[Áudio não reconhecido]',
  '[Transcrição não disponível]',
  '[Áudio muito grande para transcrição]',
];

const getAudioMimeType = (url: string): string => {
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  switch (ext) {
    case 'mp3': return 'audio/mpeg';
    case 'mp4': case 'm4a': return 'audio/mp4';
    case 'webm': return 'audio/webm';
    case 'ogg': return 'audio/ogg';
    case 'wav': return 'audio/wav';
    default: return 'audio/mp4';
  }
};

export const MediaMessage = ({ mediaUrl, messageType, messageId, transcription, extractedContent }: MediaMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [localTranscription, setLocalTranscription] = useState(transcription);
  const [audioError, setAudioError] = useState(false);
  
  // PDF extraction states
  const [isExtracting, setIsExtracting] = useState(false);
  const [localExtractedContent, setLocalExtractedContent] = useState(extractedContent);
  const [isContentExpanded, setIsContentExpanded] = useState(false);

  const getFileNameFromUrl = (url: string) => {
    try {
      const parts = url.split('/');
      return parts[parts.length - 1].split('?')[0];
    } catch {
      return 'arquivo';
    }
  };

  const handleAudioToggle = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        setAudioError(true);
      });
    }
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

  const canRetryTranscription = localTranscription && ERROR_TRANSCRIPTIONS.some(
    (err) => localTranscription.includes(err)
  );

  const showTranscribeButton = messageId && (!localTranscription || canRetryTranscription);

  // PDF extraction handler
  const handleExtractPdf = async () => {
    if (!messageId) return;
    
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-pdf-content', {
        body: { messageId, pdfUrl: mediaUrl },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setLocalExtractedContent(data.content);
      setIsContentExpanded(true);
      toast.success("Conteúdo extraído!");
    } catch (error) {
      console.error('PDF extraction error:', error);
      const message = error instanceof Error ? error.message : 'Erro ao extrair conteúdo';
      toast.error(message);
    } finally {
      setIsExtracting(false);
    }
  };

  const showExtractButton = messageId && !localExtractedContent && 
    (messageType === 'document' || mediaUrl.match(/\.pdf$/i));

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
  if (messageType === 'audio' || messageType === 'voice' || mediaUrl.match(/\.(mp3|wav|ogg|webm|m4a|mp4)$/i)) {
    const mimeType = getAudioMimeType(mediaUrl);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg min-w-[200px]">
          {!audioError ? (
            <>
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
                ref={audioRef}
                preload="metadata"
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onError={() => setAudioError(true)}
                className="hidden"
              >
                <source src={mediaUrl} type={mimeType} />
              </audio>
              <div className="flex-1">
                <div className="h-1 bg-muted-foreground/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: isPlaying ? '100%' : '0%' }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-1 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <span>Não foi possível reproduzir</span>
            </div>
          )}
          
          {/* Download/Open fallback */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            asChild
            title="Abrir áudio"
          >
            <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          
          {showTranscribeButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleTranscribe}
              disabled={isTranscribing}
              title={canRetryTranscription ? "Transcrever novamente" : "Transcrever áudio"}
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : canRetryTranscription ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <FileAudio className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        
        {/* Transcription */}
        {localTranscription && !canRetryTranscription && (
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
    <div className="space-y-2">
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
        
        {/* Extract PDF content button */}
        {showExtractButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleExtractPdf}
            disabled={isExtracting}
            title="Extrair conteúdo do PDF"
          >
            {isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
          </Button>
        )}
        
        {/* Toggle extracted content button */}
        {localExtractedContent && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setIsContentExpanded(!isContentExpanded)}
            title={isContentExpanded ? "Recolher conteúdo" : "Expandir conteúdo"}
          >
            {isContentExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
        
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
      
      {/* Extracted content display */}
      {localExtractedContent && isContentExpanded && (
        <div className="px-3 py-2 bg-background/30 rounded text-xs whitespace-pre-wrap max-h-[300px] overflow-y-auto">
          📝 {localExtractedContent}
        </div>
      )}
    </div>
  );
};