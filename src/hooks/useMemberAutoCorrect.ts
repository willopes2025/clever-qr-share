import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMemberAutoCorrect = () => {
  const { user } = useAuth();

  const { data: autoCorrectEnabled = false, isLoading } = useQuery({
    queryKey: ['member-auto-correct', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      // Buscar se o usuário é membro de alguma organização com auto_correct_enabled
      const { data: member, error } = await supabase
        .from('team_members')
        .select('auto_correct_enabled')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Erro ao verificar auto_correct:', error);
        return false;
      }

      return member?.auto_correct_enabled ?? false;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  return { autoCorrectEnabled, isLoading };
};
