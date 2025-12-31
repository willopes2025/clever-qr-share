import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface LeadPanelTab {
  id: string;
  user_id: string;
  name: string;
  display_order: number;
  field_keys: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useLeadPanelTabs = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tabs, isLoading } = useQuery({
    queryKey: ['lead-panel-tabs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_panel_tabs')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Se não houver abas, criar a aba Principal padrão
      if (!data || data.length === 0) {
        const { data: newTab, error: createError } = await supabase
          .from('lead_panel_tabs')
          .insert({
            user_id: user!.id,
            name: 'Principal',
            display_order: 0,
            field_keys: [],
            is_default: true,
          })
          .select()
          .single();

        if (createError) throw createError;
        return [newTab] as LeadPanelTab[];
      }

      return data as LeadPanelTab[];
    },
    enabled: !!user,
  });

  const createTab = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = Math.max(0, ...(tabs?.map(t => t.display_order) || [0]));
      
      const { data, error } = await supabase
        .from('lead_panel_tabs')
        .insert({
          user_id: user!.id,
          name,
          display_order: maxOrder + 1,
          field_keys: [],
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-panel-tabs'] });
      toast.success("Aba criada");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar aba: " + error.message);
    },
  });

  const updateTab = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeadPanelTab> & { id: string }) => {
      const { data, error } = await supabase
        .from('lead_panel_tabs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-panel-tabs'] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar aba: " + error.message);
    },
  });

  const deleteTab = useMutation({
    mutationFn: async (id: string) => {
      const tab = tabs?.find(t => t.id === id);
      if (tab?.is_default) {
        throw new Error("Não é possível excluir a aba padrão");
      }

      const { error } = await supabase
        .from('lead_panel_tabs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-panel-tabs'] });
      toast.success("Aba removida");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reorderTabs = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        display_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('lead_panel_tabs')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-panel-tabs'] });
    },
  });

  const updateTabFields = useMutation({
    mutationFn: async ({ tabId, fieldKeys }: { tabId: string; fieldKeys: string[] }) => {
      const { data, error } = await supabase
        .from('lead_panel_tabs')
        .update({ field_keys: fieldKeys })
        .eq('id', tabId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-panel-tabs'] });
      toast.success("Campos atualizados");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar campos: " + error.message);
    },
  });

  return {
    tabs,
    isLoading,
    createTab,
    updateTab,
    deleteTab,
    reorderTabs,
    updateTabFields,
  };
};
