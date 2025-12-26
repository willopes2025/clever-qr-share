import { useState, useMemo } from "react";
import { ArrowRightLeft, Search, User, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface TransferConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactName: string;
  onTransferred?: () => void;
}

export const TransferConversationDialog = ({
  open,
  onOpenChange,
  conversationId,
  contactName,
  onTransferred,
}: TransferConversationDialogProps) => {
  const { user } = useAuth();
  const { members, isLoading } = useTeamMembers();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Filter active members with user_id, excluding current user
  const availableMembers = useMemo(() => {
    if (!members) return [];
    return members.filter(
      (member) =>
        member.status === "active" &&
        member.user_id &&
        member.user_id !== user?.id
    );
  }, [members, user?.id]);

  // Filter by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return availableMembers;
    const query = searchQuery.toLowerCase();
    return availableMembers.filter(
      (member) =>
        member.email.toLowerCase().includes(query) ||
        member.profile?.full_name?.toLowerCase().includes(query)
    );
  }, [availableMembers, searchQuery]);

  const handleTransfer = async () => {
    if (!selectedMemberId) return;

    const selectedMember = availableMembers.find(
      (m) => m.user_id === selectedMemberId
    );
    if (!selectedMember) return;

    setIsTransferring(true);
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ user_id: selectedMemberId })
        .eq("id", conversationId);

      if (error) throw error;

      toast.success(
        `Conversa transferida para ${selectedMember.profile?.full_name || selectedMember.email}`
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onOpenChange(false);
      onTransferred?.();
    } catch (error) {
      console.error("Error transferring conversation:", error);
      toast.error("Erro ao transferir conversa");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transferir Conversa
          </DialogTitle>
          <DialogDescription>
            Transferir conversa com <strong>{contactName}</strong> para outro
            membro da equipe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Members List */}
          <ScrollArea className="h-[300px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <User className="h-8 w-8 mb-2" />
                <p className="text-sm text-center">
                  {searchQuery
                    ? "Nenhum membro encontrado"
                    : "Nenhum membro disponível para transferência"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMembers.map((member) => {
                  const isSelected = selectedMemberId === member.user_id;
                  const displayName = member.profile?.full_name || member.email;
                  const initials = displayName.charAt(0).toUpperCase();

                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMemberId(member.user_id!)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback
                          className={cn(
                            "text-sm font-medium",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          member.role === "admin"
                            ? "border-primary/30 text-primary"
                            : ""
                        )}
                      >
                        {member.role === "admin" ? "Admin" : "Membro"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isTransferring}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!selectedMemberId || isTransferring}
              className="gap-2"
            >
              {isTransferring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              Transferir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
