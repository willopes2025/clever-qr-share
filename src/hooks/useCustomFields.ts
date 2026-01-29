import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "time"
  | "datetime"
  | "boolean"
  | "switch"
  | "select"
  | "multi_select"
  | "url"
  | "phone"
  | "email";

export type EntityType = "contact" | "lead";

export interface CustomFieldDefinition {
  id: string;
  user_id: string;
  field_name: string;
  field_key: string;
  field_type: FieldType;
  options: string[];
  is_required: boolean;
  display_order: number;
  entity_type: EntityType;
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

  // Filter helpers for contact vs lead fields
  const contactFieldDefinitions = fieldDefinitions?.filter(f => f.entity_type === 'contact') || [];
  const leadFieldDefinitions = fieldDefinitions?.filter(f => f.entity_type === 'lead') || [];

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
      // Invalidate with refetchType 'all' to ensure immediate refetch in all components
      queryClient.invalidateQueries({ 
        queryKey: ['custom-field-definitions'],
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
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

  // New mutation for updating deal custom fields
  const updateDealCustomFields = useMutation({
    mutationFn: async ({ dealId, customFields }: { dealId: string; customFields: Record<string, any> }) => {
      const { error } = await supabase
        .from('funnel_deals')
        .update({ custom_fields: customFields })
        .eq('id', dealId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-deals'] });
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar campos do lead: " + error.message);
    },
  });

  return {
    fieldDefinitions,
    contactFieldDefinitions,
    leadFieldDefinitions,
    isLoading,
    createField,
    updateField,
    deleteField,
    updateContactCustomFields,
    updateDealCustomFields,
  };
};
