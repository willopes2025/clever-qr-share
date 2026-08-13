import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Indica se a conta do usuário logado (ou do dono da organização dele) está ativa.
 * Contas inativas têm os formulários públicos desativados automaticamente.
 */
export const useAccountActive = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["account-active", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_account_active", { _user_id: user!.id });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isAccountActive: data !== false,
    isLoading,
  };
};
