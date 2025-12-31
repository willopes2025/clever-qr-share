import { useState } from "react";
import { ChevronLeft, MoreVertical, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactIdBadge } from "@/components/contacts/ContactIdBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Conversation } from "@/hooks/useConversations";

interface LeadPanelHeaderProps {
  conversation: Conversation;
  onClose?: () => void;
  isMobile?: boolean;
}

export const LeadPanelHeader = ({ conversation, onClose, isMobile }: LeadPanelHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const queryClient = useQueryClient();

  const contactName = conversation.contact?.name || "Sem nome";
  const contactDisplayId = (conversation.contact as any)?.contact_display_id;

  const handleSaveName = async () => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ name: editedName.trim() || null })
        .eq('id', conversation.contact_id);
      
      if (error) throw error;
      
      setIsEditing(false);
      toast.success("Nome atualizado");
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (error) {
      toast.error("Erro ao atualizar nome");
    }
  };

  const startEditing = () => {
    setEditedName(conversation.contact?.name || "");
    setIsEditing(true);
  };

  return (
    <div className="p-3 border-b border-border/50 shrink-0">
      <div className="flex items-center gap-2">
        {(isMobile || onClose) && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="h-8 text-base font-semibold"
                placeholder="Nome do contato"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSaveName}>
                <Check className="h-4 w-4 text-primary" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold truncate">{contactName}</h3>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100" 
                onClick={startEditing}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          {contactDisplayId && (
            <ContactIdBadge displayId={contactDisplayId} className="mt-0.5" />
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={startEditing}>
              <Edit2 className="h-4 w-4 mr-2" />
              Editar nome
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
