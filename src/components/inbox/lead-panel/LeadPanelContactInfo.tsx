import { Phone, Calendar, MessageSquare, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Conversation } from "@/hooks/useConversations";
import { formatForDisplay } from "@/lib/phone-utils";
import { toast } from "sonner";

interface LeadPanelContactInfoProps {
  conversation: Conversation;
}

export const LeadPanelContactInfo = ({ conversation }: LeadPanelContactInfoProps) => {
  const contactPhone = conversation.contact?.phone || "";

  const copyPhone = () => {
    navigator.clipboard.writeText(contactPhone);
    toast.success("Telefone copiado");
  };

  return (
    <div className="px-3 py-2 border-t border-border/30 space-y-2">
      {/* Phone */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{formatForDisplay(contactPhone)}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyPhone}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      {/* First Conversation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span>Primeira conversa: {format(new Date(conversation.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
      </div>

      {/* Last Message */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MessageSquare className="h-3 w-3" />
        <span>
          Última mensagem: {conversation.last_message_at 
            ? format(new Date(conversation.last_message_at), "dd/MM 'às' HH:mm", { locale: ptBR })
            : "Nenhuma"}
        </span>
      </div>
    </div>
  );
};
