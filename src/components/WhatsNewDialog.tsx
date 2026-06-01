import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Rotas públicas onde o popup NÃO deve aparecer (mesmo se houver sessão persistida)
const PUBLIC_ROUTES = ["/", "/login", "/reset-password", "/privacy-policy", "/terms-of-service", "/data-deletion", "/unsubscribe"];

function isPublicPath(pathname: string) {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/f/")) return true; // formulários públicos
  if (pathname.startsWith("/form/")) return true;
  if (pathname.startsWith("/public/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
}

const STORAGE_PREFIX = "widezap_seen_changelog_v1";

function parseChangelog(md: string): ChangelogEntry[] {
  // Strip HTML comments
  const cleaned = md.replace(/<!--[\s\S]*?-->/g, "");
  const lines = cleaned.split("\n");
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (current) entries.push(current);
      const title = match[1].trim();
      current = { id: title, title, body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) entries.push(current);
  return entries.map((e) => ({ ...e, body: e.body.trim() })).filter((e) => e.body.length > 0);
}

function renderBody(body: string) {
  // Very small markdown subset: bullets and **bold**
  const blocks: JSX.Element[] = [];
  const lines = body.split("\n");
  let listBuffer: string[] = [];
  const flushList = () => {
    if (listBuffer.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1.5 text-sm text-foreground">
          {listBuffer.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
    } else if (line === "") {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    }
  }
  flushList();
  return blocks;
}

function inlineFormat(s: string) {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-foreground">$1</code>');
}

export const WhatsNewDialog = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (typeof window !== "undefined" && isPublicPath(window.location.pathname)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/CHANGELOG.md?ts=${Date.now()}`);
        if (!res.ok) return;
        const md = await res.text();
        const parsed = parseChangelog(md);
        if (!parsed.length) return;

        const storageKey = `${STORAGE_PREFIX}_${user.id}`;
        let seen: string[] = [];
        try {
          seen = JSON.parse(localStorage.getItem(storageKey) || "[]");
        } catch {
          seen = [];
        }
        const unseen = parsed.filter((e) => !seen.includes(e.id));
        if (cancelled || unseen.length === 0) return;
        setEntries(parsed);
        setOpen(true);
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  const handleClose = () => {
    if (user) {
      const storageKey = `${STORAGE_PREFIX}_${user.id}`;
      const ids = entries.map((e) => e.id);
      localStorage.setItem(storageKey, JSON.stringify(ids));
    }
    setOpen(false);
  };

  if (!entries.length) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : setOpen(o))}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Novidades da plataforma
          </DialogTitle>
          <DialogDescription>
            Veja o que há de novo no Widezap desde a sua última visita.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-4">
          <div className="space-y-6">
            {entries.map((entry) => (
              <article key={entry.id} className="space-y-2 border-l-2 border-primary/40 pl-4">
                <h3 className="text-base font-semibold text-foreground">{entry.title}</h3>
                <div className="space-y-2">{renderBody(entry.body)}</div>
              </article>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleClose}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsNewDialog;
