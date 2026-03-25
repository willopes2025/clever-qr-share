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
    mutationFn: async ({ keepConversationId, mergeConversationId }: { keepConversationId: string; mergeConversationId: string }) => {
      // Move all messages from mergeConversation to keepConversation
      const { error: msgError } = await supabase
        .from('inbox_messages')
        .update({ conversation_id: keepConversationId })
        .eq('conversation_id', mergeConversationId);

      if (msgError) throw msgError;

      // Move notes
      await supabase
        .from('conversation_notes')
        .update({ conversation_id: keepConversationId })
        .eq('conversation_id', mergeConversationId);

      // Move tasks
      await supabase
        .from('conversation_tasks')
        .update({ conversation_id: keepConversationId })
        .eq('conversation_id', mergeConversationId);

      // Move tag assignments
      const { data: existingTags } = await supabase
        .from('conversation_tag_assignments')
        .select('tag_id')
        .eq('conversation_id', keepConversationId);

      const existingTagIds = new Set((existingTags || []).map(t => t.tag_id));

      const { data: mergeTags } = await supabase
        .from('conversation_tag_assignments')
        .select('tag_id')
        .eq('conversation_id', mergeConversationId);

      // Add non-duplicate tags
      for (const tag of (mergeTags || [])) {
        if (!existingTagIds.has(tag.tag_id)) {
          await supabase
            .from('conversation_tag_assignments')
            .update({ conversation_id: keepConversationId })
            .eq('conversation_id', mergeConversationId)
            .eq('tag_id', tag.tag_id);
        }
      }

      // Delete remaining tag assignments from merged conversation
      await supabase
        .from('conversation_tag_assignments')
        .delete()
        .eq('conversation_id', mergeConversationId);

      // Delete the merged conversation
      const { error: deleteError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', mergeConversationId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast.success('Conversas unificadas com sucesso!');
    },
    onError: (error) => {
      console.error('Merge error:', error);
      toast.error('Erro ao unificar conversas');
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
