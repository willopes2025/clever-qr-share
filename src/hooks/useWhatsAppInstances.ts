import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { useChannelAccessScope } from './useChannelAccessScope';

export interface WhatsAppInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: 'connected' | 'disconnected' | 'connecting';
  qr_code: string | null;
  qr_code_updated_at: string | null;
  created_at: string;
  updated_at: string;
  warming_level: number;
  default_funnel_id: string | null;
  is_notification_only: boolean | null;
  // Profile fields
  connected_at: string | null;
  phone_number: string | null;
  profile_name: string | null;
  profile_picture_url: string | null;
  profile_status: string | null;
  is_business: boolean;
  // Device fields
  device_label: string | null;
  chip_device: string | null;
  whatsapp_device: string | null;
}

export const WARMING_LEVELS = [
  { level: 1, name: 'Frio', icon: '🧊', color: 'text-blue-500', bgColor: 'bg-blue-500' },
  { level: 2, name: 'Morno', icon: '❄️', color: 'text-cyan-500', bgColor: 'bg-cyan-500' },
  { level: 3, name: 'Aquecendo', icon: '🌡️', color: 'text-yellow-500', bgColor: 'bg-yellow-500' },
  { level: 4, name: 'Quente', icon: '🔥', color: 'text-orange-500', bgColor: 'bg-orange-500' },
  { level: 5, name: 'Muito Quente', icon: '🔥🔥', color: 'text-red-500', bgColor: 'bg-red-500' },
] as const;

