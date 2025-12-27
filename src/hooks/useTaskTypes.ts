import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface TaskType {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  display_order: number;
  created_at: string;
}

const DEFAULT_TASK_TYPES = [
  { name: 'Reunião', icon: 'video', color: '#3B82F6', is_default: true, display_order: 0 },
  { name: 'Acompanhar', icon: 'eye', color: '#10B981', is_default: true, display_order: 1 },
  { name: 'Ligação', icon: 'phone', color: '#8B5CF6', is_default: true, display_order: 2 },
  { name: 'Email', icon: 'mail', color: '#F59E0B', is_default: true, display_order: 3 },
  { name: 'WhatsApp', icon: 'message-circle', color: '#22C55E', is_default: true, display_order: 4 },
  { name: 'Visita', icon: 'map-pin', color: '#EC4899', is_default: true, display_order: 5 },
];

export function useTaskTypes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: taskTypes = [], isLoading, refetch } = useQuery({
    queryKey: ['task-types', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('task_types')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Se não existem tipos, criar os padrões
      if (data.length === 0) {
        const defaultTypes = DEFAULT_TASK_TYPES.map(type => ({
          ...type,
          user_id: user.id,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('task_types')
          .insert(defaultTypes)
          .select();

        if (insertError) throw insertError;
        return inserted as TaskType[];
      }

      return data as TaskType[];
    },
    enabled: !!user?.id,
  });

  const createTaskType = useMutation({
    mutationFn: async (taskType: Omit<TaskType, 'id' | 'user_id' | 'created_at'>) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('task_types')
        .insert({
          ...taskType,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-types'] });
      toast.success('Tipo de tarefa criado');
    },
    onError: (error) => {
      console.error('Erro ao criar tipo de tarefa:', error);
      toast.error('Erro ao criar tipo de tarefa');
    },
  });

  const updateTaskType = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TaskType> & { id: string }) => {
      const { data, error } = await supabase
        .from('task_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-types'] });
      toast.success('Tipo de tarefa atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar tipo de tarefa:', error);
      toast.error('Erro ao atualizar tipo de tarefa');
    },
  });

  const deleteTaskType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('task_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-types'] });
      toast.success('Tipo de tarefa removido');
    },
    onError: (error) => {
      console.error('Erro ao remover tipo de tarefa:', error);
      toast.error('Erro ao remover tipo de tarefa');
    },
  });

  return {
    taskTypes,
    isLoading,
    refetch,
    createTaskType,
    updateTaskType,
    deleteTaskType,
  };
}
