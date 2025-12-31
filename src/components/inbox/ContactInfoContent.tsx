import { useState, useEffect } from "react";
import { Phone, StickyNote, Calendar, MessageSquare, Edit2, Check, X, Database, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Conversation } from "@/hooks/useConversations";
import { TagSelector } from "./TagSelector";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { CustomFieldsManager } from "./CustomFieldsManager";
import { formatForDisplay } from "@/lib/phone-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ContactIdBadge } from "@/components/contacts/ContactIdBadge";

interface ContactInfoContentProps {
  conversation: Conversation;
}

export const ContactInfoContent = ({ conversation }: ContactInfoContentProps) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(conversation.contact?.notes || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [hideEmptyFields, setHideEmptyFields] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    setNotes(conversation.contact?.notes || "");
  }, [conversation.contact?.notes]);

  const contactName = conversation.contact?.name;
  const contactPhone = conversation.contact?.phone || "";
  const contactDisplayId = (conversation.contact as any)?.contact_display_id;

  const handleSaveName = async () => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ name: editedName.trim() || null })
        .eq('id', conversation.contact_id);
      
      if (error) throw error;
      
      setIsEditingName(false);
      toast.success("Nome atualizado");
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (error) {
      toast.error("Erro ao atualizar nome");
    }
  };

  const startEditingName = () => {
    setEditedName(contactName || "");
    setIsEditingName(true);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleSaveNotes = async () => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ notes })
        .eq('id', conversation.contact_id);
      
      if (error) throw error;
      
      setIsEditingNotes(false);
      toast.success("Notas salvas");
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      toast.error("Erro ao salvar notas");
    }
  };

  return (
    <div className="space-y-4">
      {/* Avatar and Name */}
      <div className="flex flex-col items-center">
        <Avatar className="h-16 w-16 mb-2">
          <AvatarFallback className="text-xl bg-primary/10 text-primary">
            {getInitials(contactName)}
          </AvatarFallback>
        </Avatar>
        {isEditingName ? (
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="h-7 text-center w-36 text-sm"
              placeholder="Nome do contato"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveName}>
              <Check className="h-3 w-3 text-primary" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingName(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-1">
            <h4 className="text-base font-semibold text-center">
              {contactName || "Sem nome"}
            </h4>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={startEditingName}>
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}
        {contactDisplayId && (
          <ContactIdBadge displayId={contactDisplayId} className="mt-1" />
        )}
        <Badge variant="secondary" className="mt-1 text-xs">
          {conversation.status === 'archived' ? 'Arquivada' : 'Ativa'}
        </Badge>
      </div>

      <Separator />

      {/* Contact Details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Phone className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">Telefone</p>
            <p className="text-xs font-medium truncate">
              {formatForDisplay(contactPhone)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Calendar className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">Primeira conversa</p>
            <p className="text-xs font-medium">
              {format(new Date(conversation.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">Última mensagem</p>
            <p className="text-xs font-medium">
              {conversation.last_message_at 
                ? format(new Date(conversation.last_message_at), "dd/MM HH:mm", { locale: ptBR })
                : "Nenhuma"}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tags */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium">Tags</p>
          <TagSelector conversationId={conversation.id} />
        </div>
      </div>

      <Separator />

      {/* Custom Fields */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Dados do Lead</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => setHideEmptyFields(!hideEmptyFields)}
            >
              {hideEmptyFields ? (
                <>
                  <Eye className="h-3 w-3" />
                  Mostrar vazios
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3" />
                  Ocultar vazios
                </>
              )}
            </Button>
            <CustomFieldsManager />
          </div>
        </div>
        <CustomFieldsEditor 
          contactId={conversation.contact_id} 
          customFields={conversation.contact?.custom_fields || {}}
          hideEmptyFields={hideEmptyFields}
        />
      </div>

      <Separator />

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Notas</p>
          </div>
          {!isEditingNotes && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingNotes(true)}>
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {isEditingNotes ? (
          <div className="space-y-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicionar notas..."
              rows={3}
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveNotes} className="flex-1 h-7 text-xs">Salvar</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsEditingNotes(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{notes || "Sem notas"}</p>
        )}
      </div>
    </div>
  );
};
