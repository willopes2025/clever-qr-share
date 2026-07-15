import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Mail, RefreshCw, Plus, Loader2, Send, Trash2, Megaphone, Inbox as InboxIcon, SendHorizonal, Archive, Layers } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

interface EmailChannel {
  id: string; email_address: string; display_name: string | null;
  provider: string; status: string; last_synced_at: string | null;
}
interface EmailThread {
  id: string; subject: string | null; last_message_at: string | null;
  unread_count: number; channel_id: string; contact_id: string | null;
}
interface EmailMessage {
  id: string; direction: "inbound" | "outbound";
  from_address: string; from_name: string | null;
  to_addresses: string[]; subject: string | null;
  body_html: string | null; body_text: string | null;
  snippet: string | null; sent_at: string | null; received_at: string | null;
  is_read: boolean;
}

type FolderKey = "inbox" | "sent" | "archived" | "all";

const FOLDERS: { key: FolderKey; label: string; icon: any }[] = [
  { key: "inbox", label: "Caixa de entrada", icon: InboxIcon },
  { key: "sent", label: "Enviados", icon: SendHorizonal },
  { key: "archived", label: "Arquivados", icon: Archive },
  { key: "all", label: "Todos", icon: Layers },
];

export default function EmailPage() {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<EmailChannel[]>([]);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [folder, setFolder] = useState<FolderKey>("inbox");

  const activeChannel = useMemo(() => channels.find(c => c.status === "active") ?? null, [channels]);

  useEffect(() => { loadChannels(); }, []);
  useEffect(() => { if (activeChannel) loadThreads(activeChannel.id, folder); }, [activeChannel?.id, folder]);
  useEffect(() => { if (selectedThreadId) loadMessages(selectedThreadId); }, [selectedThreadId]);

  async function loadChannels() {
    setLoading(true);
    const { data, error } = await supabase.from("email_channels").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setChannels((data ?? []) as any);
    setLoading(false);
  }
  async function loadThreads(channelId: string, f: FolderKey) {
    let threadIds: string[] | null = null;
    if (f === "inbox" || f === "sent") {
      const dir = f === "inbox" ? "inbound" : "outbound";
      const { data: msgs } = await supabase.from("email_messages")
        .select("thread_id").eq("channel_id", channelId).eq("direction", dir).not("thread_id", "is", null).limit(2000);
      threadIds = Array.from(new Set((msgs ?? []).map((m: any) => m.thread_id).filter(Boolean)));
      if (threadIds.length === 0) { setThreads([]); return; }
    }
    let q = supabase.from("email_threads")
      .select("*").eq("channel_id", channelId).order("last_message_at", { ascending: false }).limit(100);
    if (f === "archived") q = q.eq("is_archived", true);
    else q = q.eq("is_archived", false);
    if (threadIds) q = q.in("id", threadIds);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setThreads((data ?? []) as any);
  }
  async function loadMessages(threadId: string) {
    const { data, error } = await supabase.from("email_messages")
      .select("*").eq("thread_id", threadId).order("sent_at", { ascending: true, nullsFirst: false });
    if (error) return toast.error(error.message);
    setMessages((data ?? []) as any);
    // mark read
    await supabase.from("email_messages").update({ is_read: true }).eq("thread_id", threadId).eq("is_read", false);
    await supabase.from("email_threads").update({ unread_count: 0 }).eq("id", threadId);
  }

  async function connectGmail() {
    // Open synchronously from the click event so browsers do not block it.
    const popup = window.open("about:blank", "gmail-oauth", "width=520,height=720");
    if (!popup) { toast.error("Permita pop-ups para conectar o Gmail"); return; }

    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === "gmail-oauth") {
        window.removeEventListener("message", handler);
        setTimeout(() => { loadChannels(); }, 800);
        if (ev.data.ok) toast.success("Gmail conectado!");
      }
    };
    window.addEventListener("message", handler);

    const { data, error } = await supabase.functions.invoke("email-oauth-start");
    if (error || !data?.auth_url) {
      window.removeEventListener("message", handler);
      popup.close();
      toast.error(error?.message ?? "falha ao iniciar OAuth");
      return;
    }

    popup.location.href = data.auth_url;

    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll);
        window.removeEventListener("message", handler);
        loadChannels();
      }
    }, 1000);
  }

  async function sync() {
    if (!activeChannel) return;
    setSyncing(true);
    const { error } = await supabase.functions.invoke("email-sync", { body: { channel_id: activeChannel.id } });
    setSyncing(false);
    if (error) toast.error(error.message);
    else { toast.success("Sincronizado"); loadThreads(activeChannel.id, folder); }
  }

  async function disconnect(id: string) {
    if (!confirm("Desconectar esta conta de e-mail?")) return;
    const { error } = await supabase.from("email_channels").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Desconectado"); loadChannels(); }
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5" />
            <h1 className="text-lg font-semibold">E-mail</h1>
            {activeChannel && (
              <Badge variant="secondary" className="ml-2">{activeChannel.email_address}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/email/campaigns">
              <Button variant="outline" size="sm">
                <Megaphone className="h-4 w-4 mr-2" />Campanhas
              </Button>
            </Link>
            {activeChannel && (
              <>
                <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2">Sincronizar</span>
                </Button>
                <Button size="sm" onClick={() => setComposeOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Novo e-mail
                </Button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : channels.length === 0 ? (
          <ConnectCard onConnect={connectGmail} />
        ) : (
          <div className="grid flex-1 grid-cols-[320px_1fr] overflow-hidden">
            {/* Thread list */}
            <div className="border-r border-border">
              <ScrollArea className="h-full">
                {threads.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nenhuma conversa. Clique em Sincronizar para buscar da caixa de entrada.
                  </div>
                ) : threads.map(t => (
                  <button key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`w-full text-left border-b border-border/50 p-3 hover:bg-accent/50 transition ${selectedThreadId === t.id ? "bg-accent" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium">{t.subject || "(sem assunto)"}</div>
                      {t.unread_count > 0 && <Badge variant="default" className="h-5 min-w-5 px-1.5">{t.unread_count}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t.last_message_at ? formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true, locale: ptBR }) : ""}
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </div>

            {/* Thread viewer */}
            <div className="overflow-hidden">
              {selectedThreadId ? (
                <ThreadView messages={messages} channel={activeChannel!} threadId={selectedThreadId}
                  onReplySent={() => { loadMessages(selectedThreadId); loadThreads(activeChannel!.id, folder); }} />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  Selecione uma conversa
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connected accounts list at bottom */}
        {channels.length > 0 && (
          <div className="border-t border-border p-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Contas conectadas:</span>
            {channels.map(c => (
              <div key={c.id} className="flex items-center gap-1">
                <Badge variant="outline" className="gap-2">
                  {c.email_address}
                  <button onClick={() => disconnect(c.id)} className="hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto" onClick={connectGmail}>
              <Plus className="h-3 w-3 mr-1" />Adicionar conta
            </Button>
          </div>
        )}
      </div>

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen}
        channel={activeChannel} onSent={() => { setComposeOpen(false); if (activeChannel) loadThreads(activeChannel.id, folder); }} />
    </DashboardLayout>
  );
}

function ConnectCard({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md p-8 text-center">
        <Mail className="h-12 w-12 mx-auto mb-4 text-primary" />
        <h2 className="text-xl font-semibold mb-2">Conecte seu e-mail</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Conecte uma conta Gmail para enviar e receber e-mails direto pelo Widezap.
          A conta fica disponível para toda a organização.
        </p>
        <Button onClick={onConnect} className="w-full">
          <Mail className="h-4 w-4 mr-2" />Conectar com Google
        </Button>
      </Card>
    </div>
  );
}

function ThreadView({ messages, channel, threadId, onReplySent }: {
  messages: EmailMessage[]; channel: EmailChannel; threadId: string; onReplySent: () => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const last = messages[messages.length - 1];

  async function sendReply() {
    if (!reply.trim() || !last) return;
    setSending(true);
    const to = last.direction === "inbound" ? [last.from_address] : last.to_addresses;
    const subject = last.subject?.startsWith("Re:") ? last.subject : `Re: ${last.subject ?? ""}`;
    const { error } = await supabase.functions.invoke("email-send", {
      body: { channel_id: channel.id, thread_id: threadId, to, subject, text: reply, html: `<p>${reply.replace(/\n/g, "<br/>")}</p>` },
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setReply(""); onReplySent(); toast.success("Enviado");
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {messages.map(m => (
            <Card key={m.id} className={`p-4 ${m.direction === "outbound" ? "bg-primary/5" : ""}`}>
              <div className="flex items-baseline justify-between text-xs text-muted-foreground mb-2">
                <div className="font-medium text-foreground">
                  {m.from_name ? `${m.from_name} <${m.from_address}>` : m.from_address}
                </div>
                <div>{m.sent_at || m.received_at ? new Date((m.sent_at || m.received_at)!).toLocaleString("pt-BR") : ""}</div>
              </div>
              <div className="text-xs text-muted-foreground mb-3">Para: {m.to_addresses.join(", ")}</div>
              {m.body_html ? (
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: m.body_html }} />
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-sans">{m.body_text ?? m.snippet}</pre>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t border-border p-4 space-y-2">
        <Textarea placeholder="Escreva uma resposta..." value={reply} onChange={e => setReply(e.target.value)} rows={3} />
        <div className="flex justify-end">
          <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Responder
          </Button>
        </div>
      </div>
    </div>
  );
}

function ComposeDialog({ open, onOpenChange, channel, onSent }: {
  open: boolean; onOpenChange: (b: boolean) => void; channel: EmailChannel | null; onSent: () => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!channel) return;
    const recipients = to.split(",").map(s => s.trim()).filter(Boolean);
    if (recipients.length === 0 || !subject.trim()) { toast.error("Preencha destinatário e assunto"); return; }
    setSending(true);
    const { error } = await supabase.functions.invoke("email-send", {
      body: { channel_id: channel.id, to: recipients, subject, text: body, html: `<p>${body.replace(/\n/g, "<br/>")}</p>` },
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("E-mail enviado");
    setTo(""); setSubject(""); setBody(""); onSent();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Novo e-mail</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>De</Label><Input value={channel?.email_address ?? ""} disabled /></div>
          <div><Label>Para (separe por vírgula)</Label><Input value={to} onChange={e => setTo(e.target.value)} placeholder="alguem@exemplo.com" /></div>
          <div><Label>Assunto</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div><Label>Mensagem</Label><Textarea rows={8} value={body} onChange={e => setBody(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
