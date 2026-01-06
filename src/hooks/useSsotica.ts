import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrations } from "./useIntegrations";
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
}

export const useSsotica = () => {
  const { isConnected, getIntegration } = useIntegrations();
  const queryClient = useQueryClient();
  const hasSsotica = isConnected('ssotica');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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
      // Fetch all data in parallel for dashboard
      const [osResult, vendasResult, parcelasResult] = await Promise.all([
        callSsoticaApi('list-os', { lookbackDays: 30 }).catch(() => ({ data: [] })),
        callSsoticaApi('list-vendas', { lookbackDays: 30 }).catch(() => ({ data: [] })),
        callSsoticaApi('list-parcelas', { lookbackDays: 365 }).catch(() => ({ data: [] })),
      ]);

      const ordensServico = osResult.data || [];
      const vendas = vendasResult.data || [];
      const parcelas = parcelasResult.data || [];

      // Calculate metrics
      const osAbertas = ordensServico.filter((os: any) => 
        os.status?.toLowerCase() !== 'concluido' && 
        os.status?.toLowerCase() !== 'entregue'
      ).length;

      const vendasMes = vendas.length;
      const valorVendas = vendas.reduce((sum: number, v: any) => sum + (parseFloat(v.valor_total) || 0), 0);

      const parcelasEmAberto = parcelas.filter((p: any) => 
        p.status === 'em_aberto' || p.status === 'aberto' || !p.data_pagamento
      );
      const valorEmAberto = parcelasEmAberto.reduce((sum: number, p: any) => sum + (parseFloat(p.valor) || 0), 0);

      const parcelasVencidas = parcelasEmAberto.filter((p: any) => {
        const vencimento = new Date(p.vencimento);
        return vencimento < new Date();
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
    return callSsoticaApi('get-os', { numero_os: numeroOS });
  };

  // Buscar OS por CPF
  const searchOSByCpf = async (cpf: string) => {
    return callSsoticaApi('list-os', { cpf });
  };

  // Buscar vendas por CPF
  const searchVendasByCpf = async (cpf: string) => {
    return callSsoticaApi('list-vendas', { cpf });
  };

  // Buscar parcelas por CPF
  const searchParcelasByCpf = async (cpf: string) => {
    return callSsoticaApi('list-parcelas', { cpf });
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
