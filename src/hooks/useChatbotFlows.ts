import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ChatbotFlow {
  id: string;
  user_id: string;
  instance_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChatbotFlowNode {
  id: string;
  flow_id: string;
  user_id: string;
  type: string;
  position_x: number;
  position_y: number;
  data: Record<string, any>;
  created_at: string;
}

export interface ChatbotFlowEdge {
  id: string;
  flow_id: string;
  user_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  target_handle: string | null;
  label: string | null;
  created_at: string;
}

export const useChatbotFlows = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: flows, isLoading } = useQuery({
    queryKey: ['chatbot-flows', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as ChatbotFlow[];
    },
    enabled: !!user,
  });

  const createFlow = useMutation({
    mutationFn: async (flow: { name: string; description?: string; instance_id?: string }) => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .insert({
          user_id: user!.id,
          name: flow.name,
          description: flow.description || null,
          instance_id: flow.instance_id || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as ChatbotFlow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
      toast.success('Fluxo criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar fluxo: ' + error.message);
    },
  });

  const updateFlow = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChatbotFlow> & { id: string }) => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as ChatbotFlow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
    },
  });

  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chatbot_flows')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
      toast.success('Fluxo excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir fluxo: ' + error.message);
    },
  });

  return {
    flows,
    isLoading,
    createFlow,
    updateFlow,
    deleteFlow,
  };
};

export const useChatbotFlowNodes = (flowId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: nodes, isLoading } = useQuery({
    queryKey: ['chatbot-flow-nodes', flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_flow_nodes')
        .select('*')
        .eq('flow_id', flowId!)
        .order('created_at');
      
      if (error) throw error;
      return data as ChatbotFlowNode[];
    },
    enabled: !!flowId && !!user,
  });

  const saveNodes = useMutation({
    mutationFn: async (nodesToSave: Omit<ChatbotFlowNode, 'id' | 'created_at'>[]) => {
      // Delete existing nodes
      await supabase
        .from('chatbot_flow_nodes')
        .delete()
        .eq('flow_id', flowId!);

      if (nodesToSave.length === 0) return [];

      // Insert new nodes
      const { data, error } = await supabase
        .from('chatbot_flow_nodes')
        .insert(nodesToSave)
        .select();
      
      if (error) throw error;
      return data as ChatbotFlowNode[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flow-nodes', flowId] });
    },
  });

  return { nodes, isLoading, saveNodes };
};

export const useChatbotFlowEdges = (flowId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: edges, isLoading } = useQuery({
    queryKey: ['chatbot-flow-edges', flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_flow_edges')
        .select('*')
        .eq('flow_id', flowId!)
        .order('created_at');
      
      if (error) throw error;
      return data as ChatbotFlowEdge[];
    },
    enabled: !!flowId && !!user,
  });

  const saveEdges = useMutation({
    mutationFn: async (edgesToSave: Omit<ChatbotFlowEdge, 'id' | 'created_at'>[]) => {
      // Delete existing edges
      await supabase
        .from('chatbot_flow_edges')
        .delete()
        .eq('flow_id', flowId!);

      if (edgesToSave.length === 0) return [];

      // Insert new edges
      const { data, error } = await supabase
        .from('chatbot_flow_edges')
        .insert(edgesToSave)
        .select();
      
      if (error) throw error;
      return data as ChatbotFlowEdge[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flow-edges', flowId] });
    },
  });

  return { edges, isLoading, saveEdges };
};