export const useWhatsAppInstances = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const { orgUserIds, hasInstanceRestriction, allowedInstanceIds, isScopeReady } = useChannelAccessScope();

  const requireAuthHeaders = async () => {
    // Get fresh session to ensure token is valid
    const { data: { session: currentSession }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      throw new Error('Sessão expirada. Por favor, faça login novamente.');
    }
    
    const token = currentSession?.access_token;
    if (!token) {
      throw new Error('Sessão expirada. Por favor, faça login novamente.');
    }
    
    return { Authorization: `Bearer ${token}` };
  };
  const { data: instances, isLoading, refetch } = useQuery({
    queryKey: ['whatsapp-instances', user?.id, orgUserIds, hasInstanceRestriction, allowedInstanceIds],
    queryFn: async () => {
      // Filtro defensivo no servidor: restringe explicitamente aos user_ids da org.
      // Se orgUserIds estiver vazio (caso anômalo), retorna lista vazia em vez de tudo.
      if (!orgUserIds || orgUserIds.length === 0) {
        return [] as (WhatsAppInstance & { funnel?: { id: string; name: string; color: string } | null })[];
      }

      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*, funnel:funnels(id, name, color)')
        .in('user_id', orgUserIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      let list = (data as (WhatsAppInstance & { funnel?: { id: string; name: string; color: string } | null })[]) || [];

      // Defesa em camadas: reaplica filtro local mesmo após .in().
      const orgSet = new Set(orgUserIds);
      list = list.filter(i => i.user_id && orgSet.has(i.user_id));

      if (hasInstanceRestriction && allowedInstanceIds) {
        const allowedSet = new Set(allowedInstanceIds);
        list = list.filter((instance) => allowedSet.has(instance.id));
      }

      return list;
    },
    // Só executa após o escopo organizacional estar 100% resolvido para evitar
    // qualquer "flash" momentâneo com instâncias de outras assinaturas.
    enabled: isScopeReady,
  });

  // Criar nova instância
  const createInstance = useMutation({
    mutationFn: async ({ instanceName, forceRecreate = false, isNotificationOnly = false }: { instanceName: string; forceRecreate?: boolean; isNotificationOnly?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('create-instance', {
        body: { instanceName, forceRecreate, isNotificationOnly },
        headers: await requireAuthHeaders(),
      });
      if (error) throw error;
      if (data.error) {
        const customError = new Error(data.error) as Error & { code?: string; instanceName?: string };
        customError.code = data.code;
        customError.instanceName = data.instanceName;
        throw customError;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      // Toast moved to Instances.tsx after member selection
    },
    onError: (error: Error & { code?: string }) => {
      // Don't show toast for INSTANCE_EXISTS_IN_EVOLUTION - handled in UI
      if (error.code !== 'INSTANCE_EXISTS_IN_EVOLUTION') {
        toast.error(`Erro ao criar instância: ${error.message}`);
      }
    },
  });

  // Conectar instância (obter QR Code)
  const connectInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('connect-instance', {
        body: { instanceName },
        headers: await requireAuthHeaders(),
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar QR Code: ${error.message}`);
    },
  });

  // Verificar status da conexão
  const checkStatus = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('check-connection-status', {
        body: { instanceName },
        headers: await requireAuthHeaders(),
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });

  // Deletar instância
  const deleteInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('delete-instance', {
        body: { instanceName },
        headers: await requireAuthHeaders(),
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Instância removida com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover instância: ${error.message}`);
    },
  });

  // Atualizar warming level
  const updateWarmingLevel = useMutation({
    mutationFn: async ({ instanceId, warmingLevel }: { instanceId: string; warmingLevel: number }) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ warming_level: warmingLevel })
        .eq('id', instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Nível de aquecimento atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar aquecimento: ${error.message}`);
    },
  });

  // Configurar webhook para instância
  const configureWebhook = useMutation({
    mutationFn: async (params: { instanceName?: string; configureAll?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('configure-instance-webhook', {
        body: params,
        headers: await requireAuthHeaders(),
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data.results) {
        const successCount = data.results.filter((r: { success: boolean }) => r.success).length;
        toast.success(`Webhook configurado em ${successCount} instância(s)!`);
      } else {
        toast.success('Webhook configurado com sucesso!');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao configurar webhook: ${error.message}`);
    },
  });

  // Atualizar funil padrão da instância
  const updateDefaultFunnel = useMutation({
    mutationFn: async ({ instanceId, funnelId }: { instanceId: string; funnelId: string | null }) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ default_funnel_id: funnelId })
        .eq('id', instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Funil vinculado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao vincular funil: ${error.message}`);
    },
  });

  // Atualizar device label (legacy)
  const updateDeviceLabel = useMutation({
    mutationFn: async ({ instanceId, deviceLabel }: { instanceId: string; deviceLabel: string }) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ device_label: deviceLabel })
        .eq('id', instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Dispositivo atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar dispositivo: ${error.message}`);
    },
  });

  // Atualizar detalhes da instância (nome, telefone, dispositivos)
  const updateInstanceDetails = useMutation({
    mutationFn: async ({ 
      instanceId, 
      instanceName,
      phoneNumber,
      chipDevice,
      whatsappDevice,
    }: { 
      instanceId: string; 
      instanceName: string;
      phoneNumber?: string | null;
      chipDevice?: string | null;
      whatsappDevice?: string | null;
    }) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ 
          instance_name: instanceName,
          phone_number: phoneNumber,
          chip_device: chipDevice,
          whatsapp_device: whatsappDevice,
        })
        .eq('id', instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Instância atualizada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar instância: ${error.message}`);
    },
  });

  // Recarregar sessão Signal (resolve "aguardando mensagem" no destinatário)
  const refreshSession = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('refresh-instance-session', {
        body: { instanceName },
        headers: await requireAuthHeaders(),
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success(data?.message || 'Sessão recarregada com sucesso!', { duration: 7000 });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao recarregar sessão: ${error.message}`);
    },
  });

  return {
    instances,
    isLoading,
    refetch,
    createInstance,
    connectInstance,
    checkStatus,
    deleteInstance,
    updateWarmingLevel,
    configureWebhook,
    updateDefaultFunnel,
    updateDeviceLabel,
    updateInstanceDetails,
    refreshSession,
  };
};
