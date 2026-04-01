import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useIntegrationStatus } from "./useIntegrationStatus";
import { toast } from "sonner";

interface SsoticaSyncData {
  // Resumo
  ssotica_total_os: number;
  ssotica_total_vendas: number;
  ssotica_total_parcelas_abertas: number;
  ssotica_valor_total_aberto: number;
  ssotica_ultima_sync: string;
  // Última OS
  ssotica_os_numero: string;
  ssotica_os_status: string;
  ssotica_os_data_entrada: string;
  ssotica_os_previsao_entrega: string;
  ssotica_os_valor_total: number;
  ssotica_os_observacoes: string;
  ssotica_os_receita: string;
  // Última Venda
  ssotica_venda_numero: string;
  ssotica_venda_data: string;
  ssotica_venda_valor_total: number;
  ssotica_venda_forma_pagamento: string;
  ssotica_venda_status: string;
  // Parcela mais urgente
  ssotica_parcela_numero: string;
  ssotica_parcela_documento: string;
  ssotica_parcela_valor: number;
  ssotica_parcela_vencimento: string;
  ssotica_parcela_status: string;
  ssotica_parcela_boleto_url: string;
  ssotica_parcela_pix: string;
  // Todas as OS (JSON string)
  ssotica_todas_os: string;
  ssotica_todas_vendas: string;
  ssotica_todas_parcelas: string;
}

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const useSsoticaSync = (
  dealId: string | undefined,
  contactId: string | undefined,
  contactPhone: string | undefined,
  contactCustomFields: Record<string, unknown> | undefined,
  dealCustomFields: Record<string, unknown> | undefined,
) => {
  const { user } = useAuth();
  const { hasSsotica } = useIntegrationStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedData, setSyncedData] = useState<Partial<SsoticaSyncData> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncAttemptedRef = useRef(false);

  // Extract CPF from contact custom_fields
  const getCpfFromContact = useCallback((): string | null => {
    if (!contactCustomFields) return null;
    
    const possibleKeys = ['cpf', 'cpf_cnpj', 'documento', 'CPF', 'Cpf'];
    for (const key of possibleKeys) {
      const value = contactCustomFields[key];
      if (value && typeof value === 'string') {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length === 11 || cleaned.length === 14) {
          return cleaned;
        }
      }
    }
    return null;
  }, [contactCustomFields]);

  // Check if cached data is still fresh
  const isCacheFresh = useCallback((): boolean => {
    const lastSync = dealCustomFields?.ssotica_ultima_sync;
    if (!lastSync || typeof lastSync !== 'string') return false;
    
    const syncTime = new Date(lastSync).getTime();
    return (Date.now() - syncTime) < CACHE_DURATION_MS;
  }, [dealCustomFields]);

  const callSsoticaApi = async (action: string, params?: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("Sessão expirada");

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ssotica-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, params }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Erro ssOtica (${response.status})`);
    return data;
  };

  const syncData = useCallback(async (force = false) => {
    if (!hasSsotica || !dealId || !user) return;
    if (!force && isCacheFresh()) {
      // Use cached data from deal custom_fields
      if (dealCustomFields) {
        const cached: Partial<SsoticaSyncData> = {};
        Object.entries(dealCustomFields).forEach(([key, value]) => {
          if (key.startsWith('ssotica_')) {
            (cached as any)[key] = value;
          }
        });
        if (Object.keys(cached).length > 0) {
          setSyncedData(cached);
          return;
        }
      }
    }

    const cpf = getCpfFromContact();
    const phone = contactPhone?.replace(/\D/g, '');

    if (!cpf && !phone) {
      setError("Contato sem CPF ou telefone para buscar no ssOtica");
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      let osData: any = { data: [] };
      let vendasData: any = { data: [] };
      let parcelasData: any = { data: [] };

      if (cpf) {
        // Search by CPF (preferred)
        [osData, vendasData, parcelasData] = await Promise.all([
          callSsoticaApi('consultar_os_cliente', { cpf, lookback_days: 365 }).catch(() => ({ ordens_servico: [] })),
          callSsoticaApi('consultar_vendas_cliente', { cpf, lookback_days: 365 }).catch(() => ({ vendas: [] })),
          callSsoticaApi('consultar_parcelas_cliente', { cpf, lookback_days: 365 }).catch(() => ({ parcelas: [] })),
        ]);
      } else if (phone) {
        // Fallback: fetch all and filter by phone
        const [allOs, allVendas, allParcelas] = await Promise.all([
          callSsoticaApi('listar_os', { lookback_days: 90 }).catch(() => ({ data: [] })),
          callSsoticaApi('listar_vendas', { lookback_days: 90 }).catch(() => ({ data: [] })),
          callSsoticaApi('listar_parcelas', { lookback_days: 365 }).catch(() => ({ data: [] })),
        ]);

        const phoneClean = phone.replace(/^55/, '');
        const matchPhone = (item: any) => {
          const itemPhone = (item.cliente?.telefone || item.telefone_cliente || '').replace(/\D/g, '').replace(/^55/, '');
          return itemPhone && (itemPhone.includes(phoneClean) || phoneClean.includes(itemPhone));
        };

        osData = { ordens_servico: (allOs.data || []).filter(matchPhone) };
        vendasData = { vendas: (allVendas.data || []).filter(matchPhone) };
        parcelasData = { parcelas: (allParcelas.data || []).filter(matchPhone) };
      }

      const osList = osData.ordens_servico || osData.data || [];
      const vendasList = vendasData.vendas || vendasData.data || [];
      const parcelasList = parcelasData.parcelas || parcelasData.data || [];

      // Build synced data
      const lastOs = osList[0];
      const lastVenda = vendasList[0];
      // Most urgent parcela (closest to due date or overdue)
      const sortedParcelas = [...parcelasList].sort((a: any, b: any) => {
        const dateA = new Date(a.vencimento || a.data_vencimento || '9999-12-31');
        const dateB = new Date(b.vencimento || b.data_vencimento || '9999-12-31');
        return dateA.getTime() - dateB.getTime();
      });
      const urgentParcela = sortedParcelas[0];

      const valorTotalAberto = parcelasList.reduce((sum: number, p: any) => 
        sum + (parseFloat(p.valor || p.valor_parcela) || 0), 0
      );

      const newData: Partial<SsoticaSyncData> = {
        ssotica_ultima_sync: new Date().toISOString(),
        ssotica_total_os: osList.length,
        ssotica_total_vendas: vendasList.length,
        ssotica_total_parcelas_abertas: parcelasList.length,
        ssotica_valor_total_aberto: valorTotalAberto,
        // Última OS
        ...(lastOs && {
          ssotica_os_numero: lastOs.numero_os || lastOs.numero || '',
          ssotica_os_status: lastOs.status || '',
          ssotica_os_data_entrada: lastOs.data_entrada || '',
          ssotica_os_previsao_entrega: lastOs.previsao_entrega || '',
          ssotica_os_valor_total: parseFloat(lastOs.valor_total) || 0,
          ssotica_os_observacoes: lastOs.observacoes || '',
          ssotica_os_receita: typeof lastOs.receita === 'object' ? JSON.stringify(lastOs.receita) : (lastOs.receita || ''),
        }),
        // Última Venda
        ...(lastVenda && {
          ssotica_venda_numero: lastVenda.numero_venda || lastVenda.numero || '',
          ssotica_venda_data: lastVenda.data_venda || '',
          ssotica_venda_valor_total: parseFloat(lastVenda.valor_total) || 0,
          ssotica_venda_forma_pagamento: lastVenda.forma_pagamento || '',
          ssotica_venda_status: lastVenda.status || '',
        }),
        // Parcela mais urgente
        ...(urgentParcela && {
          ssotica_parcela_numero: urgentParcela.numero_parcela || urgentParcela.numero || '',
          ssotica_parcela_documento: urgentParcela.documento || '',
          ssotica_parcela_valor: parseFloat(urgentParcela.valor || urgentParcela.valor_parcela) || 0,
          ssotica_parcela_vencimento: urgentParcela.vencimento || urgentParcela.data_vencimento || '',
          ssotica_parcela_status: urgentParcela.status || '',
          ssotica_parcela_boleto_url: urgentParcela.boleto_url || '',
          ssotica_parcela_pix: urgentParcela.pix_copia_cola || '',
        }),
        // Store all lists as JSON
        ssotica_todas_os: JSON.stringify(osList),
        ssotica_todas_vendas: JSON.stringify(vendasList),
        ssotica_todas_parcelas: JSON.stringify(parcelasList),
      };

      // Save to deal custom_fields
      const currentFields = (dealCustomFields || {}) as Record<string, unknown>;
      const mergedFields = { ...currentFields, ...newData };

      const { error: updateError } = await supabase
        .from('funnel_deals')
        .update({ custom_fields: mergedFields as Record<string, never> })
        .eq('id', dealId);

      if (updateError) {
        console.error('[SsoticaSync] Error saving:', updateError);
        throw new Error('Erro ao salvar dados do ssOtica no lead');
      }

      setSyncedData(newData);
      console.log('[SsoticaSync] Synced successfully:', {
        os: osList.length,
        vendas: vendasList.length,
        parcelas: parcelasList.length,
        method: cpf ? 'CPF' : 'telefone',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao sincronizar ssOtica';
      setError(msg);
      console.error('[SsoticaSync] Error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [hasSsotica, dealId, user, getCpfFromContact, contactPhone, dealCustomFields, isCacheFresh]);

  // Auto-sync when component mounts (deal card opens)
  useEffect(() => {
    if (!syncAttemptedRef.current && hasSsotica && dealId && user) {
      syncAttemptedRef.current = true;
      syncData();
    }
  }, [hasSsotica, dealId, user]); // intentionally not including syncData to avoid loops

  const forceSync = useCallback(() => {
    syncData(true);
  }, [syncData]);

  return {
    isSyncing,
    syncedData,
    error,
    forceSync,
    hasSsotica,
  };
};
