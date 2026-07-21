import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Play, Pause, Plus, RefreshCw, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

import { EmailAttachmentsField, type EmailAttachmentMeta } from "@/components/email/EmailAttachmentsField";
import { VisualEmailDesigner } from "@/components/email/VisualEmailDesigner";
import type { EmailDesign } from "@/lib/email-design";

interface Channel { id: string; email_address: string; display_name: string | null; status: string; }
interface Template {
  id: string; name: string; subject: string; body_html: string;
  design_json: EmailDesign | null;
  attachments: EmailAttachmentMeta[] | null;
}
interface Campaign {
  id: string; name: string; subject: string; body_html: string; body_text: string | null;
  channel_id: string; template_id: string | null;
  source_type: string; source_config: Record<string, unknown>;
  batch_size: number; batch_interval_seconds: number;
  status: string; stats: Record<string, number>;
  attachments: EmailAttachmentMeta[] | null;
  design_json: EmailDesign | null;
  started_at: string | null; completed_at: string | null; created_at: string;
}
interface Recipient {
  id: string; email: string; name: string | null;
  status: string; sent_at: string | null; error_message: string | null;
  attempts: number; scheduled_at: string;
}

export default function EmailCampaigns() {
  const [tab, setTab] = useState("campaigns");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [openTemplate, setOpenTemplate] = useState<Template | null>(null);
  const [openNewTemplate, setOpenNewTemplate] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [ch, tpl, cmp] = await Promise.all([
      supabase.from("email_channels").select("id,email_address,display_name,status").order("created_at", { ascending: false }),
      supabase.from("email_templates").select("id,name,subject,body_html,design_json,attachments").order("updated_at", { ascending: false }),
      supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
    ]);
    setChannels((ch.data ?? []) as Channel[]);
    setTemplates((tpl.data ?? []) as unknown as Template[]);
    setCampaigns((cmp.data ?? []) as unknown as Campaign[]);
    setLoading(false);
  }

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) || null;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/email" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Campanhas de e-mail</h1>
              <p className="text-sm text-muted-foreground">Envio em massa com fila, ritmo controlado e histórico</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setOpenCreate(true)} disabled={channels.length === 0}>
                <Plus className="h-4 w-4 mr-2" /> Nova campanha
              </Button>
            </div>
            {channels.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Conecte uma conta de e-mail em <Link to="/email" className="text-primary underline">/email</Link> antes de criar campanhas.
              </Card>
            )}
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : campaigns.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma campanha ainda.</Card>
            ) : (
              <div className="grid gap-2">
                {campaigns.map(c => (
                  <CampaignRow key={c.id} campaign={c} onOpen={() => setSelectedCampaignId(c.id)} onChanged={loadAll} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setOpenNewTemplate(true)}>
                <Plus className="h-4 w-4 mr-2" /> Novo template
              </Button>
            </div>
            {templates.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum template ainda.</Card>
            ) : (
              <div className="grid gap-2">
                {templates.map(t => (
                  <Card key={t.id} className="p-4 flex items-center justify-between hover:bg-accent/40 cursor-pointer"
                    onClick={() => setOpenTemplate(t)}>
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-md">{t.subject}</div>
                    </div>
                    <Badge variant="secondary">Editar</Badge>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateCampaignDialog open={openCreate} onOpenChange={setOpenCreate}
        channels={channels} templates={templates} onCreated={loadAll} />

      <CampaignDetailDialog campaign={selectedCampaign}
        onClose={() => setSelectedCampaignId(null)} onChanged={loadAll} />

      <TemplateDialog open={openNewTemplate || !!openTemplate}
        template={openTemplate}
        onOpenChange={(b) => { if (!b) { setOpenNewTemplate(false); setOpenTemplate(null); } }}
        onSaved={loadAll} />
    </DashboardLayout>
  );
}

function CampaignRow({ campaign, onOpen, onChanged }: { campaign: Campaign; onOpen: () => void; onChanged: () => void }) {
  const stats = campaign.stats || {};
  const total = (stats.total as number) || 0;
  const sent = (stats.sent as number) || 0;
  const failed = (stats.failed as number) || 0;
  const pending = (stats.pending as number) || 0;
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;

  async function toggle() {
    const next = campaign.status === "running" ? "paused" : "running";
    const patch: Record<string, unknown> = { status: next };
    if (next === "running" && !campaign.started_at) patch.started_at = new Date().toISOString();
    const { error } = await supabase.from("email_campaigns").update(patch).eq("id", campaign.id);
    if (error) toast.error(error.message); else { toast.success(next === "running" ? "Campanha iniciada" : "Campanha pausada"); onChanged(); }
  }

  return (
    <Card className="p-4 hover:bg-accent/40 cursor-pointer" onClick={onOpen}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{campaign.name}</div>
            <Badge variant={
              campaign.status === "running" ? "default" :
              campaign.status === "completed" ? "secondary" :
              campaign.status === "failed" ? "destructive" : "outline"
            }>{campaign.status}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1 truncate">{campaign.subject}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {sent}/{total} enviados · {pending} pendentes · {failed} falharam · {pct}%
          </div>
        </div>
        {campaign.status !== "completed" && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); toggle(); }}>
            {campaign.status === "running" ? <><Pause className="h-4 w-4 mr-1" />Pausar</> : <><Play className="h-4 w-4 mr-1" />Iniciar</>}
          </Button>
        )}
      </div>
    </Card>
  );
}

function CreateCampaignDialog({ open, onOpenChange, channels, templates, onCreated }: {
  open: boolean; onOpenChange: (b: boolean) => void;
  channels: Channel[]; templates: Template[]; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [design, setDesign] = useState<EmailDesign | null>(null);
  const [attachments, setAttachments] = useState<EmailAttachmentMeta[]>([]);
  const [editorTab, setEditorTab] = useState<"visual" | "html">("visual");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<"paste" | "form" | "broadcast" | "contacts_all">("paste");
  const [pastedEmails, setPastedEmails] = useState("");
  const [formId, setFormId] = useState<string>("");
  const [listId, setListId] = useState<string>("");
  const [batchSize, setBatchSize] = useState(20);
  const [batchInterval, setBatchInterval] = useState(60);
  const [saving, setSaving] = useState(false);
  const [forms, setForms] = useState<{ id: string; name: string }[]>([]);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("forms").select("id,name").eq("status", "published").order("name")
      .then(({ data }) => setForms((data ?? []) as { id: string; name: string }[]));
    supabase.from("broadcast_lists").select("id,name").order("name")
      .then(({ data }) => setLists((data ?? []) as { id: string; name: string }[]));
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: o } = await supabase.rpc("resolve_user_organization_id", { _user_id: data.user.id });
      setOrgId(o as string | null);
    });
  }, [open]);

  useEffect(() => {
    if (!templateId) return;
    const t = templates.find(x => x.id === templateId);
    if (t) {
      setSubject(t.subject);
      setBodyHtml(t.body_html);
      setDesign((t.design_json as EmailDesign | null) ?? null);
      setAttachments((t.attachments as EmailAttachmentMeta[] | null) ?? []);
      setEditorTab(t.design_json ? "visual" : "html");
    }
  }, [templateId, templates]);

  async function collectRecipients(): Promise<{ email: string; name?: string; contact_id?: string; variables?: Record<string, unknown> }[]> {
    if (sourceType === "paste") {
      const set = new Set<string>();
      const list: { email: string }[] = [];
      pastedEmails.split(/[\s,;\n]+/).map(s => s.trim().toLowerCase()).forEach(e => {
        if (e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !set.has(e)) { set.add(e); list.push({ email: e }); }
      });
      return list;
    }
    if (sourceType === "contacts_all") {
      const { data } = await supabase.from("contacts").select("id,name,email").not("email", "is", null).limit(10000);
      return (data ?? [])
        .filter((c: { email: string | null }) => !!c.email)
        .map((c: { id: string; name: string | null; email: string | null }) => ({ email: c.email!, name: c.name ?? undefined, contact_id: c.id, variables: { name: c.name, nome: c.name } }));
    }
    if (sourceType === "form" && formId) {
      const { data } = await supabase.from("form_submissions")
        .select("contact_id, data, contact:contacts(id,name,email)")
        .eq("form_id", formId).limit(10000);
      const out: { email: string; name?: string; contact_id?: string; variables?: Record<string, unknown> }[] = [];
      const seen = new Set<string>();
      for (const s of (data ?? []) as { contact_id: string | null; data: Record<string, unknown>; contact: { id: string; name: string | null; email: string | null } | null }[]) {
        const email = (s.contact?.email ?? (s.data?.email as string | undefined) ?? "").toLowerCase().trim();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        out.push({ email, name: s.contact?.name ?? (s.data?.name as string | undefined), contact_id: s.contact?.id, variables: { name: s.contact?.name, nome: s.contact?.name, ...s.data } });
      }
      return out;
    }
    if (sourceType === "broadcast" && listId) {
      const { data } = await supabase.from("broadcast_list_contacts")
        .select("contact:contacts(id,name,email)")
        .eq("list_id", listId).limit(10000);
      const out: { email: string; name?: string; contact_id?: string; variables?: Record<string, unknown> }[] = [];
      const seen = new Set<string>();
      for (const r of (data ?? []) as { contact: { id: string; name: string | null; email: string | null } | null }[]) {
        const email = r.contact?.email?.toLowerCase().trim();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        out.push({ email, name: r.contact?.name ?? undefined, contact_id: r.contact?.id, variables: { name: r.contact?.name, nome: r.contact?.name } });
      }
      return out;
    }
    return [];
  }

  async function submit(startNow: boolean) {
    if (!name.trim() || !channelId || !subject.trim() || !bodyHtml.trim()) {
      toast.error("Preencha nome, canal, assunto e corpo"); return;
    }
    setSaving(true);
    try {
      const recipients = await collectRecipients();
      if (recipients.length === 0) { toast.error("Nenhum destinatário válido"); setSaving(false); return; }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) { toast.error("Não autenticado"); setSaving(false); return; }
      const { data: campaignOrgId } = await supabase.rpc("resolve_user_organization_id", { _user_id: user.user.id });

      const { data: campaign, error: cErr } = await supabase.from("email_campaigns").insert({
        organization_id: campaignOrgId, user_id: user.user.id, name, channel_id: channelId,
        template_id: templateId || null, subject, body_html: bodyHtml,
        design_json: design as never,
        attachments: attachments as never,
        source_type: sourceType, source_config: { formId, listId },
        batch_size: batchSize, batch_interval_seconds: batchInterval,
        status: startNow ? "running" : "draft",
        started_at: startNow ? new Date().toISOString() : null,
        stats: { total: recipients.length, pending: recipients.length, sent: 0, failed: 0, sending: 0 },
      }).select().single();
      if (cErr || !campaign) throw cErr ?? new Error("falha ao criar");

      // Insert recipients in batches of 500
      for (let i = 0; i < recipients.length; i += 500) {
        const slice = recipients.slice(i, i + 500).map(r => ({
          campaign_id: campaign.id, organization_id: campaignOrgId as string, email: r.email,
          name: r.name ?? null, contact_id: r.contact_id ?? null,
          variables: (r.variables ?? {}) as never, status: "pending",
        }));
        const { error: rErr } = await supabase.from("email_campaign_recipients").insert(slice);
        if (rErr) throw rErr;
      }

      toast.success(`Campanha criada com ${recipients.length} destinatário(s)`);
      onOpenChange(false);
      setName(""); setSubject(""); setBodyHtml(""); setPastedEmails(""); setAttachments([]); setDesign(null);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar campanha");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova campanha de e-mail</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome da campanha</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Canal de envio</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="Escolher canal Gmail" /></SelectTrigger>
              <SelectContent>{channels.map(c => <SelectItem key={c.id} value={c.id}>{c.email_address}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div><Label>Template (opcional)</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Escolher template" /></SelectTrigger>
              <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div><Label>Assunto</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Use {{nome}} para variáveis" />
          </div>

          <div>
            <Label>Conteúdo do e-mail</Label>
            <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as "visual" | "html")} className="mt-1">
              <TabsList>
                <TabsTrigger value="visual">Editor visual (mala direta)</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
              </TabsList>
              <TabsContent value="visual" className="mt-3">
                <VisualEmailDesigner value={design} subject={subject}
                  onChange={(d, html) => { setDesign(d); setBodyHtml(html); }} />
              </TabsContent>
              <TabsContent value="html" className="mt-3">
                <Textarea rows={10} value={bodyHtml} onChange={e => { setBodyHtml(e.target.value); setDesign(null); }} placeholder="<p>Olá {{nome}}, ...</p>" />
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground mt-1">Variáveis: {"{{nome}}"}, {"{{email}}"} e campos do contato/formulário.</p>
          </div>

          <div>
            <Label>Anexos</Label>
            <EmailAttachmentsField organizationId={orgId} value={attachments} onChange={setAttachments} />
          </div>


          <div><Label>Origem dos destinatários</Label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as typeof sourceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paste">Colar lista de e-mails</SelectItem>
                <SelectItem value="form">Formulário / QR code</SelectItem>
                <SelectItem value="broadcast">Lista de transmissão</SelectItem>
                <SelectItem value="contacts_all">Todos os contatos com e-mail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sourceType === "paste" && (
            <div><Label>E-mails (um por linha ou separados por vírgula)</Label>
              <Textarea rows={5} value={pastedEmails} onChange={e => setPastedEmails(e.target.value)} />
            </div>
          )}
          {sourceType === "form" && (
            <div><Label>Formulário</Label>
              <Select value={formId} onValueChange={setFormId}>
                <SelectTrigger><SelectValue placeholder="Escolher formulário" /></SelectTrigger>
                <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {sourceType === "broadcast" && (
            <div><Label>Lista</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger><SelectValue placeholder="Escolher lista" /></SelectTrigger>
                <SelectContent>{lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Lote por minuto</Label>
              <Input type="number" min={1} max={200} value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} />
            </div>
            <div><Label>Intervalo entre lotes (segundos)</Label>
              <Input type="number" min={10} value={batchInterval} onChange={e => setBatchInterval(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={saving}>Salvar rascunho</Button>
          <Button onClick={() => submit(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Criar e iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignDetailDialog({ campaign, onClose, onChanged }: {
  campaign: Campaign | null; onClose: () => void; onChanged: () => void;
}) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!campaign) return;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, filter]);

  async function load() {
    if (!campaign) return;
    setLoading(true);
    let q = supabase.from("email_campaign_recipients").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(500);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRecipients((data ?? []) as Recipient[]);
    setLoading(false);
    onChanged();
  }

  const stats = campaign?.stats || {};
  const total = useMemo(() => (stats.total as number) || 0, [stats]);

  return (
    <Dialog open={!!campaign} onOpenChange={(b) => !b && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{campaign?.name}</DialogTitle>
        </DialogHeader>
        {campaign && (
          <>
            <div className="grid grid-cols-4 gap-2 text-center">
              <StatCard label="Total" value={total} />
              <StatCard label="Enviados" value={(stats.sent as number) || 0} tone="success" />
              <StatCard label="Pendentes" value={(stats.pending as number) || 0} />
              <StatCard label="Falhas" value={(stats.failed as number) || 0} tone="destructive" />
            </div>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="failed">Falharam</SelectItem>
                  <SelectItem value="sending">Enviando</SelectItem>
                </SelectContent>
              </Select>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card border-b">
                  <tr><th className="text-left p-2">E-mail</th><th className="text-left p-2">Status</th><th className="text-left p-2">Quando</th><th className="text-left p-2">Erro</th></tr>
                </thead>
                <tbody>
                  {recipients.map(r => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-2">{r.email}{r.name ? ` · ${r.name}` : ""}</td>
                      <td className="p-2">
                        <Badge variant={
                          r.status === "sent" ? "default" :
                          r.status === "failed" ? "destructive" :
                          r.status === "sending" ? "secondary" : "outline"
                        }>{r.status}</Badge>
                      </td>
                      <td className="p-2 text-muted-foreground">{r.sent_at ? formatDistanceToNow(new Date(r.sent_at), { addSuffix: true, locale: ptBR }) : ""}</td>
                      <td className="p-2 text-destructive truncate max-w-xs">{r.error_message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recipients.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sem destinatários neste filtro.</div>}
            </ScrollArea>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone === "success" ? "text-primary" : tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
    </Card>
  );
}

function TemplateDialog({ open, onOpenChange, template, onSaved }: {
  open: boolean; onOpenChange: (b: boolean) => void; template: Template | null; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [design, setDesign] = useState<EmailDesign | null>(null);
  const [attachments, setAttachments] = useState<EmailAttachmentMeta[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<"visual" | "html">("visual");

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setSubject(template?.subject ?? "");
    setBodyHtml(template?.body_html ?? "");
    setDesign((template?.design_json as EmailDesign | null) ?? null);
    setAttachments((template?.attachments as EmailAttachmentMeta[] | null) ?? []);
    setEditorTab(template?.design_json ? "visual" : (template?.body_html ? "html" : "visual"));
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: o } = await supabase.rpc("resolve_user_organization_id", { _user_id: data.user.id });
      setOrgId(o as string | null);
    });
  }, [open, template]);

  async function save() {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) { toast.error("Preencha nome, assunto e corpo"); return; }
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setSaving(false); return; }
    const payload = {
      name, subject, body_html: bodyHtml,
      design_json: design as never,
      attachments: attachments as never,
    };
    if (template) {
      const { error } = await supabase.from("email_templates").update(payload).eq("id", template.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("email_templates").insert({ ...payload, organization_id: orgId, created_by: user.user.id });
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    toast.success("Template salvo");
    setSaving(false); onOpenChange(false); onSaved();
  }

  async function remove() {
    if (!template) return;
    if (!confirm("Excluir template?")) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", template.id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); onOpenChange(false); onSaved(); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{template ? "Editar template" : "Novo template"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Assunto</Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Use {{nome}} para variáveis" /></div>
          </div>

          <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as "visual" | "html")}>
            <TabsList>
              <TabsTrigger value="visual">Editor visual (mala direta)</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
            </TabsList>
            <TabsContent value="visual" className="mt-3">
              <VisualEmailDesigner value={design} subject={subject}
                onChange={(d, html) => { setDesign(d); setBodyHtml(html); }} />
            </TabsContent>
            <TabsContent value="html" className="mt-3">
              <Textarea rows={14} value={bodyHtml} onChange={e => { setBodyHtml(e.target.value); setDesign(null); }} placeholder="<p>Olá {{nome}}...</p>" />
              <p className="text-xs text-muted-foreground mt-1">Alterar o HTML manualmente descarta o design visual.</p>
            </TabsContent>
          </Tabs>

          <div>
            <Label>Anexos</Label>
            <EmailAttachmentsField organizationId={orgId} value={attachments} onChange={setAttachments} />
          </div>
        </div>
        <DialogFooter className="justify-between">
          {template ? <Button variant="destructive" onClick={remove}>Excluir</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
