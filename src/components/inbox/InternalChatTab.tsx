import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useInternalMessages, InternalMessage } from "@/hooks/useInternalMessages";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Send, Users, Trash2, ChevronDown, User } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InternalChatTabProps {
  conversationId: string | null;
  contactId: string | null;
}

export const InternalChatTab = ({ conversationId, contactId }: InternalChatTabProps) => {
  const { user } = useAuth();
  const { members } = useTeamMembers();
  const { messages, isLoading, sendMessage, deleteMessage } = useInternalMessages(conversationId, contactId);
  const [newMessage, setNewMessage] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out current user from members list
  const otherMembers = members?.filter(m => m.user_id !== user?.id && m.status === 'active') || [];

  const selectedMember = otherMembers.find(m => m.user_id === selectedMemberId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    await sendMessage.mutateAsync({ 
      content: newMessage.trim(),
      targetMemberId: selectedMemberId 
    });
    setNewMessage("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMessage.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, "HH:mm", { locale: ptBR });
    }
    if (isYesterday(date)) {
      return `Ontem ${format(date, "HH:mm", { locale: ptBR })}`;
    }
    return format(date, "dd/MM HH:mm", { locale: ptBR });
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Users className="h-12 w-12 mb-2 opacity-50" />
            <p>Nenhuma mensagem interna</p>
            <p className="text-sm text-center">
              Converse com sua equipe sobre este contato
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isOwn = msg.user_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    isOwn ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {getInitials(msg.profile?.full_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "flex flex-col max-w-[70%]",
                      isOwn ? "items-end" : "items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {isOwn ? "Você" : msg.profile?.full_name || "Membro"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageDate(msg.created_at)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "px-3 py-2 rounded-lg group relative",
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      {isOwn && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDeleteId(msg.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={selectedMemberId ? "default" : "outline"} 
                size="sm"
                className="shrink-0 gap-1"
              >
                {selectedMember ? (
                  <>
                    <User className="h-4 w-4" />
                    <span className="max-w-[80px] truncate">{selectedMember.profile?.full_name?.split(' ')[0]}</span>
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    <span>Todos</span>
                  </>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setSelectedMemberId(null)}>
                <Users className="h-4 w-4 mr-2" />
                Todos da equipe
              </DropdownMenuItem>
              {otherMembers.map((member) => (
                <DropdownMenuItem 
                  key={member.user_id} 
                  onClick={() => setSelectedMemberId(member.user_id)}
                >
                  <User className="h-4 w-4 mr-2" />
                  {member.profile?.full_name || member.email}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Input
            ref={inputRef}
            placeholder={selectedMember 
              ? `Mensagem para ${selectedMember.profile?.full_name?.split(' ')[0]}...`
              : "Digite uma mensagem interna..."
            }
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {selectedMember 
            ? `Apenas ${selectedMember.profile?.full_name?.split(' ')[0]} receberá esta mensagem`
            : "Apenas membros da equipe podem ver essas mensagens"
          }
        </p>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
