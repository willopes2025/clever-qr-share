import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useIntegrations } from "./useIntegrations";

export type GestaoPartsAction =
  | 'test_connection'
  | 'check_pessoa'
  | 'list_clientes'
  | 'cliente_credito'
  | 'search_peca'
  | 'peca_barcode'
  | 'peca_preco'
  | 'peca_tabela_preco'
  | 'peca_estoque'
  | 'peca_veiculo_placa'
  | 'list_pedidos'
  | 'get_pedido'
  | 'pedidos_cpf'
  | 'contas_receber'
  | 'boletos'
  | 'empresas'
  | 'lead_summary';

export interface GestaoPartsLeadSummary {
  pessoa: Record<string, unknown> | null;
  pedidos: unknown;
  financeiro: unknown;
  credito?: unknown;
}

export const callGestaoParts = async <T = unknown>(
  action: GestaoPartsAction,
  params: Record<string, unknown> = {},
): Promise<T> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gestao-parts-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, params }),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || `Erro ao consultar Gestão Parts (${response.status})`);
  }

  return json?.data as T;
};

export const useGestaoParts = () => {
  const { user } = useAuth();
  const { isConnected, isLoading } = useIntegrations();

  const hasGestaoParts = isConnected('gestao_parts');

  const call = useCallback(
    <T = unknown>(action: GestaoPartsAction, params: Record<string, unknown> = {}) =>
      callGestaoParts<T>(action, params),
    [],
  );

  return { hasGestaoParts, isLoading, call, user };
};

/** Resumo do cliente no ERP para o card do lead */
export const useGestaoPartsLead = (
  telefone: string | undefined,
  documento: string | undefined,
  enabled: boolean,
) => {
  return useQuery({
    queryKey: ['gestao-parts-lead', telefone, documento],
    queryFn: () => callGestaoParts<GestaoPartsLeadSummary>('lead_summary', {
      telefone: telefone || '',
      documento: documento || '',
    }),
    enabled: enabled && (!!telefone || !!documento),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
};
