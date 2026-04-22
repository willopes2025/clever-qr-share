import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSdrConversations, useSdrScope, SdrConversation } from "@/hooks/useSdrConversations";
import { MessageView } from "@/components/inbox/MessageView";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, Search, Building2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Generate a stable HSL color per organization id
const orgColor = (id?: string | null) => {
  if (!id) return "hsl(var(--muted))";
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 70% 45%)`;
};

const SdrInbox = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: scope } = useSdrScope();
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState<string | null>(null); // "instance:<id>" | "meta:<phoneId>"
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo(() => {
    const f: { organizationId?: string | null; instanceId?: string | null; metaPhoneNumberId?: string | null } = {
      organizationId: orgFilter,
    };
    if (originFilter?.startsWith("instance:")) f.instanceId = originFilter.split(":")[1];
    if (originFilter?.startsWith("meta:")) f.metaPhoneNumberId = originFilter.split(":")[1];
    return f;
  }, [orgFilter, originFilter]);

  const { data: conversations = [], isLoading, refetch } = useSdrConversations(filters);

  // Realtime: refetch on conversation/message changes
  useEffect(() => {
    const channel = supabase
      .channel("sdr-inbox-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_messages" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      (c) =>
        c.contact?.name?.toLowerCase().includes(q) ||
        c.contact?.phone?.toLowerCase().includes(q) ||
        c.last_message_preview?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const selected = useMemo(
    () => filteredConversations.find((c) => c.id === selectedId) || null,
    [filteredConversations, selectedId]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Topbar */}
      <header className="h-14 border-b bg-card flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2 mr-4">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">SDR Inbox</p>
            <p className="text-xs text-muted-foreground leading-tight">
              {scope?.organizations.length ?? 0} empresas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-3xl">
          <Select value={orgFilter ?? "all"} onValueChange={(v) => setOrgFilter(v === "all" ? null : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {scope?.organizations.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={originFilter ?? "all"} onValueChange={(v) => setOriginFilter(v === "all" ? null : v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Número de origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os números</SelectItem>
              {scope?.instances.map((i) => (
                <SelectItem key={i.id} value={`instance:${i.id}`}>
                  <span className="inline-flex items-center gap-2">
                    <Smartphone className="h-3 w-3" /> {i.instance_name}
                    {i.phone_number ? ` · ${i.phone_number}` : ""}
                  </span>
                </SelectItem>
              ))}
              {scope?.metaNumbers.map((m) => (
                <SelectItem key={m.id} value={`meta:${m.phone_number_id}`}>
                  <span className="inline-flex items-center gap-2">
                    Meta · {m.display_phone_number}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground hidden md:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Conversation list */}
        <aside className="w-80 border-r bg-card overflow-y-auto shrink-0">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && filteredConversations.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
          )}
          {filteredConversations.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              isSelected={c.id === selectedId}
              onSelect={() => setSelectedId(c.id)}
            />
          ))}
        </aside>

        {/* Message view */}
        <main className="flex-1 min-w-0 flex flex-col">
          {selected ? (
            <>
              {/* Context banner */}
              <div
                className="px-4 py-2 text-xs flex items-center gap-2 border-b"
                style={{
                  background: `${orgColor(selected.organization_id)}20`,
                  borderLeftColor: orgColor(selected.organization_id),
                  borderLeftWidth: 4,
                }}
              >
                <Building2 className="h-3 w-3" />
                <span>
                  Respondendo como{" "}
                  <strong>{selected.organization_name || "Empresa"}</strong>
                  {selected.instance_id && (
                    <>
                      {" "}via{" "}
                      <strong>
                        {scope?.instances.find((i) => i.id === selected.instance_id)?.instance_name ||
                          "instância"}
                      </strong>
                    </>
                  )}
                  {selected.meta_phone_number_id && (
                    <>
                      {" "}via Meta{" "}
                      <strong>
                        {scope?.metaNumbers.find((m) => m.phone_number_id === selected.meta_phone_number_id)
                          ?.display_phone_number || ""}
                      </strong>
                    </>
                  )}
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <MessageView conversation={selected as any} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

interface ItemProps {
  conversation: SdrConversation;
  isSelected: boolean;
  onSelect: () => void;
}

const ConversationItem = ({ conversation, isSelected, onSelect }: ItemProps) => {
  const initial = conversation.contact?.name?.charAt(0)?.toUpperCase() || "?";
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 border-b hover:bg-muted/50 transition-colors flex gap-3",
        isSelected && "bg-muted"
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        {conversation.contact?.avatar_url && <AvatarImage src={conversation.contact.avatar_url} />}
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm truncate">
            {conversation.contact?.name || conversation.contact?.phone || "Sem nome"}
          </p>
          {conversation.last_message_at && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(conversation.last_message_at), {
                addSuffix: false,
                locale: ptBR,
              })}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {conversation.last_message_preview || "Sem mensagens"}
        </p>
        <div className="flex items-center gap-1 mt-1">
          {conversation.organization_name && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 h-5"
              style={{
                borderColor: orgColor(conversation.organization_id),
                color: orgColor(conversation.organization_id),
              }}
            >
              {conversation.organization_name}
            </Badge>
          )}
          {conversation.unread_count > 0 && (
            <Badge className="ml-auto h-5 min-w-5 px-1 text-[10px]">{conversation.unread_count}</Badge>
          )}
        </div>
      </div>
    </button>
  );
};

export default SdrInbox;
