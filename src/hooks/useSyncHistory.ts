import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncResult {
  success: boolean;
  synced?: {
    chats: number;
    messages: number;
    contacts: number;
    conversations: number;
  };
  error?: string;
}

export function useSyncHistory() {
  const [progress, setProgress] = useState(0);

  const syncHistoryMutation = useMutation({
    mutationFn: async ({ 
      instanceName, 
      startDate,
      userId,
    }: { 
      instanceName: string; 
      startDate: string;
      userId: string;
    }): Promise<SyncResult> => {
      setProgress(10);

      const { data, error } = await supabase.functions.invoke('sync-message-history', {
        body: { instanceName, startDate, userId },
      });

      setProgress(100);

      if (error) {
        throw new Error(error.message || 'Erro ao sincronizar histórico');
      }

      return data as SyncResult;
    },
    onSuccess: (data: SyncResult & { evolutionError?: string; evolutionWarning?: string }) => {
      if (data.success === false && data.evolutionError) {
        toast.error(data.evolutionError, { duration: 10000 });
      } else if (data.success && data.synced) {
        const warn = data.evolutionWarning;
        toast.success(
          `Sincronização concluída! ${data.synced.messages} mensagens, ${data.synced.contacts} novos contatos importados.${warn ? ' (Aviso: usado fallback porque Evolution falhou)' : ''}`,
          { duration: warn ? 10000 : 5000 }
        );
      }
      setProgress(0);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao sincronizar histórico');
      setProgress(0);
    },
  });

  return {
    syncHistory: syncHistoryMutation,
    progress,
    isSyncing: syncHistoryMutation.isPending,
  };
}
