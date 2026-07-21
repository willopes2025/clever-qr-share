import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface EmailAttachmentMeta {
  path: string;
  filename: string;
  content_type: string;
  size: number;
}

interface Props {
  organizationId: string | null | undefined;
  value: EmailAttachmentMeta[];
  onChange: (v: EmailAttachmentMeta[]) => void;
  maxMb?: number;
}

const MAX_TOTAL_MB_DEFAULT = 20;

export function EmailAttachmentsField({ organizationId, value, onChange, maxMb = MAX_TOTAL_MB_DEFAULT }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!organizationId) { toast.error("Organização não identificada"); return; }
    const currentBytes = value.reduce((s, a) => s + (a.size || 0), 0);
    let addedBytes = 0;
    for (const f of Array.from(files)) addedBytes += f.size;
    if ((currentBytes + addedBytes) / 1024 / 1024 > maxMb) {
      toast.error(`Anexos ultrapassam ${maxMb} MB.`); return;
    }
    setUploading(true);
    const next = [...value];
    try {
      for (const f of Array.from(files)) {
        const key = `${organizationId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await supabase.storage.from("email-attachments").upload(key, f, {
          contentType: f.type || "application/octet-stream", upsert: false,
        });
        if (error) throw error;
        next.push({ path: key, filename: f.name, content_type: f.type || "application/octet-stream", size: f.size });
      }
      onChange(next);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(idx: number) {
    const a = value[idx];
    // best-effort delete from storage
    await supabase.storage.from("email-attachments").remove([a.path]).catch(() => {});
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
          Anexar arquivo
        </Button>
        <span className="text-xs text-muted-foreground">
          Limite total {maxMb} MB
        </span>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((a, i) => (
            <Badge key={a.path} variant="secondary" className="gap-2 py-1">
              <span className="truncate max-w-[220px]">{a.filename}</span>
              <span className="opacity-60">{(a.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => remove(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
