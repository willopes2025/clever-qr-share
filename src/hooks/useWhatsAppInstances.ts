import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: 'connected' | 'disconnected' | 'connecting';
  qr_code: string | null;
  qr_code_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useWhatsAppInstances = () => {
  const queryClient = useQueryClient();

  // Buscar instâncias do banco de dados
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

  return {
    instances,
    isLoading,
    refetch,
    createInstance,
    connectInstance,
    checkStatus,
    deleteInstance,
  };
};
