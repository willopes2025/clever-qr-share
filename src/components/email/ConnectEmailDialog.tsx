import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onConnected: () => void;
}

type Step = "choose" | "imap";

const PRESETS: Record<string, { label: string; imap_host: string; imap_port: number; smtp_host: string; smtp_port: number }> = {
  outlook: { label: "Outlook / Office 365", imap_host: "outlook.office365.com", imap_port: 993, smtp_host: "smtp.office365.com", smtp_port: 587 },
  yahoo: { label: "Yahoo", imap_host: "imap.mail.yahoo.com", imap_port: 993, smtp_host: "smtp.mail.yahoo.com", smtp_port: 465 },
  icloud: { label: "iCloud", imap_host: "imap.mail.me.com", imap_port: 993, smtp_host: "smtp.mail.me.com", smtp_port: 587 },
  zoho: { label: "Zoho", imap_host: "imap.zoho.com", imap_port: 993, smtp_host: "smtp.zoho.com", smtp_port: 465 },
  uol: { label: "UOL", imap_host: "imap.uol.com.br", imap_port: 993, smtp_host: "smtps.uol.com.br", smtp_port: 465 },
  locaweb: { label: "Locaweb", imap_host: "imap.locaweb.com.br", imap_port: 993, smtp_host: "email-ssl.com.br", smtp_port: 465 },
  hostgator: { label: "HostGator / cPanel", imap_host: "mail.seudominio.com", imap_port: 993, smtp_host: "mail.seudominio.com", smtp_port: 465 },
};

export function ConnectEmailDialog({ open, onOpenChange, onConnected }: Props) {
  const [step, setStep] = useState<Step>("choose");
  const [loading, setLoading] = useState(false);

  // IMAP form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [imapSecure, setImapSecure] = useState(true);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecure, setSmtpSecure] = useState(true);

  function reset() {
    setStep("choose");
    setEmail(""); setPassword(""); setDisplayName("");
    setImapHost(""); setImapPort(993); setImapSecure(true);
    setSmtpHost(""); setSmtpPort(465); setSmtpSecure(true);
  }

  function applyPreset(key: string) {
    const p = PRESETS[key];
    if (!p) return;
    setImapHost(p.imap_host); setImapPort(p.imap_port); setImapSecure(true);
    setSmtpHost(p.smtp_host); setSmtpPort(p.smtp_port); setSmtpSecure(true);
  }

  async function startOAuth(fn: "email-oauth-start" | "email-oauth-start-microsoft", label: string) {
    const popup = window.open("about:blank", "email-oauth", "width=520,height=720");
    if (!popup) { toast.error("Permita pop-ups para conectar"); return; }
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === "gmail-oauth") {
        window.removeEventListener("message", handler);
        setTimeout(() => { onConnected(); onOpenChange(false); }, 800);
        if (ev.data.ok) toast.success(`${label} conectado!`);
      }
    };
    window.addEventListener("message", handler);
    const { data, error } = await supabase.functions.invoke(fn);
    if (error || !data?.auth_url) {
      window.removeEventListener("message", handler);
      popup.close();
      toast.error(error?.message ?? `falha ao iniciar ${label}`);
      return;
    }
    popup.location.href = data.auth_url;
    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll);
        window.removeEventListener("message", handler);
        onConnected();
      }
    }, 1000);
  }

  async function submitImap() {
    if (!email || !password || !imapHost || !smtpHost) {
      toast.error("Preencha e-mail, senha e servidores");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("email-connect-imap", {
      body: {
        email, password, display_name: displayName || email,
        imap_host: imapHost, imap_port: imapPort, imap_secure: imapSecure,
        smtp_host: smtpHost, smtp_port: smtpPort, smtp_secure: smtpSecure,
      },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Falha ao conectar");
      return;
    }
    toast.success("Conta conectada!");
    reset();
    onConnected();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(b) => { onOpenChange(b); if (!b) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === "choose" ? "Conectar conta de e-mail" : "Configurar IMAP / SMTP"}</DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="grid gap-3">
            <Card className="p-4 cursor-pointer hover:bg-accent transition" onClick={() => startOAuth("email-oauth-start", "Gmail")}>
              <div className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-red-500" />
                <div>
                  <div className="font-medium">Google / Gmail</div>
                  <div className="text-xs text-muted-foreground">Login rápido via OAuth</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 cursor-pointer hover:bg-accent transition" onClick={() => startOAuth("email-oauth-start-microsoft", "Microsoft")}>
              <div className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-blue-500" />
                <div>
                  <div className="font-medium">Microsoft / Outlook / Office 365</div>
                  <div className="text-xs text-muted-foreground">Login via conta Microsoft</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 cursor-pointer hover:bg-accent transition" onClick={() => setStep("imap")}>
              <div className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-primary" />
                <div>
                  <div className="font-medium">Outro provedor (IMAP / SMTP)</div>
                  <div className="text-xs text-muted-foreground">Yahoo, iCloud, Zoho, UOL, domínio próprio…</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {step === "imap" && (
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label className="text-xs">Preset rápido</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(PRESETS).map(([k, p]) => (
                  <Button key={k} variant="outline" size="sm" onClick={() => applyPreset(k)}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>Senha (ou senha de app)</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <div><Label>Nome de exibição</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Opcional" /></div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label>Servidor IMAP</Label><Input value={imapHost} onChange={e => setImapHost(e.target.value)} /></div>
              <div><Label>Porta</Label><Input type="number" value={imapPort} onChange={e => setImapPort(Number(e.target.value))} /></div>
            </div>
            <div className="flex items-center gap-2 text-sm"><Switch checked={imapSecure} onCheckedChange={setImapSecure} />IMAP com SSL/TLS</div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label>Servidor SMTP</Label><Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} /></div>
              <div><Label>Porta</Label><Input type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))} /></div>
            </div>
            <div className="flex items-center gap-2 text-sm"><Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} />SMTP com SSL/TLS</div>

            <p className="text-xs text-muted-foreground">
              💡 Contas Gmail/Outlook/Yahoo com verificação em 2 etapas exigem uma <strong>senha de app</strong> gerada nas configurações do provedor.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "imap" && (
            <>
              <Button variant="outline" onClick={() => setStep("choose")}>Voltar</Button>
              <Button onClick={submitImap} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Conectar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
