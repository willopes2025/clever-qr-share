import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AIAgentConfig {
  id: string;
  user_id: string;
  campaign_id: string | null;
  agent_name: string;
  personality_prompt: string | null;
  behavior_rules: string | null;
  greeting_message: string | null;
  fallback_message: string;
  goodbye_message: string | null;
  max_interactions: number;
  response_delay_min: number;
  response_delay_max: number;
  active_hours_start: number;
  active_hours_end: number;
  handoff_keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeItem {
  id: string;
  agent_config_id: string;
  user_id: string;
  source_type: 'text' | 'pdf' | 'url';
  title: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  website_url: string | null;
  processed_content: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentVariable {
  id: string;
  agent_config_id: string;
  user_id: string;
  variable_key: string;
  variable_value: string | null;
  variable_description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch agent config by campaign ID
export const useAgentConfig = (campaignId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['agent-config', campaignId],
    queryFn: async () => {
      if (!campaignId || !user) return null;

      const { data, error } = await supabase
        .from('ai_agent_configs')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as AIAgentConfig | null;
    },
    enabled: !!campaignId && !!user,
  });
};

// Fetch knowledge items for an agent
export const useKnowledgeItems = (agentConfigId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['knowledge-items', agentConfigId],
    queryFn: async () => {
      if (!agentConfigId || !user) return [];

      const { data, error } = await supabase
        .from('ai_agent_knowledge_items')
        .select('*')
        .eq('agent_config_id', agentConfigId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KnowledgeItem[];
    },
    enabled: !!agentConfigId && !!user,
  });
};

// Fetch variables for an agent
export const useAgentVariables = (agentConfigId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['agent-variables', agentConfigId],
    queryFn: async () => {
      if (!agentConfigId || !user) return [];

      const { data, error } = await supabase
        .from('ai_agent_variables')
        .select('*')
        .eq('agent_config_id', agentConfigId)
        .eq('user_id', user.id)
        .order('is_system', { ascending: false })
        .order('variable_key', { ascending: true });

      if (error) throw error;
      return data as AgentVariable[];
    },
    enabled: !!agentConfigId && !!user,
  });
};

