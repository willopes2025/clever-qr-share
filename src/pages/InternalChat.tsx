import { useState, useEffect, useRef, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User, MessageSquare, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  profile?: { full_name: string | null; avatar_url: string | null };
}

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  contact_id: string | null;
  conversation_id: string | null;
  profile?: { full_name: string | null; avatar_url: string | null };
}

const InternalChat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch team members
  const { data: members = [] } = useQuery({
    queryKey: ['internal-chat-members'],
    queryFn: async () => {
      if (!user) return [];
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('id, user_id, role')
        .eq('status', 'active');

      if (!teamMembers || teamMembers.length === 0) return [];

      const userIds = teamMembers.map(m => m.user_id).filter(Boolean) as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return teamMembers
        .filter(m => m.user_id && m.user_id !== user.id)
        .map(m => ({
          ...m,
          profile: profileMap.get(m.user_id!) || null,
        })) as TeamMember[];
    },
    enabled: !!user,
  });

  // Fetch messages for selected member (using internal_messages table with no conversation/contact filter - direct messages)
  const { data: messages_list = [], refetch: refetchMessages } = useQuery({
    queryKey: ['internal-direct-messages', user?.id, selectedMemberId],
    queryFn: async () => {
      if (!user || !selectedMemberId) return [];
      
      // Get the selected member's user_id
      const member = members.find(m => m.id === selectedMemberId);
      if (!member?.user_id) return [];

      // Fetch messages between the two users (no conversation/contact context)
      const { data, error } = await supabase
        .from('internal_messages')
        .select('*')
        .is('conversation_id', null)
        .is('contact_id', null)
        .or(`user_id.eq.${user.id},user_id.eq.${member.user_id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Filter to only messages between these two users (mentions-based targeting)
      const filtered = (data || []).filter(m => {
        if (m.user_id === user.id && m.mentions?.includes(member.user_id)) return true;
        if (m.user_id === member.user_id && m.mentions?.includes(user.id)) return true;
        return false;
      });

      // Fetch profiles
      const userIds = [...new Set(filtered.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return filtered.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      })) as ChatMessage[];
    },
    enabled: !!user && !!selectedMemberId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user || !selectedMemberId) return;
    const channel = supabase
      .channel(`internal-dm-${selectedMemberId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' }, () => {
        refetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedMemberId, refetchMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages_list]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !selectedMemberId) throw new Error('No user or member selected');
      const member = members.find(m => m.id === selectedMemberId);
      if (!member?.user_id) throw new Error('Member not found');

      const { error } = await supabase.from('internal_messages').insert({
        user_id: user.id,
        content,
        mentions: [member.user_id],
        source: 'web',
        conversation_id: null,
        contact_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      refetchMessages();
    },
    onError: () => toast.error('Erro ao enviar mensagem'),
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message.trim());
  };

  const filteredMembers = members.filter(m =>
    !searchTerm || m.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedMember = members.find(m => m.id === selectedMemberId);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar - Members list */}
        <div className="w-72 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground mb-3">Chat Interno</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar membro..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum membro encontrado</p>
            ) : (
              filteredMembers.map(member => (
                <button
                  key={member.id}
                  onClick={() => setSelectedMemberId(member.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left",
                    selectedMemberId === member.id && "bg-accent"
                  )}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {member.profile?.full_name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.profile?.full_name || 'Sem nome'}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {selectedMember ? (
            <>
              {/* Header */}
              <div className="h-14 border-b border-border flex items-center gap-3 px-4 bg-card">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={selectedMember.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {selectedMember.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{selectedMember.profile?.full_name || 'Sem nome'}</span>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages_list.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-12">
                      <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Nenhuma mensagem ainda. Inicie a conversa!
                    </div>
                  ) : messages_list.map(msg => {
                    const isMe = msg.user_id === user?.id;
                    return (
                      <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[70%] rounded-xl px-4 py-2",
                          isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        )}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={cn("text-[10px] mt-1", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>
                            {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card">
                <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                  <Input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!message.trim() || sendMessageMutation.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione um membro para iniciar uma conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InternalChat;
