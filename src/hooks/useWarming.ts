import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface WarmingSchedule {
  id: string;
  user_id: string;
  instance_id: string;
  status: 'active' | 'paused' | 'completed';
  start_date: string | null;
  current_day: number;
  target_days: number;
  messages_sent_today: number;
  messages_target_today: number;
  messages_received_today: number;
  total_messages_sent: number;
  total_messages_received: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  instance?: {
    id: string;
    instance_name: string;
    status: string;
    warming_level: number;
  };
}

export interface WarmingContact {
  id: string;
  user_id: string;
  phone: string;
  name: string | null;
  type: 'individual' | 'group';
  is_active: boolean;
  created_at: string;
}

export interface WarmingPair {
  id: string;
  user_id: string;
  instance_a_id: string;
  instance_b_id: string;
  is_active: boolean;
  created_at: string;
  instance_a?: { id: string; instance_name: string; status: string };
  instance_b?: { id: string; instance_name: string; status: string };
}

export interface WarmingContent {
  id: string;
  user_id: string;
  content_type: 'text' | 'audio' | 'image' | 'video' | 'sticker';
  content: string | null;
  media_url: string | null;
  category: 'greeting' | 'casual' | 'question' | 'reaction' | 'farewell';
  is_active: boolean;
  created_at: string;
}

export interface WarmingActivity {
  id: string;
  schedule_id: string;
  instance_id: string;
  activity_type: string;
  contact_phone: string | null;
  content_preview: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface WarmingPoolEntry {
  id: string;
  user_id: string;
  instance_id: string;
  phone_number: string;
  is_active: boolean;
  joined_at: string;
  last_paired_at: string | null;
  total_pairs_made: number;
  created_at: string;
  updated_at: string;
  instance?: {
    id: string;
    instance_name: string;
    status: string;
  };
}

export interface PoolStats {
  totalActive: number;
}

export function useWarming() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch warming schedules
  const { data: schedules, isLoading: schedulesLoading, refetch: refetchSchedules } = useQuery({
    queryKey: ['warming-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warming_schedules')
        .select(`
          *,
          instance:whatsapp_instances(id, instance_name, status, warming_level)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WarmingSchedule[];
    },
    enabled: !!user,
  });

  // Fetch warming contacts
  const { data: contacts, isLoading: contactsLoading, refetch: refetchContacts } = useQuery({
    queryKey: ['warming-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warming_contacts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WarmingContact[];
    },
    enabled: !!user,
  });

  // Fetch warming pairs
  const { data: pairs, isLoading: pairsLoading, refetch: refetchPairs } = useQuery({
    queryKey: ['warming-pairs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warming_pairs')
        .select(`
          *,
          instance_a:whatsapp_instances!warming_pairs_instance_a_id_fkey(id, instance_name, status),
          instance_b:whatsapp_instances!warming_pairs_instance_b_id_fkey(id, instance_name, status)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WarmingPair[];
    },
    enabled: !!user,
  });

  // Fetch warming content
  const { data: contents, isLoading: contentsLoading, refetch: refetchContents } = useQuery({
    queryKey: ['warming-contents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warming_content')
        .select('*')
        .or(`user_id.eq.${user?.id},user_id.eq.00000000-0000-0000-0000-000000000000`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WarmingContent[];
    },
    enabled: !!user,
  });

  // Fetch warming activities
  const { data: activities, isLoading: activitiesLoading, refetch: refetchActivities } = useQuery({
    queryKey: ['warming-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warming_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as WarmingActivity[];
    },
    enabled: !!user,
  });

