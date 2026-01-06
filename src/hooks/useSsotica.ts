import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface SsoticaOS {
  id: string;
  numero: string;
  status: string;
  data_entrada: string;
  previsao_entrega?: string;
  cliente?: {
    nome: string;
    cpf?: string;
    telefone?: string;
  };
  valor_total?: number;
  observacoes?: string;
  raw_data?: Record<string, any>;
}

export interface SsoticaVenda {
  id: string;
  numero: string;
  data_venda: string;
  cliente?: {
    nome: string;
    cpf?: string;
  };
  valor_total: number;
  forma_pagamento?: string;
  status?: string;
  raw_data?: Record<string, any>;
}

export interface SsoticaParcela {
  id: string;
  numero?: string;
  documento?: string;
  cliente?: {
    nome: string;
    cpf?: string;
  };
  valor: number;
  vencimento: string;
  status: string;
  boleto_url?: string;
  pix_copia_cola?: string;
  raw_data?: Record<string, any>;
}

export const useSsotica = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check if SSOTica integration exists in ai_agent_integrations
  const { data: ssoticaIntegration } = useQuery({
    queryKey: ['ssotica-integration', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('ai_agent_integrations')
        .select('id, is_active')
        .or('name.ilike.%ssotica%,integration_type.ilike.%ssotica%')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking ssotica integration:', error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const hasSsotica = !!ssoticaIntegration;

  const callSsoticaApi = async (action: string, params?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('ssotica-api', {
      body: { action, params }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  // Dashboard stats - summary data
  const { data: dashboardData, isLoading: isLoadingDashboard, refetch: refetchDashboard } = useQuery({
    queryKey: ['ssotica', 'dashboard'],
    queryFn: async () => {
      // Fetch all data in parallel using correct actions
      const [osResult, vendasResult, parcelasResult] = await Promise.all([
        callSsoticaApi('listar_os', { lookback_days: 30 }).catch((e) => {
          console.error('Error fetching OS:', e);
          return { data: [] };
        }),
        callSsoticaApi('listar_vendas', { lookback_days: 30 }).catch((e) => {
          console.error('Error fetching vendas:', e);
          return { data: [] };
        }),
        callSsoticaApi('listar_parcelas', { lookback_days: 365 }).catch((e) => {
          console.error('Error fetching parcelas:', e);
          return { data: [] };
        }),
      ]);

      const ordensServico = osResult.data || [];
      const vendas = vendasResult.data || [];
      const parcelas = parcelasResult.data || [];

      console.log('[useSsotica] Loaded data:', { 
        os: ordensServico.length, 
        vendas: vendas.length, 
        parcelas: parcelas.length 
      });

      // Calculate metrics
      const osAbertas = ordensServico.filter((os: any) => {
        const status = (os.status || '').toLowerCase();
        return status !== 'concluido' && 
               status !== 'concluída' && 
               status !== 'entregue' &&
               status !== 'finalizado';
      }).length;

      const vendasMes = vendas.length;
      const valorVendas = vendas.reduce((sum: number, v: any) => sum + (parseFloat(v.valor_total) || 0), 0);

      // Parcelas já vêm filtradas como em aberto do backend
      const parcelasEmAberto = parcelas;
      const valorEmAberto = parcelasEmAberto.reduce((sum: number, p: any) => sum + (parseFloat(p.valor) || 0), 0);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const parcelasVencidas = parcelasEmAberto.filter((p: any) => {
        if (!p.vencimento) return false;
        const vencimento = new Date(p.vencimento);
        vencimento.setHours(0, 0, 0, 0);
        return vencimento < hoje;
      });
      const valorVencido = parcelasVencidas.reduce((sum: number, p: any) => sum + (parseFloat(p.valor) || 0), 0);

      setLastSync(new Date().toISOString());

      return {
        ordensServico,
        vendas,
        parcelas,
        metrics: {
          osAbertas,
          vendasMes,
          valorVendas,
          parcelasEmAberto: parcelasEmAberto.length,
          valorEmAberto,
          parcelasVencidas: parcelasVencidas.length,
          valorVencido,
        }
      };
    },
    enabled: hasSsotica,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000,
  });

  // Função para sincronizar todos os dados
  const syncAll = async () => {
    setIsSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['ssotica'] });
      await refetchDashboard();
      toast.success("Dados do ssOtica sincronizados!");
    } catch (error) {
      toast.error("Erro ao sincronizar dados do ssOtica");
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Buscar OS por número
  const searchOS = async (numeroOS: string) => {
    return callSsoticaApi('consultar_os_por_numero', { numero_os: numeroOS });
  };

  // Buscar OS por CPF
  const searchOSByCpf = async (cpf: string) => {
    return callSsoticaApi('consultar_os_cliente', { cpf });
  };

  // Buscar vendas por CPF
  const searchVendasByCpf = async (cpf: string) => {
    return callSsoticaApi('consultar_vendas_cliente', { cpf });
  };

  // Buscar parcelas por CPF
  const searchParcelasByCpf = async (cpf: string) => {
    return callSsoticaApi('consultar_parcelas_cliente', { cpf });
  };

  return {
    hasSsotica,
    // Sync
    lastSync,
    isSyncing,
    syncAll,
    // Dashboard data
    isLoading: isLoadingDashboard,
    ordensServico: (dashboardData?.ordensServico || []) as SsoticaOS[],
    vendas: (dashboardData?.vendas || []) as SsoticaVenda[],
    parcelas: (dashboardData?.parcelas || []) as SsoticaParcela[],
    metrics: dashboardData?.metrics || {
      osAbertas: 0,
      vendasMes: 0,
      valorVendas: 0,
      parcelasEmAberto: 0,
      valorEmAberto: 0,
      parcelasVencidas: 0,
      valorVencido: 0,
    },
    // Search functions
    searchOS,
    searchOSByCpf,
    searchVendasByCpf,
    searchParcelasByCpf,
  };
};
