import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User, MessageSquare, Search, Plus, Users, X, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
  profile?: { full_name: string | null; avatar_url: string | null };
}

interface ChatGroup {
  id: string;
  name: string;
  avatar_url: string | null;
  created_by: string;
  member_count?: number;
}

type ChatTarget = { type: 'member'; id: string } | { type: 'group'; id: string };

const InternalChat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<ChatTarget | null>(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch read status for all chats
  const { data: readStatuses = [] } = useQuery({
    queryKey: ['internal-chat-read-status', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('internal_chat_read_status')
        .select('target_type, target_id, last_read_at')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Mark chat as read
  const markAsRead = async (target: ChatTarget) => {
    if (!user) return;
    const targetId = target.type === 'member'
      ? members.find(m => m.id === target.id)?.user_id || target.id
      : target.id;
    await supabase
      .from('internal_chat_read_status')
      .upsert({
        user_id: user.id,
        target_type: target.type,
        target_id: targetId,
        last_read_at: new Date().toISOString(),
      }, { onConflict: 'user_id,target_type,target_id' });
    queryClient.invalidateQueries({ queryKey: ['internal-chat-read-status'] });
  };

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

  // Fetch groups
  const { data: groups = [], refetch: refetchGroups } = useQuery({
    queryKey: ['internal-chat-groups'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('internal_chat_groups')
        .select('*, internal_chat_group_members(count)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((g: any) => ({
        ...g,
        member_count: g.internal_chat_group_members?.[0]?.count || 0,
      })) as ChatGroup[];
    },
    enabled: !!user,
  });

  // Fetch messages based on target
  const { data: messages_list = [], refetch: refetchMessages } = useQuery({
    queryKey: ['internal-direct-messages', user?.id, selectedTarget?.type, selectedTarget?.id],
    queryFn: async () => {
      if (!user || !selectedTarget) return [];

      if (selectedTarget.type === 'group') {
        const { data, error } = await supabase
          .from('internal_group_messages')
          .select('*')
          .eq('group_id', selectedTarget.id)
          .order('created_at', { ascending: true });
        if (error) throw error;

        const userIds = [...new Set((data || []).map(m => m.user_id))];
        const { data: profiles } = userIds.length > 0
          ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
          : { data: [] };
        const profileMap = new Map((profiles || []).map(p => [p.id, p] as const));

        return (data || []).map(m => ({
          ...m,
          profile: profileMap.get(m.user_id) || null,
        })) as ChatMessage[];
      }

      // DM logic
      const member = members.find(m => m.id === selectedTarget.id);
      if (!member?.user_id) return [];

      const { data, error } = await supabase
        .from('internal_messages')
        .select('*')
        .is('conversation_id', null)
        .is('contact_id', null)
        .or(`user_id.eq.${user.id},user_id.eq.${member.user_id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const filtered = (data || []).filter(m => {
        if (m.user_id === user.id && m.mentions?.includes(member.user_id)) return true;
        if (m.user_id === member.user_id && m.mentions?.includes(user.id)) return true;
        return false;
      });

      const userIds = [...new Set(filtered.map(m => m.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map(p => [p.id, p] as const));

      return filtered.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      })) as ChatMessage[];
    },
    enabled: !!user && !!selectedTarget,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user || !selectedTarget) return;
    const table = selectedTarget.type === 'group' ? 'internal_group_messages' : 'internal_messages';
    const channel = supabase
      .channel(`internal-chat-${selectedTarget.type}-${selectedTarget.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, () => {
        refetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedTarget, refetchMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages_list]);

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !selectedTarget) throw new Error('No target');

      if (selectedTarget.type === 'group') {
        const { error } = await supabase.from('internal_group_messages').insert({
          user_id: user.id,
          group_id: selectedTarget.id,
          content,
        });
        if (error) throw error;
      } else {
        const member = members.find(m => m.id === selectedTarget.id);
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
      }
    },
    onSuccess: () => {
      setMessage("");
      refetchMessages();
    },
    onError: () => toast.error('Erro ao enviar mensagem'),
  });

  // Create group
  const createGroupMutation = useMutation({
    mutationFn: async () => {
      if (!user || !groupName.trim() || selectedMemberIds.length === 0) throw new Error('Invalid');

      const { data: group, error } = await supabase
        .from('internal_chat_groups')
        .insert({ name: groupName.trim(), created_by: user.id })
        .select()
        .single();
      if (error) throw error;

      // Add creator + selected members
      const membersToAdd = [user.id, ...selectedMemberIds].map(uid => ({
        group_id: group.id,
        user_id: uid,
        role: uid === user.id ? 'admin' : 'member',
      }));

      const { error: membersError } = await supabase
        .from('internal_chat_group_members')
        .insert(membersToAdd);
      if (membersError) throw membersError;

      return group;
    },
    onSuccess: (group) => {
      toast.success('Grupo criado!');
      setShowCreateGroup(false);
      setGroupName("");
      setSelectedMemberIds([]);
      refetchGroups();
      setSelectedTarget({ type: 'group', id: group.id });
    },
    onError: () => toast.error('Erro ao criar grupo'),
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message.trim());
  };

  const toggleMemberSelection = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredMembers = members.filter(m =>
    !searchTerm || m.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groups.filter(g =>
    !searchTerm || g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedMember = selectedTarget?.type === 'member' ? members.find(m => m.id === selectedTarget.id) : null;
  const selectedGroup = selectedTarget?.type === 'group' ? groups.find(g => g.id === selectedTarget.id) : null;

  const chatHeaderName = selectedMember
    ? selectedMember.profile?.full_name || 'Sem nome'
    : selectedGroup?.name || '';

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">Chat Interno</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCreateGroup(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {/* Groups */}
            {filteredGroups.length > 0 && (
              <div>
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Grupos</p>
                {filteredGroups.map(group => (
                  <button
                    key={`g-${group.id}`}
                    onClick={() => setSelectedTarget({ type: 'group', id: group.id })}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left",
                      selectedTarget?.type === 'group' && selectedTarget.id === group.id && "bg-accent"
                    )}
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.member_count} membros</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Members */}
            <div>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Membros</p>
              {filteredMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro</p>
              ) : (
                filteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedTarget({ type: 'member', id: member.id })}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left",
                      selectedTarget?.type === 'member' && selectedTarget.id === member.id && "bg-accent"
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
            </div>
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {selectedTarget ? (
            <>
              {/* Header */}
              <div className="h-14 border-b border-border flex items-center gap-3 px-4 bg-card">
                {selectedGroup ? (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                ) : (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedMember?.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {selectedMember?.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="font-medium text-foreground">{chatHeaderName}</span>
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
                        {!isMe && selectedGroup && (
                          <Avatar className="h-6 w-6 mr-2 mt-1 shrink-0">
                            <AvatarImage src={msg.profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-muted text-[10px]">
                              {msg.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn(
                          "max-w-[70%] rounded-xl px-4 py-2",
                          isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        )}>
                          {!isMe && selectedGroup && (
                            <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.profile?.full_name || 'Usuário'}</p>
                          )}
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
                <p className="text-sm">Selecione um membro ou grupo para iniciar uma conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do grupo</Label>
              <Input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Ex: Equipe de Vendas"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Membros</Label>
              <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                {selectedMemberIds.map(uid => {
                  const m = members.find(m => m.user_id === uid);
                  return (
                    <Badge key={uid} variant="secondary" className="gap-1">
                      {m?.profile?.full_name || 'Sem nome'}
                      <button onClick={() => toggleMemberSelection(uid)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <ScrollArea className="h-48 border rounded-lg">
                {members.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMemberSelection(member.user_id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 hover:bg-accent/50 transition-colors text-left",
                      selectedMemberIds.includes(member.user_id) && "bg-accent/30"
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={member.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {member.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1">{member.profile?.full_name || 'Sem nome'}</span>
                    {selectedMemberIds.includes(member.user_id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroup(false)}>Cancelar</Button>
            <Button
              onClick={() => createGroupMutation.mutate()}
              disabled={!groupName.trim() || selectedMemberIds.length === 0 || createGroupMutation.isPending}
            >
              Criar Grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default InternalChat;
