import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FunnelDeal } from "./useFunnels";

const DEALS_PER_PAGE = 50;

export interface StageDealCounts {
  [stageId: string]: number;
}

export interface StageLoadedCounts {
  [stageId: string]: number;
}

// Hook to fetch deal counts per stage (uses RPC for accurate counts beyond 1000 limit)
export const useStageDealCounts = (funnelId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['stage-deal-counts', funnelId],
    queryFn: async (): Promise<StageDealCounts> => {
      if (!funnelId) return {};
      
      // Use RPC for aggregated count (bypasses 1000 record limit)
      const { data, error } = await supabase
        .rpc('get_stage_deal_counts', { p_funnel_id: funnelId });

      if (error) throw error;

      // Convert array to object
      const counts: StageDealCounts = {};
      (data || []).forEach((row: { stage_id: string; deal_count: number }) => {
        counts[row.stage_id] = row.deal_count;
      });

      return counts;
    },
    enabled: !!user?.id && !!funnelId
  });
};

// Hook to load more deals for a specific stage
export const useLoadMoreDeals = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      stageId, 
      funnelId, 
      offset 
    }: { 
      stageId: string; 
      funnelId: string; 
      offset: number;
    }): Promise<FunnelDeal[]> => {
      const { data, error } = await supabase
        .from('funnel_deals')
        .select(`
          *,
          contact:contacts(id, name, phone, email),
          close_reason:funnel_close_reasons(*)
        `)
        .eq('stage_id', stageId)
        .eq('funnel_id', funnelId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + DEALS_PER_PAGE - 1);

      if (error) throw error;
      return data as FunnelDeal[];
    },
    onSuccess: (newDeals, { stageId, funnelId }) => {
      // Append new deals to the existing funnels cache
      queryClient.setQueryData(['funnels', user?.id], (old: unknown[] | undefined) => {
        if (!old) return old;
        
        return old.map((funnel: { id: string; stages?: { id: string; deals?: FunnelDeal[] }[] }) => {
          if (funnel.id !== funnelId) return funnel;
          
          return {
            ...funnel,
            stages: funnel.stages?.map((stage) => {
              if (stage.id !== stageId) return stage;
              
              // Filter out duplicates and append
              const existingIds = new Set((stage.deals || []).map((d: FunnelDeal) => d.id));
              const uniqueNewDeals = newDeals.filter((d) => !existingIds.has(d.id));
              
              return {
                ...stage,
                deals: [...(stage.deals || []), ...uniqueNewDeals]
              };
            })
          };
        });
      });
    }
  });
};

export { DEALS_PER_PAGE };
