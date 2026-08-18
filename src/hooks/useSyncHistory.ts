import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SyncJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_chats: number;
  processed_chats: number;
  messages_imported: number;
  contacts_created: number;
  conversations_created: number;
  chats_with_errors: number;
  error_message: string | null;
  chats_source: string | null;
}

interface StartResult {
  success?: boolean;
  jobId?: string;
  totalChats?: number;
  alreadyRunning?: boolean;
  message?: string;
  evolutionError?: string;
  evolutionWarning?: string;
  error?: string;
}

export function useSyncHistory() {
  const [progress, setProgress] = useState(0);
  const [job, setJob] = useState<SyncJob | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollJob = (jobId: string) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      const { data, error } = await supabase
        .from('message_sync_jobs')
        .select('id, status, total_chats, processed_chats, messages_imported, contacts_created, conversations_created, chats_with_errors, error_message, chats_source')
        .eq('id', jobId)
        .maybeSingle();

      if (error || !data) return;

      const current = data as SyncJob;
      setJob(current);
      setProgress(
        current.total_chats > 0
          ? Math.min(99, Math.round((current.processed_chats / current.total_chats) * 100))
          : 10
      );

      if (current.status === 'completed') {
        stopPolling();
        setProgress(100);
        toast.success(
          `Sincronização concluída! ${current.messages_imported} mensagens e ${current.contacts_created} novos contatos importados${current.chats_with_errors > 0 ? ` (${current.chats_with_errors} conversas com erro)` : ''}.`,
          { duration: 8000 }
        );
        window.setTimeout(() => setProgress(0), 1500);
      } else if (current.status === 'failed') {
        stopPolling();
        setProgress(0);
        toast.error(current.error_message || 'A sincronização falhou. Tente novamente.', { duration: 10000 });
      }
    }, 3000);
  };

  const syncHistoryMutation = useMutation({
    mutationFn: async ({
      instanceName,
      startDate,
      userId,
    }: {
      instanceName: string;
      startDate: string;
      userId: string;
    }): Promise<StartResult> => {
      setProgress(5);
      setJob(null);

      const { data, error } = await supabase.functions.invoke('sync-message-history', {
        body: { action: 'start', instanceName, startDate, userId },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao iniciar a sincronização');
      }

      return data as StartResult;
    },
    onSuccess: (data: StartResult) => {
      if (data.evolutionError) {
        setProgress(0);
        toast.error(data.evolutionError, { duration: 10000 });
        return;
      }
      if (data.error) {
        setProgress(0);
        toast.error(data.error, { duration: 10000 });
        return;
      }
      if (!data.jobId) {
        setProgress(0);
        toast.error('Não foi possível iniciar a sincronização.');
        return;
      }

      if (data.alreadyRunning) {
        toast.info(data.message || 'Sincronização já em andamento. Acompanhando o progresso...');
      } else {
        toast.success(
          `Sincronização iniciada em segundo plano (${data.totalChats ?? 0} conversas). Você pode continuar usando o sistema.`,
          { duration: 6000 }
        );
      }
      setProgress(10);
      pollJob(data.jobId);
    },
    onError: (error: Error) => {
      stopPolling();
      toast.error(error.message || 'Erro ao sincronizar histórico');
      setProgress(0);
    },
  });

  return {
    syncHistory: syncHistoryMutation,
    progress,
    job,
    isSyncing: syncHistoryMutation.isPending || (!!job && (job.status === 'pending' || job.status === 'running')),
  };
}
