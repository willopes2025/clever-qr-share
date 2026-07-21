import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SignatureDialog({
  open,
  onOpenChange,
  channelId,
  initialHtml,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  channelId: string | null;
  initialHtml: string | null;
  onSaved: () => void;
}) {
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setHtml(initialHtml ?? "");
  }, [open, initialHtml]);

  async function uploadImage(file: File) {
    if (file.size > 1024 * 1024) {
      toast.error("Imagem muito grande. Use uma imagem menor que 1MB.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    const img = `<div><img src="${dataUrl}" alt="assinatura" style="max-width:300px;height:auto;" /></div>`;
    setHtml((prev) => (prev ? `${prev}\n${img}` : img));
  }

  async function save() {
    if (!channelId) return;
    setSaving(true);
    const { error } = await supabase
      .from("email_channels")
      .update({ signature_html: html || null })
      .eq("id", channelId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Assinatura salva");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assinatura de e-mail</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            A assinatura é adicionada automaticamente ao final de todos os e-mails enviados
            por esta conta (avulsos e campanhas). Você pode usar HTML ou fazer upload de
            uma imagem (ex: assinatura digitalizada, logo).
          </p>
          <div>
            <Label>Upload de imagem (opcional)</Label>
            <div className="flex items-center gap-2 mt-1">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent">
                <Upload className="h-4 w-4" />
                Enviar imagem
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {html && (
                <Button size="sm" variant="ghost" onClick={() => setHtml("")}>
                  <Trash2 className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label>HTML da assinatura</Label>
            <Textarea
              rows={8}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder={`Ex:\n<p><strong>João Silva</strong><br/>Widezap<br/>(11) 99999-9999</p>`}
              className="font-mono text-xs"
            />
          </div>
          {html && (
            <div>
              <Label>Pré-visualização</Label>
              <div
                className="border rounded-md p-3 bg-background prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !channelId}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
