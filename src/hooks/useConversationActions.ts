import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const useConversationActions = () => {
  const queryClient = useQueryClient();

  const archiveConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ status: 'archived' })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa arquivada');
    },
    onError: () => {
      toast.error('Erro ao arquivar conversa');
    }
  });

  const closeConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ status: 'closed' })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa fechada');
    },
    onError: () => {
      toast.error('Erro ao fechar conversa');
    }
  });

  const reopenConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa reaberta');
    },
    onError: () => {
      toast.error('Erro ao reabrir conversa');
    }
  });

  const unarchiveConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa desarquivada');
    }
  });

  const togglePinConversation = useMutation({
    mutationFn: async ({ conversationId, isPinned }: { conversationId: string; isPinned: boolean }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ is_pinned: !isPinned })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(variables.isPinned ? 'Conversa desafixada' : 'Conversa fixada no topo');
    },
    onError: () => {
      toast.error('Erro ao fixar conversa');
    }
  });

  const markAsUnread = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 1 })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Marcada como não lida');
    }
  });

  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir conversa');
    }
  });

  const exportConversation = async (conversationId: string, contactName: string, contactPhone: string) => {
    try {
      toast.info('Exportando conversa...');

      // Fetch all messages for the conversation
      const { data: messages, error } = await supabase
        .from('inbox_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!messages || messages.length === 0) {
        toast.error('Nenhuma mensagem para exportar');
        return;
      }

      // Format the export content
      const now = new Date();
      const exportDate = format(now, "dd/MM/yyyy HH:mm", { locale: ptBR });
      
      let content = `Conversa com: ${contactName || 'Contato Desconhecido'}\n`;
      content += `Telefone: ${contactPhone}\n`;
      content += `Exportado em: ${exportDate}\n`;
      content += `Total de mensagens: ${messages.length}\n`;
      content += '\n---\n\n';

      messages.forEach((msg) => {
        const msgDate = format(new Date(msg.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
        const sender = msg.direction === 'outgoing' ? 'Você' : (contactName || 'Contato');
        const msgType = msg.message_type !== 'text' ? ` [${msg.message_type}]` : '';
        content += `[${msgDate}] ${sender}${msgType}: ${msg.content}\n`;
        if (msg.media_url) {
          content += `  📎 Mídia: ${msg.media_url}\n`;
        }
      });

      // Create and download the file
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `conversa_${contactPhone.replace(/\D/g, '')}_${format(now, 'yyyyMMdd_HHmmss')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Conversa exportada com sucesso!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar conversa');
    }
  };

  const mergeConversations = useMutation({
    mutationFn: async ({ keepConversationId, mergeConversationId, contactUpdates }: { keepConversationId: string; mergeConversationId: string; contactUpdates?: Record<string, any> }) => {
      // 0. Apply selected field values to the keep contact if provided
      if (contactUpdates && Object.keys(contactUpdates).length > 0) {
        const { data: keepConv } = await supabase
          .from('conversations')
          .select('contact_id')
          .eq('id', keepConversationId)
          .single();

        if (keepConv?.contact_id) {
          const { error: updateError } = await supabase
            .from('contacts')
            .update(contactUpdates)
            .eq('id', keepConv.contact_id);

          if (updateError) throw updateError;
        }
      }

      // 1. Count messages before moving to verify later
      const { count: beforeCount } = await supabase
        .from('inbox_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', mergeConversationId);

      // 2. Move all messages from mergeConversation to keepConversation
      const { error: msgError } = await supabase
        .from('inbox_messages')
        .update({ conversation_id: keepConversationId })
        .eq('conversation_id', mergeConversationId);

      if (msgError) throw msgError;

      // 3. Verify messages were actually moved (protect against silent RLS failures)
      if (beforeCount && beforeCount > 0) {
        const { count: remainingCount } = await supabase
          .from('inbox_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', mergeConversationId);

        if (remainingCount && remainingCount > 0) {
          throw new Error(`Falha ao mover ${remainingCount} mensagens. Unificação cancelada para preservar o histórico.`);
        }
      }

      // 4. Move notes
      const { error: notesError } = await supabase
        .from('conversation_notes')
        .update({ conversation_id: keepConversationId })
        .eq('conversation_id', mergeConversationId);

      if (notesError) throw notesError;

      // 5. Move tasks
      const { error: tasksError } = await supabase
        .from('conversation_tasks')
        .update({ conversation_id: keepConversationId })
        .eq('conversation_id', mergeConversationId);

      if (tasksError) throw tasksError;

      // 5.1 Move funnel deals linked to the merged conversation
      const { error: dealsError } = await supabase
        .from('funnel_deals')
        .update({ conversation_id: keepConversationId })
        .eq('conversation_id', mergeConversationId);

      if (dealsError) throw dealsError;

      // 6. Move voip calls
      await supabase
        .from('voip_calls')
        .update({ conversation_id: keepConversationId })
        .eq('conversation_id', mergeConversationId);

      // 7. Move AI phone calls
      await supabase
        .from('ai_phone_calls')
        .update({ conversation_id: keepConversationId })
        .eq('conversation_id', mergeConversationId);

      // 8. Move tag assignments
      const { data: existingTags } = await supabase
        .from('conversation_tag_assignments')
        .select('tag_id')
        .eq('conversation_id', keepConversationId);

      const existingTagIds = new Set((existingTags || []).map(t => t.tag_id));

      const { data: mergeTags } = await supabase
        .from('conversation_tag_assignments')
        .select('tag_id')
        .eq('conversation_id', mergeConversationId);

      for (const tag of (mergeTags || [])) {
        if (!existingTagIds.has(tag.tag_id)) {
          await supabase
            .from('conversation_tag_assignments')
            .update({ conversation_id: keepConversationId })
            .eq('conversation_id', mergeConversationId)
            .eq('tag_id', tag.tag_id);
        }
      }

      await supabase
        .from('conversation_tag_assignments')
        .delete()
        .eq('conversation_id', mergeConversationId);

      // 9. Update last_message_at on keepConversation to reflect the latest message
      const { data: latestMsg } = await supabase
        .from('inbox_messages')
        .select('created_at')
        .eq('conversation_id', keepConversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestMsg) {
        await supabase
          .from('conversations')
          .update({ 
            last_message_at: latestMsg.created_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', keepConversationId);
      }

      // 10. Delete the merged conversation (only after all data safely moved)
      const { error: deleteError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', mergeConversationId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast.success('Conversas unificadas com sucesso! Todo o histórico foi preservado.');
    },
    onError: (error) => {
      console.error('Merge error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao unificar conversas');
    }
  });

  return {
    archiveConversation,
    unarchiveConversation,
    closeConversation,
    reopenConversation,
    togglePinConversation,
    markAsUnread,
    deleteConversation,
    exportConversation,
    mergeConversations
  };
};
