import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConversationTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TagAssignment {
  id: string;
  conversation_id: string;
  tag_id: string;
  created_at: string;
}

export const useConversationTags = () => {
  const queryClient = useQueryClient();

  const { data: tags, isLoading } = useQuery({
    queryKey: ['conversation-tags'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // RLS already filters by org membership, no need to filter by user_id
      const { data, error } = await supabase
        .from('conversation_tags')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as ConversationTag[];
    }
  });

  const createTag = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('conversation_tags')
        .insert({ user_id: user.id, name, color })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tags'] });
      toast.success('Tag criada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar tag');
    }
  });

  const deleteTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('conversation_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tags'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-tag-assignments'] });
      toast.success('Tag excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir tag');
    }
  });

  return { tags, isLoading, createTag, deleteTag };
};

export const useConversationTagAssignments = (conversationId?: string) => {
  const queryClient = useQueryClient();

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['conversation-tag-assignments', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_tag_assignments')
        .select(`
          *,
          tag:conversation_tags(*)
        `)
        .eq('conversation_id', conversationId!);

      if (error) throw error;
      return data;
    }
  });

  const assignTag = useMutation({
    mutationFn: async ({ conversationId, tagId, tagName }: { conversationId: string; tagId: string; tagName?: string }) => {
      const { error } = await supabase
        .from('conversation_tag_assignments')
        .insert({ conversation_id: conversationId, tag_id: tagId });

      if (error) throw error;
      return { tagName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tag-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(data?.tagName ? `Tag "${data.tagName}" adicionada` : 'Tag adicionada');
    },
    onError: (err: any) => {
      // Unique constraint violation = tag already assigned
      if (err?.code === '23505') {
        toast.info('Esta tag já está atribuída');
      } else {
        toast.error('Erro ao adicionar tag');
      }
    }
  });

  const removeTag = useMutation({
    mutationFn: async ({ conversationId, tagId, tagName }: { conversationId: string; tagId: string; tagName?: string }) => {
      const { error } = await supabase
        .from('conversation_tag_assignments')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('tag_id', tagId);

      if (error) throw error;
      return { tagName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tag-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.info(data?.tagName ? `Tag "${data.tagName}" removida` : 'Tag removida');
    },
    onError: () => {
      toast.error('Erro ao remover tag');
    }
  });

  return { assignments, isLoading, assignTag, removeTag };
};
