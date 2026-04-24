import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface FieldRequiredRule {
  id: string;
  field_definition_id: string;
  funnel_id: string;
  from_stage_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Regras de obrigatoriedade por funil/etapa para campos personalizados.
 * Cada regra define que, em determinado funil, o campo se torna obrigatório
 * a partir da etapa especificada (inclusive) com base no display_order.
 */
export const useFieldRequiredRules = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['field-required-rules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_field_required_rules')
        .select('*');
      if (error) throw error;
      return (data || []) as FieldRequiredRule[];
    },
    enabled: !!user,
  });

  const upsertRule = useMutation({
    mutationFn: async (rule: { field_definition_id: string; funnel_id: string; from_stage_id: string; id?: string }) => {
      // Como UNIQUE(field_definition_id, funnel_id), fazemos delete+insert para simplificar
      await supabase
        .from('custom_field_required_rules')
        .delete()
        .eq('field_definition_id', rule.field_definition_id)
        .eq('funnel_id', rule.funnel_id);

      const { data, error } = await supabase
        .from('custom_field_required_rules')
        .insert({
          field_definition_id: rule.field_definition_id,
          funnel_id: rule.funnel_id,
          from_stage_id: rule.from_stage_id,
          user_id: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-required-rules'] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar regra: " + e.message),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_field_required_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-required-rules'] });
    },
    onError: (e: Error) => toast.error("Erro ao remover regra: " + e.message),
  });

  return { rules: rules || [], isLoading, upsertRule, deleteRule };
};
