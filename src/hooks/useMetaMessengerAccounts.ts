import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MetaMessengerAccount {
  id: string;
  page_id: string;
  page_name: string | null;
  page_category: string | null;
  ig_business_account_id: string | null;
  ig_username: string | null;
  profile_picture_url: string | null;
  platforms: string[] | null;
  status: string | null;
  webhook_subscribed: boolean | null;
  connected_at: string | null;
  last_sync_at: string | null;
}

export const useMetaMessengerAccounts = () => {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['meta-messenger-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_messenger_accounts')
        .select('*')
        .order('connected_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MetaMessengerAccount[];
    },
  });

  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meta_messenger_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conta desconectada');
      queryClient.invalidateQueries({ queryKey: ['meta-messenger-accounts'] });
    },
    onError: (e: any) => toast.error('Erro ao desconectar: ' + e.message),
  });

  return { accounts: accounts ?? [], isLoading, disconnect };
};
