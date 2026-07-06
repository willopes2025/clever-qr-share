import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Image as ImageIcon, Video, Mic, FileText, Upload, Trash2, Edit, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  useAgentMediaLibrary,
  useAgentMediaMutations,
  type AgentMediaItem,
  type AgentMediaType,
} from '@/hooks/useAgentMediaLibrary';

const ACCEPTED: Record<AgentMediaType, string> = {
  image: 'image/jpeg,image/png,image/gif,image/webp',
  video: 'video/mp4,video/quicktime,video/webm',
  audio: 'audio/ogg,audio/mpeg,audio/mp3,audio/m4a,audio/wav',
  document: 'application/pdf',
};

const MAX_MB: Record<AgentMediaType, number> = {
  image: 5,
  video: 35,
  audio: 16,
  document: 20,
};

const TYPE_ICON: Record<AgentMediaType, React.ElementType> = {
  image: ImageIcon,
  video: Video,
  audio: Mic,
  document: FileText,
};

export const AgentMediaLibraryTab = () => {
  const { user } = useAuth();
  const { data: items = [], isLoading } = useAgentMediaLibrary();
  const { create, update, remove } = useAgentMediaMutations();

  const [uploadType, setUploadType] = useState<AgentMediaType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editing, setEditing] = useState<AgentMediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClickUpload = (t: AgentMediaType) => {
    setUploadType(t);
    setTimeout(() => fileRef.current?.click(), 0);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadType || !user) return;
    if (file.size > MAX_MB[uploadType] * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo: ${MAX_MB[uploadType]}MB`);
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/agent-media/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('inbox-media').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('inbox-media').getPublicUrl(path);
      await create.mutateAsync({
        name: file.name,
        description: null,
        media_type: uploadType,
        media_url: publicUrl,
        mime_type: file.type || null,
        file_size: file.size,
        caption: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro';
      toast.error('Erro no upload: ' + msg);
    } finally {
      setIsUploading(false);
      setUploadType(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Biblioteca de Mídias</h3>
        <p className="text-sm text-muted-foreground">
          Faça upload de imagens, vídeos, PDFs e áudios para reutilizar nas etapas do agente.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={uploadType ? ACCEPTED[uploadType] : undefined}
        onChange={handleFile}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['image', 'video', 'audio', 'document'] as AgentMediaType[]).map((t) => {
          const Icon = TYPE_ICON[t];
          return (
            <Button
              key={t}
              type="button"
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-4"
              onClick={() => handleClickUpload(t)}
              disabled={isUploading}
            >
              {isUploading && uploadType === t ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Icon className="h-5 w-5 text-primary" />
              )}
              <span className="text-xs capitalize">
                {t === 'document' ? 'PDF' : t === 'image' ? 'Imagem' : t === 'video' ? 'Vídeo' : 'Áudio'}
              </span>
              <span className="text-[10px] text-muted-foreground">até {MAX_MB[t]}MB</span>
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma mídia na biblioteca ainda. Use os botões acima para fazer upload.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((m) => {
            const Icon = TYPE_ICON[m.media_type];
            return (
              <Card key={m.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  {m.media_type === 'image' ? (
                    <img src={m.media_url} alt="" className="h-14 w-14 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">{m.media_type}</Badge>
                      {m.description && (
                        <span className="text-xs text-muted-foreground truncate">{m.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(m)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remover "${m.name}" da biblioteca?`)) remove.mutate(m.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar mídia</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição (vista pela IA para decidir quando enviar)</Label>
                <Textarea
                  value={editing.description ?? ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Ex: Vídeo de apresentação do produto, 30s"
                />
              </div>
              <div>
                <Label>Legenda padrão (opcional)</Label>
                <Textarea
                  value={editing.caption ?? ''}
                  onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                  placeholder="Legenda enviada junto da mídia"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!editing) return;
                await update.mutateAsync({
                  id: editing.id,
                  name: editing.name,
                  description: editing.description,
                  caption: editing.caption,
                });
                setEditing(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
