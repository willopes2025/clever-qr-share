import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VariableAutocomplete } from "@/components/templates/VariableAutocomplete";
import { EmailAttachmentsField, type EmailAttachmentMeta } from "@/components/email/EmailAttachmentsField";
import { VisualEmailDesigner } from "@/components/email/VisualEmailDesigner";
import type { EmailDesign } from "@/lib/email-design";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export interface EditableCampaign {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  channel_id: string;
  status: string;
  batch_size: number;
  batch_interval_seconds: number;
  attachments: EmailAttachmentMeta[] | null;
  design_json: EmailDesign | null;
  send_days?: number[] | null;
  send_start_hour?: number | null;
  send_end_hour?: number | null;
}

interface Props {
  campaign: EditableCampaign | null;
  channels: { id: string; email_address: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function htmlToPlain(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .trim();
}

export function EditCampaignDialog({ campaign, channels, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [design, setDesign] = useState<EmailDesign | null>(null);
  const [attachments, setAttachments] = useState<EmailAttachmentMeta[]>([]);
  const [editorTab, setEditorTab] = useState<"simple" | "visual" | "html">("simple");
  const [simpleText, setSimpleText] = useState("");
  const [batchSize, setBatchSize] = useState(20);
  const [batchInterval, setBatchInterval] = useState(60);
  const [sendDays, setSendDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(18);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!campaign) return;
    setName(campaign.name);
    setChannelId(campaign.channel_id);
    setSubject(campaign.subject);
    setBodyHtml(campaign.body_html ?? "");
    setDesign((campaign.design_json as EmailDesign | null) ?? null);
    setAttachments((campaign.attachments as EmailAttachmentMeta[] | null) ?? []);
    setEditorTab(campaign.design_json ? "visual" : "simple");
    setSimpleText(htmlToPlain(campaign.body_html ?? ""));
    setBatchSize(campaign.batch_size ?? 20);
    setBatchInterval(campaign.batch_interval_seconds ?? 60);
    setSendDays(campaign.send_days?.length ? campaign.send_days : [1, 2, 3, 4, 5]);
    setStartHour(campaign.send_start_hour ?? 8);
    setEndHour(campaign.send_end_hour ?? 18);
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: o } = await supabase.rpc("resolve_user_organization_id", { _user_id: data.user.id });
      setOrgId(o as string | null);
    });
  }, [campaign?.id]);

  async function save() {
    if (!campaign) return;
    if (!name.trim() || !subject.trim() || !bodyHtml.trim() || !channelId) {
      toast.error("Preencha nome, canal, assunto e conteúdo");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("email_campaigns").update({
      name, channel_id: channelId, subject, body_html: bodyHtml,
      design_json: design as never,
      attachments: attachments as never,
      batch_size: batchSize, batch_interval_seconds: batchInterval,
      send_days: sendDays.length > 0 ? sendDays : [0, 1, 2, 3, 4, 5, 6],
      send_start_hour: startHour, send_end_hour: endHour,
    }).eq("id", campaign.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Campanha atualizada. As alterações valem para os envios pendentes.");
    onSaved();
    onClose();
  }

  return (
    <Dialog open={!!campaign} onOpenChange={(b) => !b && onClose()}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar campanha</DialogTitle></DialogHeader>

        {campaign && campaign.status === "running" && (
          <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
            Esta campanha está em execução. As alterações se aplicam apenas aos destinatários ainda pendentes —
            e-mails já enviados não mudam. Se preferir, pause a campanha antes de editar.
          </div>
        )}

        <div className="space-y-3">
          <div><Label>Nome da campanha</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>

          <div><Label>Canal de envio</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="Escolher canal" /></SelectTrigger>
              <SelectContent>{channels.map(c => <SelectItem key={c.id} value={c.id}>{c.email_address}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div><Label>Assunto</Label>
            <VariableAutocomplete singleLine value={subject} onChange={setSubject} placeholder="Use {{nome}} para variáveis" />
          </div>

          <div>
            <Label>Conteúdo do e-mail</Label>
            <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as "simple" | "visual" | "html")} className="mt-1">
              <TabsList>
                <TabsTrigger value="simple">Mensagem simples</TabsTrigger>
                <TabsTrigger value="visual">Editor visual (mala direta)</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
              </TabsList>
              <TabsContent value="simple" className="mt-3">
                <Textarea
                  rows={10}
                  value={simpleText}
                  onChange={(e) => {
                    const t = e.target.value;
                    setSimpleText(t);
                    setDesign(null);
                    const escaped = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    setBodyHtml(escaped.split(/\n{2,}/)
                      .map((p) => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br/>")}</p>`).join(""));
                  }}
                />
              </TabsContent>
              <TabsContent value="visual" className="mt-3">
                <VisualEmailDesigner value={design} subject={subject}
                  onChange={(d, html) => { setDesign(d); setBodyHtml(html); }} />
              </TabsContent>
              <TabsContent value="html" className="mt-3">
                <VariableAutocomplete rows={10} value={bodyHtml} onChange={(v) => { setBodyHtml(v); setDesign(null); }} />
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <Label>Anexos</Label>
            <EmailAttachmentsField organizationId={orgId} value={attachments} onChange={setAttachments} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Lote por minuto</Label>
              <Input type="number" min={1} max={200} value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} />
            </div>
            <div><Label>Intervalo entre lotes (segundos)</Label>
              <Input type="number" min={10} value={batchInterval} onChange={e => setBatchInterval(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <Label>Janela de envio</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map(d => (
                <Button key={d.value} type="button" size="sm"
                  variant={sendDays.includes(d.value) ? "default" : "outline"}
                  onClick={() => setSendDays(prev => prev.includes(d.value) ? prev.filter(v => v !== d.value) : [...prev, d.value].sort())}>
                  {d.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Das</span>
              <Input type="number" min={0} max={23} className="w-20" value={startHour} onChange={e => setStartHour(Number(e.target.value))} />
              <span className="text-muted-foreground">h até</span>
              <Input type="number" min={1} max={24} className="w-20" value={endHour} onChange={e => setEndHour(Number(e.target.value))} />
              <span className="text-muted-foreground">h</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
