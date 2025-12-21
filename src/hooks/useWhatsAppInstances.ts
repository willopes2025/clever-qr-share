import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

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
  const { session } = useAuth();

  const requireAuthHeaders = () => {
    const token = session?.access_token;
    if (!token) throw new Error('Você precisa estar logado');
    return { Authorization: `Bearer ${token}` };
  };
  const { data: instances, isLoading, refetch } = useQuery({
    queryKey: ['whatsapp-instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WhatsAppInstance[];
    },
  });

  // Criar nova instância
  const createInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('create-instance', {
        body: { instanceName },
        headers: requireAuthHeaders(),
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Instância criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar instância: ${error.message}`);
    },
  });

  // Conectar instância (obter QR Code)
  const connectInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke('connect-instance', {
        body: { instanceName },
        headers: requireAuthHeaders(),
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
        headers: requireAuthHeaders(),
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
        headers: requireAuthHeaders(),
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
        headers: requireAuthHeaders(),
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
  };
};
