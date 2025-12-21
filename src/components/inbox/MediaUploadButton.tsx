import { useState, useRef } from "react";
import { Paperclip, Image, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MediaUploadButtonProps {
  onUpload: (url: string, type: 'image' | 'document') => void;
  disabled?: boolean;
}

export const MediaUploadButton = ({ onUpload, disabled }: MediaUploadButtonProps) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    // Show preview for images
    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = () => {
        setPreview({ 
          url: reader.result as string, 
          type: file.type, 
          name: file.name 
        });
      };
      reader.readAsDataURL(file);
    } else {
      setPreview({ url: '', type: file.type, name: file.name });
    }

    // Upload file
    await uploadFile(file, type);
  };

  const uploadFile = async (file: File, type: 'image' | 'document') => {
    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('inbox-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('inbox-media')
        .getPublicUrl(fileName);

      onUpload(publicUrl, type);
      setOpen(false);
      setPreview(null);
      toast.success("Arquivo enviado com sucesso");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
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
        {uploading ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Enviando...</p>
          </div>
        ) : preview ? (
          <div className="space-y-3">
            {preview.type.startsWith('image/') ? (
              <div className="relative">
                <img 
                  src={preview.url} 
                  alt="Preview" 
                  className="w-full h-32 object-cover rounded-md"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={clearPreview}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{preview.name}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={clearPreview}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
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
