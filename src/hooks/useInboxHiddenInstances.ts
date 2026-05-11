import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Per-user preference: which WhatsApp instances should NOT appear in the
 * Inbox for the current user. Used by the owner/admin to declutter their
 * own Inbox without affecting other team members.
 */
export const useInboxHiddenInstances = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: hiddenIds = [], isLoading } = useQuery({
    queryKey: ['inbox-hidden-instances', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_inbox_hidden_instances')
        .select('instance_id');
      if (error) throw error;
      return (data ?? []).map((r: { instance_id: string }) => r.instance_id);
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const setVisibility = useMutation({
    mutationFn: async ({ instanceId, visible }: { instanceId: string; visible: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      if (visible) {
        const { error } = await supabase
          .from('user_inbox_hidden_instances')
          .delete()
          .eq('user_id', user.id)
          .eq('instance_id', instanceId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_inbox_hidden_instances')
          .insert({ user_id: user.id, instance_id: instanceId });
        if (error && !error.message.includes('duplicate')) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-hidden-instances'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: Error) => toast.error('Erro ao salvar visibilidade: ' + e.message),
  });

  return { hiddenIds, hiddenSet: new Set(hiddenIds), isLoading, setVisibility };
};
