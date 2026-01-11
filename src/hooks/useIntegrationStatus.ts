import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { invokeFunctionWithAuth } from "@/lib/supabase-functions";

interface IntegrationStatus {
  asaas: boolean;
  ssotica: boolean;
}

export const useIntegrationStatus = () => {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['integration-status', user?.id],
    queryFn: async (): Promise<IntegrationStatus> => {
      const { data, error } = await invokeFunctionWithAuth<IntegrationStatus>('integration-status');
      
      if (error) {
        console.error('[useIntegrationStatus] Error:', error);
        throw error;
      }
      
      return {
        asaas: data?.asaas ?? false,
        ssotica: data?.ssotica ?? false,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  return {
    hasAsaas: data?.asaas ?? false,
    hasSsotica: data?.ssotica ?? false,
    isLoading,
    error,
    refetch,
  };
};
