import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Image, Video, Mic, X, Loader2, Upload } from 'lucide-react';

export type MediaType = 'image' | 'video' | 'audio' | null;

interface TemplateMediaUploadProps {
  mediaType: MediaType;
  mediaUrl: string | null;
  mediaFilename: string | null;
  onMediaChange: (type: MediaType, url: string | null, filename: string | null) => void;
}

const ACCEPTED_TYPES: Record<string, string> = {
  image: 'image/jpeg,image/png,image/gif,image/webp',
  video: 'video/mp4,video/quicktime,video/webm',
  audio: 'audio/ogg,audio/mpeg,audio/mp3,audio/m4a,audio/wav'
};

const MAX_SIZE_MB: Record<string, number> = {
  image: 5,
  video: 16,
  audio: 16
};

export const TemplateMediaUpload = ({
  mediaType,
  mediaUrl,
  mediaFilename,
  onMediaChange
}: TemplateMediaUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<'image' | 'video' | 'audio' | null>(null);

  const handleUploadClick = (type: 'image' | 'video' | 'audio') => {
    setSelectedType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = ACCEPTED_TYPES[type];
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedType) return;

    // Validate file size
    const maxSizeMB = MAX_SIZE_MB[selectedType];
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo: ${maxSizeMB}MB`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const ext = file.name.split('.').pop();
      const filename = `template-${Date.now()}.${ext}`;
      const path = `templates/${filename}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('inbox-media')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('inbox-media')
        .getPublicUrl(path);

      onMediaChange(selectedType, publicUrl, file.name);
      toast.success('Mídia enviada com sucesso!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar mídia: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMedia = () => {
    onMediaChange(null, null, null);
  };

  const renderPreview = () => {
    if (!mediaUrl || !mediaType) return null;

    return (
      <div className="relative p-3 bg-muted/30 rounded-lg border border-border">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 bg-destructive/20 hover:bg-destructive/40"
          onClick={handleRemoveMedia}
        >
          <X className="h-3 w-3" />
        </Button>
        
        {mediaType === 'image' && (
          <div className="flex items-center gap-3">
            <img 
              src={mediaUrl} 
              alt="Preview" 
              className="h-16 w-16 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{mediaFilename}</p>
              <p className="text-xs text-muted-foreground">Imagem</p>
            </div>
          </div>
        )}

        {mediaType === 'video' && (
          <div className="flex items-center gap-3">
            <video 
              src={mediaUrl} 
              className="h-16 w-24 object-cover rounded bg-black"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{mediaFilename}</p>
              <p className="text-xs text-muted-foreground">Vídeo</p>
            </div>
          </div>
        )}

        {mediaType === 'audio' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{mediaFilename}</p>
                <p className="text-xs text-muted-foreground">Áudio</p>
              </div>
            </div>
            <audio src={mediaUrl} controls className="w-full h-8" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Label>Mídia do Template (opcional)</Label>
      
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />

      {isUploading ? (
        <div className="flex items-center justify-center gap-2 p-6 bg-muted/30 rounded-lg border border-border">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Enviando mídia...</span>
        </div>
      ) : mediaUrl ? (
        renderPreview()
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex flex-col items-center gap-1 h-auto py-4"
            onClick={() => handleUploadClick('image')}
          >
            <Image className="h-5 w-5 text-blue-400" />
            <span className="text-xs">Imagem</span>
            <span className="text-[10px] text-muted-foreground">até 5MB</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="flex flex-col items-center gap-1 h-auto py-4"
            onClick={() => handleUploadClick('video')}
          >
            <Video className="h-5 w-5 text-purple-400" />
            <span className="text-xs">Vídeo</span>
            <span className="text-[10px] text-muted-foreground">até 16MB</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="flex flex-col items-center gap-1 h-auto py-4"
            onClick={() => handleUploadClick('audio')}
          >
            <Mic className="h-5 w-5 text-green-400" />
            <span className="text-xs">Áudio</span>
            <span className="text-[10px] text-muted-foreground">até 16MB</span>
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Formatos aceitos: JPG, PNG, GIF, MP4, OGG (áudio WhatsApp), MP3
      </p>
    </div>
  );
};
