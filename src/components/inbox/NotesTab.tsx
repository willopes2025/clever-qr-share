import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversationNotes, ConversationNote } from "@/hooks/useConversationNotes";
import { Plus, Pin, PinOff, Pencil, Trash2, Check, X, StickyNote, Paperclip, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toBrazilTime, formatFullDateTimeBR } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NotesTabProps {
  conversationId: string | null;
  contactId: string | null;
}

export const NotesTab = ({ conversationId, contactId }: NotesTabProps) => {
  const { notes, isLoading, createNote, updateNote, deleteNote } = useConversationNotes(conversationId, contactId);
  const [isCreating, setIsCreating] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newPinned, setNewPinned] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAttachment = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `notes/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('inbox-media').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('inbox-media').getPublicUrl(path);
      return { url: data.publicUrl, type: file.type || 'application/octet-stream', name: file.name };
    } catch (e: any) {
      toast.error('Erro ao enviar anexo: ' + (e.message || 'desconhecido'));
      return null;
    }
  };

  const handleCreate = async () => {
    if (!newContent.trim() && !attachedFile) return;
    setUploading(true);
    let media: { url: string; type: string; name: string } | null = null;
    if (attachedFile) {
      media = await uploadAttachment(attachedFile);
      if (!media) { setUploading(false); return; }
    }
    await createNote.mutateAsync({
      content: newContent.trim(),
      isPinned: newPinned,
      mediaUrl: media?.url ?? null,
      mediaType: media?.type ?? null,
      mediaName: media?.name ?? null,
    });
    setNewContent("");
    setNewPinned(false);
    setAttachedFile(null);
    setIsCreating(false);
    setUploading(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    await updateNote.mutateAsync({ id, content: editContent.trim() });
    setEditingId(null);
    setEditContent("");
  };

  const handleTogglePin = async (note: ConversationNote) => {
    await updateNote.mutateAsync({ id: note.id, isPinned: !note.is_pinned });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteNote.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const startEditing = (note: ConversationNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b">
        {isCreating ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Digite sua nota..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="min-h-[100px]"
              autoFocus
            />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setAttachedFile(e.target.files?.[0] ?? null)}
            />
            {attachedFile && (
              <div className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                <Paperclip className="h-3.5 w-3.5" />
                <span className="flex-1 truncate">{attachedFile.name}</span>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setAttachedFile(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newPinned}
                    onChange={(e) => setNewPinned(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <Pin className="h-3.5 w-3.5" />
                  Fixar
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8"
                >
                  <Paperclip className="h-4 w-4 mr-1" />
                  Anexar
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false);
                    setNewContent("");
                    setNewPinned(false);
                    setAttachedFile(null);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={(!newContent.trim() && !attachedFile) || createNote.isPending || uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            </div>

          </div>
        ) : (
          <Button onClick={() => setIsCreating(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Nova Nota
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <StickyNote className="h-12 w-12 mb-2 opacity-50" />
            <p>Nenhuma nota ainda</p>
            <p className="text-sm">Crie uma nota para registrar informações importantes</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "p-3 rounded-lg border bg-card",
                  note.is_pinned && "border-primary/50 bg-primary/5"
                )}
              >
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[100px]"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditContent("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(note.id)}
                        disabled={!editContent.trim() || updateNote.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        {note.content && <p className="text-sm whitespace-pre-wrap">{note.content}</p>}
                        {note.media_url && (
                          note.media_type?.startsWith('image/') ? (
                            <a href={note.media_url} target="_blank" rel="noreferrer">
                              <img src={note.media_url} alt={note.media_name || 'anexo'} className="max-h-48 rounded border" />
                            </a>
                          ) : (
                            <a
                              href={note.media_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1.5 hover:bg-muted/80 max-w-full"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{note.media_name || 'Anexo'}</span>
                            </a>
                          )
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleTogglePin(note)}
                        >
                          {note.is_pinned ? (
                            <PinOff className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Pin className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => startEditing(note)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {note.creator_name ? `Por ${note.creator_name} • ` : ''}{formatFullDateTimeBR(note.created_at)}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
