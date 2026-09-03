import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatDateTimeFull } from "@/lib/date-utils";
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
      const exportDate = formatDateTimeFull(now.toISOString());
      
      let content = `Conversa com: ${contactName || 'Contato Desconhecido'}\n`;
      content += `Telefone: ${contactPhone}\n`;
      content += `Exportado em: ${exportDate}\n`;
      content += `Total de mensagens: ${messages.length}\n`;
      content += '\n---\n\n';

      messages.forEach((msg) => {
        const msgDate = formatDateTimeFull(msg.created_at);
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
      // Executa via edge function com service role: as políticas RLS impedem
      // mover mensagens de conversas atribuídas a outro usuário (carteira).
      const { data, error } = await supabase.functions.invoke('merge-leads', {
        body: { mode: 'conversations', keepConversationId, mergeConversationId, contactUpdates, deleteMerged: true },
      });
      if (error) throw new Error((data as { error?: string } | null)?.error || error.message);
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
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
