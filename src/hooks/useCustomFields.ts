import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CustomFieldDefinition {
  id: string;
  user_id: string;
  field_name: string;
  field_key: string;
  field_type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  options: string[];
  is_required: boolean;
  display_order: number;
  created_at: string;
}

export const useCustomFields = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: fieldDefinitions, isLoading } = useQuery({
    queryKey: ['custom-field-definitions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as CustomFieldDefinition[];
    },
    enabled: !!user,
  });

  const createField = useMutation({
    mutationFn: async (field: Omit<CustomFieldDefinition, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .insert({
          ...field,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
      toast.success("Campo criado com sucesso");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar campo: " + error.message);
    },
  });

  const updateField = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomFieldDefinition> & { id: string }) => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
      toast.success("Campo atualizado");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar campo: " + error.message);
    },
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
      toast.success("Campo removido");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover campo: " + error.message);
    },
  });

  const updateContactCustomFields = useMutation({
    mutationFn: async ({ contactId, customFields }: { contactId: string; customFields: Record<string, any> }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ custom_fields: customFields })
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar campos: " + error.message);
    },
  });

  return {
    fieldDefinitions,
    isLoading,
    createField,
    updateField,
    deleteField,
    updateContactCustomFields,
  };
};
