import { useState, useEffect } from "react";
import { StickyNote, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Conversation } from "@/hooks/useConversations";

interface LeadPanelNotesProps {
  conversation: Conversation;
}

export const LeadPanelNotes = ({ conversation }: LeadPanelNotesProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(conversation.contact?.notes || "");
  const queryClient = useQueryClient();

  useEffect(() => {
    setNotes(conversation.contact?.notes || "");
  }, [conversation.contact?.notes]);

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ notes })
        .eq('id', conversation.contact_id);
      
      if (error) throw error;
      
      setIsEditing(false);
      toast.success("Notas salvas");
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      toast.error("Erro ao salvar notas");
    }
  };

  return (
    <div className="px-3 py-2 border-t border-border/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Notas</span>
        </div>
        {!isEditing && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Adicionar notas..."
            rows={3}
            className="text-sm resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setIsEditing(false)}>
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" className="h-7" onClick={handleSave}>
              <Check className="h-3 w-3 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground line-clamp-3">
          {notes || "Sem notas"}
        </p>
      )}
    </div>
  );
};
