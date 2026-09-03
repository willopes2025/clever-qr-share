import { useState, useRef } from "react";
import { Paperclip, Image, FileText, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { compressVideo, WHATSAPP_VIDEO_LIMIT_BYTES } from "@/lib/video-compress";

type MediaType = 'image' | 'document' | 'video';

interface MediaUploadButtonProps {
  /** Receives the selected file in memory — nothing is uploaded until the message is sent. */
  onSelect: (file: File, type: MediaType) => void;
  disabled?: boolean;
}

export const MediaUploadButton = ({ onSelect, disabled }: MediaUploadButtonProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>("Processando...");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const resetInputs = () => {
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: MediaType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Hard ceiling per type (pre-compression for video).
    const maxSize = type === 'video' ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Máximo ${type === 'video' ? '200MB' : '10MB'}.`);
      resetInputs();
      return;
    }

    let selected = file;

    if (type === 'video' && file.size > WHATSAPP_VIDEO_LIMIT_BYTES) {
      try {
        setBusy(true);
        setStatusLabel('Comprimindo vídeo...');
        const compressed = await compressVideo(file, {
          onProgress: (r) => setStatusLabel(`Comprimindo vídeo... ${Math.round(r * 100)}%`),
        });
        console.log(`[video-compress] ${file.size} -> ${compressed.size} bytes`);
        if (compressed.size > WHATSAPP_VIDEO_LIMIT_BYTES) {
          toast.error('Não foi possível reduzir o vídeo para menos de 16MB. Tente um vídeo mais curto.');
          setBusy(false);
          resetInputs();
          return;
        }
        selected = compressed;
      } catch (err) {
        console.error('Video compression error:', err);
        toast.error('Falha ao comprimir o vídeo. Tente um arquivo menor.');
        setBusy(false);
        resetInputs();
        return;
      } finally {
        setBusy(false);
        setStatusLabel('Processando...');
      }
    }

    onSelect(selected, type);
    resetInputs();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          disabled={disabled}
          title="Anexar arquivo"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start" side="top">
        {busy ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground text-center">{statusLabel}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium mb-3">Anexar arquivo</p>

            <button
              onClick={() => imageInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 hover:bg-accent rounded-md transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Image className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Imagem</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, GIF</p>
              </div>
            </button>

            <button
              onClick={() => videoInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 hover:bg-accent rounded-md transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Vídeo</p>
                <p className="text-xs text-muted-foreground">MP4, WEBM, MOV</p>
              </div>
            </button>

            <button
              onClick={() => documentInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 hover:bg-accent rounded-md transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Documento</p>
                <p className="text-xs text-muted-foreground">PDF, DOC, XLS</p>
              </div>
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'image')}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'video')}
            />
            <input
              ref={documentInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'document')}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
