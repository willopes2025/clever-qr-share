import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type AgentMediaType = 'image' | 'video' | 'audio' | 'document';
export type StageMediaTrigger = 'on_enter' | 'on_demand' | 'after_message';

export interface AgentMediaItem {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  media_type: AgentMediaType;
  media_url: string;
  mime_type: string | null;
  file_size: number | null;
  caption: string | null;
  created_at: string;
  updated_at: string;
}

export interface StageMediaAttachment {
  id: string;
  stage_id: string;
  media_id: string;
  trigger_type: StageMediaTrigger;
  order_index: number;
  delay_seconds: number;
  caption_override: string | null;
  media: AgentMediaItem | null;
}

export const useAgentMediaLibrary = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['agent-media-library', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_media_library')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AgentMediaItem[];
    },
    enabled: !!user,
  });
};

export const useAgentMediaMutations = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  const create = useMutation({
    mutationFn: async (data: Omit<AgentMediaItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data: created, error } = await supabase
        .from('ai_agent_media_library')
        .insert({ ...data, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return created as AgentMediaItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-media-library'] });
      toast.success('Mídia adicionada à biblioteca');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AgentMediaItem> & { id: string }) => {
      const { error } = await supabase
        .from('ai_agent_media_library')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-media-library'] });
      toast.success('Mídia atualizada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_agent_media_library')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-media-library'] });
      qc.invalidateQueries({ queryKey: ['stage-media'] });
      toast.success('Mídia removida');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  return { create, update, remove };
};

export const useStageMedia = (stageId: string | null) => {
  return useQuery({
    queryKey: ['stage-media', stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await supabase
        .from('ai_agent_stage_media')
        .select('*, media:ai_agent_media_library!media_id(*)')
        .eq('stage_id', stageId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as StageMediaAttachment[];
    },
    enabled: !!stageId,
  });
};

export const useStageMediaMutations = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  const attach = useMutation({
    mutationFn: async (data: {
      stage_id: string;
      media_id: string;
      trigger_type: StageMediaTrigger;
      delay_seconds?: number;
      caption_override?: string | null;
      order_index?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('ai_agent_stage_media').insert({
        ...data,
        user_id: user.id,
        delay_seconds: data.delay_seconds ?? 2,
        order_index: data.order_index ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stage-media', vars.stage_id] });
      toast.success('Mídia anexada à etapa');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      stage_id: _stage_id,
      ...patch
    }: Partial<StageMediaAttachment> & { id: string; stage_id: string }) => {
      const { error } = await supabase.from('ai_agent_stage_media').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stage-media', vars.stage_id] });
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const detach = useMutation({
    mutationFn: async ({ id, stage_id: _s }: { id: string; stage_id: string }) => {
      const { error } = await supabase.from('ai_agent_stage_media').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stage-media', vars.stage_id] });
      toast.success('Mídia desvinculada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  return { attach, update, detach };
};
