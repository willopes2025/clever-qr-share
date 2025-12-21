import { useState } from "react";
import { X, Phone, Mail, StickyNote, Calendar, MessageSquare, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Conversation } from "@/hooks/useConversations";
import { TagSelector } from "./TagSelector";
import { formatForDisplay } from "@/lib/phone-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ContactInfoPanelProps {
  conversation: Conversation;
  isOpen: boolean;
  onClose: () => void;
}

export const ContactInfoPanel = ({ conversation, isOpen, onClose }: ContactInfoPanelProps) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const contactName = conversation.contact?.name;
  const contactPhone = conversation.contact?.phone || "";

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-l border-border bg-card overflow-hidden shrink-0"
        >
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Informações do Contato</h3>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col items-center mb-6">
                <Avatar className="h-20 w-20 mb-3">
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {getInitials(contactName)}
                  </AvatarFallback>
                </Avatar>
                <h4 className="text-lg font-semibold text-center">
                  {contactName || "Sem nome"}
                </h4>
                <Badge variant="secondary" className="mt-1">
                  {conversation.status === 'archived' ? 'Arquivada' : 'Ativa'}
                </Badge>
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium">
                      {formatForDisplay(contactPhone)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Primeira conversa</p>
                    <p className="text-sm font-medium">
                      {format(new Date(conversation.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Última mensagem</p>
                    <p className="text-sm font-medium">
                      {conversation.last_message_at 
                        ? format(new Date(conversation.last_message_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : "Nenhuma"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Tags</p>
                  <TagSelector conversationId={conversation.id} />
                </div>
              </div>

              <Separator className="my-4" />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Notas</p>
                  </div>
                  {!isEditingNotes && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(true)}>
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
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveNotes} className="flex-1">Salvar</Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingNotes(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{notes || "Sem notas"}</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};