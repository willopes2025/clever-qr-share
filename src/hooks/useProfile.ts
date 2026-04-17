import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user, session, isAuthenticatedStable } = useAuth();
  const queryClient = useQueryClient();
  const canQueryProfile = isAuthenticatedStable && !!user?.id && !!session?.access_token;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[useProfile] profile not found yet, skipping auto-create');
          return null;
        }
        throw error;
      }

      return data as Profile;
    },
    enabled: canQueryProfile,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'phone'>>) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updates,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Perfil atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    profile,
    isLoading,
    updateProfile,
  };
}