// Mutations for agent config
export const useAgentConfigMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const upsertConfig = useMutation({
    mutationFn: async (data: Partial<AIAgentConfig> & { campaign_id: string }) => {
      if (!user) throw new Error('User not authenticated');

      // Check if config exists
      const { data: existing } = await supabase
        .from('ai_agent_configs')
        .select('id')
        .eq('campaign_id', data.campaign_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { data: updated, error } = await supabase
          .from('ai_agent_configs')
          .update(data)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return updated;
      } else {
        const { data: created, error } = await supabase
          .from('ai_agent_configs')
          .insert({ ...data, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        return created;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-config', variables.campaign_id] });
    },
  });

  return { upsertConfig };
};

// Mutations for knowledge items
export const useKnowledgeItemMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addTextKnowledge = useMutation({
    mutationFn: async ({ agentConfigId, title, content }: { agentConfigId: string; title: string; content: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_agent_knowledge_items')
        .insert({
          agent_config_id: agentConfigId,
          user_id: user.id,
          source_type: 'text',
          title,
          content,
          processed_content: content,
          status: 'completed',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-items', variables.agentConfigId] });
      toast.success('Conhecimento adicionado');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar conhecimento: ' + error.message);
    },
  });

  const addUrlKnowledge = useMutation({
    mutationFn: async ({ agentConfigId, title, url }: { agentConfigId: string; title: string; url: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_agent_knowledge_items')
        .insert({
          agent_config_id: agentConfigId,
          user_id: user.id,
          source_type: 'url',
          title,
          website_url: url,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      
      // Trigger URL processing (could be an edge function)
      // For now, just return the item
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-items', variables.agentConfigId] });
      toast.success('URL adicionada para processamento');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar URL: ' + error.message);
    },
  });

  const uploadPdfKnowledge = useMutation({
    mutationFn: async ({ agentConfigId, file }: { agentConfigId: string; file: File }) => {
      if (!user) throw new Error('User not authenticated');

      // Upload file to storage
      const fileName = `${user.id}/${agentConfigId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('ai-knowledge-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('ai-knowledge-files')
        .getPublicUrl(fileName);

      // Create knowledge item
      const { data, error } = await supabase
        .from('ai_agent_knowledge_items')
        .insert({
          agent_config_id: agentConfigId,
          user_id: user.id,
          source_type: 'pdf',
          title: file.name,
          file_url: urlData.publicUrl,
          file_name: file.name,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger PDF processing
      await supabase.functions.invoke('process-knowledge-pdf', {
        body: { knowledgeItemId: data.id },
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-items', variables.agentConfigId] });
      toast.success('PDF enviado para processamento');
    },
    onError: (error) => {
      toast.error('Erro ao enviar PDF: ' + error.message);
    },
  });

  const deleteKnowledge = useMutation({
    mutationFn: async ({ id, agentConfigId, fileUrl }: { id: string; agentConfigId: string; fileUrl?: string | null }) => {
      if (!user) throw new Error('User not authenticated');

      // Delete file from storage if it exists
      if (fileUrl) {
        const filePath = fileUrl.split('/ai-knowledge-files/')[1];
        if (filePath) {
          await supabase.storage.from('ai-knowledge-files').remove([filePath]);
        }
      }

      const { error } = await supabase
        .from('ai_agent_knowledge_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return agentConfigId;
    },
    onSuccess: (agentConfigId) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-items', agentConfigId] });
      toast.success('Item removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  return { addTextKnowledge, addUrlKnowledge, uploadPdfKnowledge, deleteKnowledge };
};

// Mutations for variables
export const useVariableMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addVariable = useMutation({
    mutationFn: async ({ agentConfigId, key, value, description }: { 
      agentConfigId: string; 
      key: string; 
      value: string; 
      description?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_agent_variables')
        .insert({
          agent_config_id: agentConfigId,
          user_id: user.id,
          variable_key: key,
          variable_value: value,
          variable_description: description || null,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent-variables', data.agent_config_id] });
      toast.success('Variável adicionada');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar variável: ' + error.message);
    },
  });

  const updateVariable = useMutation({
    mutationFn: async ({ id, agentConfigId, key, value, description }: { 
      id: string;
      agentConfigId: string; 
      key: string; 
      value: string; 
      description?: string;
    }) => {
      const { error } = await supabase
        .from('ai_agent_variables')
        .update({
          variable_key: key,
          variable_value: value,
          variable_description: description || null,
        })
        .eq('id', id);

      if (error) throw error;
      return agentConfigId;
    },
    onSuccess: (agentConfigId) => {
      queryClient.invalidateQueries({ queryKey: ['agent-variables', agentConfigId] });
      toast.success('Variável atualizada');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const deleteVariable = useMutation({
    mutationFn: async ({ id, agentConfigId }: { id: string; agentConfigId: string }) => {
      const { error } = await supabase
        .from('ai_agent_variables')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return agentConfigId;
    },
    onSuccess: (agentConfigId) => {
      queryClient.invalidateQueries({ queryKey: ['agent-variables', agentConfigId] });
      toast.success('Variável removida');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  // Initialize system variables for a new agent
  const initSystemVariables = useMutation({
    mutationFn: async (agentConfigId: string) => {
      if (!user) throw new Error('User not authenticated');

      const systemVars = [
        { key: 'nome_contato', value: '', description: 'Nome do contato (preenchido automaticamente)' },
        { key: 'telefone', value: '', description: 'Telefone do contato (preenchido automaticamente)' },
        { key: 'data_atual', value: '', description: 'Data atual (preenchido automaticamente)' },
        { key: 'hora_atual', value: '', description: 'Hora atual (preenchido automaticamente)' },
      ];

      const { error } = await supabase
        .from('ai_agent_variables')
        .insert(
          systemVars.map(v => ({
            agent_config_id: agentConfigId,
            user_id: user.id,
            variable_key: v.key,
            variable_value: v.value,
            variable_description: v.description,
            is_system: true,
          }))
        );

      if (error && !error.message.includes('duplicate')) throw error;
      return agentConfigId;
    },
    onSuccess: (agentConfigId) => {
      queryClient.invalidateQueries({ queryKey: ['agent-variables', agentConfigId] });
    },
  });

  return { addVariable, updateVariable, deleteVariable, initSystemVariables };
};
