import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TemplateVariation {
  id: string;
  template_id: string;
  content: string;
  variation_index: number;
  created_at: string;
}

export const useTemplateVariations = (templateId?: string) => {
  const queryClient = useQueryClient();

  const variationsQuery = useQuery({
    queryKey: ['template-variations', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      
      const { data, error } = await supabase
        .from('template_variations')
        .select('*')
        .eq('template_id', templateId)
        .order('variation_index', { ascending: true });

      if (error) throw error;
      return data as TemplateVariation[];
    },
    enabled: !!templateId
  });

  const generateMutation = useMutation({
    mutationFn: async ({ templateId, content, variationCount }: { 
      templateId: string; 
      content: string;
      variationCount: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-template-variations', {
        body: { templateId, content, variationCount }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['template-variations', variables.templateId] });
      queryClient.invalidateQueries({ queryKey: ['template-variations-count'] });
      toast.success('Variações geradas com sucesso!');
    },
    onError: (error) => {
      console.error('Generate variations error:', error);
      toast.error('Erro ao gerar variações: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (variationId: string) => {
      const { error } = await supabase
        .from('template_variations')
        .delete()
        .eq('id', variationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-variations'] });
      queryClient.invalidateQueries({ queryKey: ['template-variations-count'] });
      toast.success('Variação excluída!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir variação: ' + error.message);
    }
  });

  const deleteAllMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('template_variations')
        .delete()
        .eq('template_id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-variations'] });
      queryClient.invalidateQueries({ queryKey: ['template-variations-count'] });
      toast.success('Todas as variações foram excluídas!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir variações: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ variationId, content }: { variationId: string; content: string }) => {
      const { error } = await supabase
        .from('template_variations')
        .update({ content })
        .eq('id', variationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-variations'] });
      toast.success('Variação atualizada!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar variação: ' + error.message);
    }
  });

  return {
    variations: variationsQuery.data || [],
    isLoading: variationsQuery.isLoading,
    generateVariations: generateMutation.mutate,
    deleteVariation: deleteMutation.mutate,
    deleteAllVariations: deleteAllMutation.mutate,
    updateVariation: updateMutation.mutate,
    isGenerating: generateMutation.isPending,
    isDeleting: deleteMutation.isPending || deleteAllMutation.isPending,
    isUpdating: updateMutation.isPending
  };
};

// Hook to get variation counts for multiple templates
export const useTemplateVariationsCounts = (templateIds: string[]) => {
  return useQuery({
    queryKey: ['template-variations-count', templateIds],
    queryFn: async () => {
      if (templateIds.length === 0) return {};

      const { data, error } = await supabase
        .from('template_variations')
        .select('template_id')
        .in('template_id', templateIds);

      if (error) throw error;

      // Count variations per template
      const counts: Record<string, number> = {};
      data?.forEach(v => {
        counts[v.template_id] = (counts[v.template_id] || 0) + 1;
      });

      return counts;
    },
    enabled: templateIds.length > 0
  });
};