  // Fetch user's pool entries
  const { data: poolEntries, isLoading: poolLoading, refetch: refetchPool } = useQuery({
    queryKey: ['warming-pool'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warming_pool')
        .select(`
          *,
          instance:whatsapp_instances(id, instance_name, status)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WarmingPoolEntry[];
    },
    enabled: !!user,
  });

  // Fetch pool statistics
  const { data: poolStats, refetch: refetchPoolStats } = useQuery({
    queryKey: ['warming-pool-stats'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('warming_pool')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (error) throw error;
      return { totalActive: count || 0 } as PoolStats;
    },
    enabled: !!user,
  });

  // Create or update warming schedule
  const createSchedule = useMutation({
    mutationFn: async ({ instanceId, targetDays = 21 }: { instanceId: string; targetDays?: number }) => {
      const { data, error } = await supabase
        .from('warming_schedules')
        .upsert({
          user_id: user!.id,
          instance_id: instanceId,
          status: 'active',
          target_days: targetDays,
          start_date: new Date().toISOString(),
          current_day: 1,
        }, { onConflict: 'instance_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-schedules'] });
      toast({ title: "Aquecimento iniciado", description: "O aquecimento da instância foi iniciado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Update schedule status
  const updateScheduleStatus = useMutation({
    mutationFn: async ({ scheduleId, status }: { scheduleId: string; status: 'active' | 'paused' | 'completed' }) => {
      const { error } = await supabase
        .from('warming_schedules')
        .update({ status })
        .eq('id', scheduleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-schedules'] });
      toast({ title: "Status atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Create warming contact
  const createContact = useMutation({
    mutationFn: async ({ phone, name, type = 'individual' }: { phone: string; name?: string; type?: 'individual' | 'group' }) => {
      const { data, error } = await supabase
        .from('warming_contacts')
        .insert({
          user_id: user!.id,
          phone,
          name,
          type,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-contacts'] });
      toast({ title: "Contato adicionado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Delete warming contact
  const deleteContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('warming_contacts')
        .delete()
        .eq('id', contactId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-contacts'] });
      toast({ title: "Contato removido" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Create warming pair
  const createPair = useMutation({
    mutationFn: async ({ instanceAId, instanceBId }: { instanceAId: string; instanceBId: string }) => {
      const { data, error } = await supabase
        .from('warming_pairs')
        .insert({
          user_id: user!.id,
          instance_a_id: instanceAId,
          instance_b_id: instanceBId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-pairs'] });
      toast({ title: "Pareamento criado", description: "As instâncias foram pareadas para aquecimento." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Delete warming pair
  const deletePair = useMutation({
    mutationFn: async (pairId: string) => {
      const { error } = await supabase
        .from('warming_pairs')
        .delete()
        .eq('id', pairId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-pairs'] });
      toast({ title: "Pareamento removido" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Create warming content
  const createContent = useMutation({
    mutationFn: async ({ contentType, content, mediaUrl, category }: { 
      contentType: 'text' | 'audio' | 'image' | 'video' | 'sticker';
      content?: string;
      mediaUrl?: string;
      category: 'greeting' | 'casual' | 'question' | 'reaction' | 'farewell';
    }) => {
      const { data, error } = await supabase
        .from('warming_content')
        .insert({
          user_id: user!.id,
          content_type: contentType,
          content,
          media_url: mediaUrl,
          category,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-contents'] });
      toast({ title: "Conteúdo adicionado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Update warming content
  const updateContent = useMutation({
    mutationFn: async ({ 
      contentId, 
      contentType, 
      content, 
      mediaUrl, 
      category 
    }: { 
      contentId: string;
      contentType: 'text' | 'audio' | 'image' | 'video' | 'sticker';
      content?: string;
      mediaUrl?: string;
      category: 'greeting' | 'casual' | 'question' | 'reaction' | 'farewell';
    }) => {
      const { data, error } = await supabase
        .from('warming_content')
        .update({
          content_type: contentType,
          content,
          media_url: mediaUrl,
          category,
        })
        .eq('id', contentId)
        .eq('user_id', user!.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-contents'] });
      toast({ title: "Conteúdo atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Delete warming content
  const deleteContent = useMutation({
    mutationFn: async (contentId: string) => {
      const { error } = await supabase
        .from('warming_content')
        .delete()
        .eq('id', contentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-contents'] });
      toast({ title: "Conteúdo removido" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Delete all user content
  const deleteAllUserContent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('warming_content')
        .delete()
        .eq('user_id', user!.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-contents'] });
      toast({ title: "Conteúdos removidos", description: "Todos os seus conteúdos foram deletados." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Delete warming schedule
  const deleteSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('warming_schedules')
        .delete()
        .eq('id', scheduleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['warming-activities'] });
      toast({ title: "Aquecimento excluído", description: "O aquecimento foi removido com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  // Trigger warming process manually
  const triggerWarming = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-warming');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warming-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['warming-activities'] });
      toast({ title: "Aquecimento executado", description: `Processado com sucesso.` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Join community warming pool
  const joinPool = useMutation({
    mutationFn: async ({ instanceId, phoneNumber }: { instanceId: string; phoneNumber: string }) => {
      const { data, error } = await supabase
        .from('warming_pool')
        .insert({
          user_id: user!.id,
          instance_id: instanceId,
          phone_number: phoneNumber,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool'] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats'] });
      toast({ 
        title: "Você entrou no pool!", 
        description: "Sua instância será pareada automaticamente com outras da plataforma." 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao entrar no pool", description: error.message, variant: "destructive" });
    },
  });

  // Leave community warming pool
  const leavePool = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('warming_pool')
        .delete()
        .eq('id', entryId)
        .eq('user_id', user!.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warming-pool'] });
      queryClient.invalidateQueries({ queryKey: ['warming-pool-stats'] });
      toast({ title: "Você saiu do pool", description: "Sua instância foi removida do pool comunitário." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao sair do pool", description: error.message, variant: "destructive" });
    },
  });

  return {
    schedules,
    contacts,
    pairs,
    contents,
    activities,
    poolEntries,
    poolStats: poolStats || { totalActive: 0 },
    isLoading: schedulesLoading || contactsLoading || pairsLoading || contentsLoading || activitiesLoading || poolLoading,
    createSchedule,
    updateScheduleStatus,
    deleteSchedule,
    createContact,
    deleteContact,
    createPair,
    deletePair,
    createContent,
    updateContent,
    deleteContent,
    deleteAllUserContent,
    triggerWarming,
    joinPool,
    leavePool,
    refetch: () => {
      refetchSchedules();
      refetchContacts();
      refetchPairs();
      refetchContents();
      refetchActivities();
      refetchPool();
      refetchPoolStats();
    },
  };
}
