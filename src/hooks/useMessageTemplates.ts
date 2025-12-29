import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type TemplateCategory = 'promotional' | 'transactional' | 'notification' | 'welcome' | 'reminder' | 'other';
export type MediaType = 'image' | 'video' | 'audio' | null;

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  category: TemplateCategory;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  media_type?: MediaType;
  media_url?: string | null;
  media_filename?: string | null;
}

export interface CreateTemplateData {
  name: string;
  content: string;
  category: TemplateCategory;
  variables: string[];
  is_active?: boolean;
  media_type?: MediaType;
  media_url?: string | null;
  media_filename?: string | null;
}

export interface UpdateTemplateData extends Partial<CreateTemplateData> {
  id: string;
}

// Extract variables from template content (format: {{variable_name}})
export const extractVariables = (content: string): string[] => {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = content.match(regex) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
};

// Replace variables with sample data for preview
export const previewTemplate = (content: string, sampleData: Record<string, string>): string => {
  let preview = content;
  Object.entries(sampleData).forEach(([key, value]) => {
    preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  });
  return preview;
};

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  promotional: 'Promocional',
  transactional: 'Transacional',
  notification: 'Notificação',
  welcome: 'Boas-vindas',
  reminder: 'Lembrete',
  other: 'Outro'
};

export const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  promotional: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  transactional: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  notification: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  welcome: 'bg-green-500/20 text-green-300 border-green-500/30',
  reminder: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  other: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
};

export const useMessageTemplates = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ['message-templates', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(template => ({
        ...template,
        category: template.category as TemplateCategory,
        variables: (template.variables as string[]) || [],
        media_type: template.media_type as MediaType,
        media_url: template.media_url,
        media_filename: template.media_filename
      })) as MessageTemplate[];
    },
    enabled: !!user?.id
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('message_templates')
        .insert({
          user_id: user.id,
          name: data.name,
          content: data.content,
          category: data.category,
          variables: data.variables,
          is_active: data.is_active ?? true,
          media_type: data.media_type || null,
          media_url: data.media_url || null,
          media_filename: data.media_filename || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar template: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: UpdateTemplateData) => {
      const { error } = await supabase
        .from('message_templates')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar template: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir template: ' + error.message);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('message_templates')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Status do template atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  });

  return {
    templates: templatesQuery.data || [],
    isLoading: templatesQuery.isLoading,
    createTemplate: createMutation.mutate,
    updateTemplate: updateMutation.mutate,
    deleteTemplate: deleteMutation.mutate,
    toggleActive: toggleActiveMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
};
