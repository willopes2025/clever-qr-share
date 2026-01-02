import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SSOTICA_BASE_URL = 'https://app.ssotica.com.br/api/v1';

interface SsoticaQueryParams {
  cnpj?: string;
  inicio_periodo?: string;
  fim_periodo?: string;
  page?: number;
  perPage?: number;
  cpf?: string;
  cpf_cnpj?: string; // Alias for cpf - accepts both
  telefone?: string;
  termo?: string;
}

async function ssoticaRequest(
  endpoint: string, 
  token: string, 
  params: SsoticaQueryParams = {}
) {
  const url = new URL(`${SSOTICA_BASE_URL}${endpoint}`);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  console.log(`[ssOtica] Requesting: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ssOtica] Error ${response.status}: ${errorText}`);
    throw new Error(`ssOtica API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params, agent_config_id } = await req.json();
    
    console.log(`[ssOtica] Action: ${action}, Params:`, params);

    // Get token from environment or from agent integration config
    let token = Deno.env.get('SSOTICA_API_TOKEN');
    let cnpj = Deno.env.get('SSOTICA_CNPJ');

    // If agent_config_id provided, try to get credentials from integration
    if (agent_config_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: integration } = await supabase
        .from('ai_agent_integrations')
        .select('api_credentials')
        .eq('agent_config_id', agent_config_id)
        .eq('name', 'ssOtica API Consultiva')
        .eq('is_active', true)
        .single();

      if (integration?.api_credentials) {
        const creds = integration.api_credentials as { token?: string; cnpj?: string };
        if (creds.token) token = creds.token;
        if (creds.cnpj) cnpj = creds.cnpj;
      }
    }

    if (!token) {
      throw new Error('ssOtica API token not configured');
    }

    if (!cnpj && !params?.cnpj) {
      throw new Error('CNPJ da empresa não configurado');
    }

    const empresaCnpj = params?.cnpj || cnpj;

    // Define date range (default: last 30 days - ssOtica API limit)
    const hoje = new Date();
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - 30);
    
    const defaultParams: SsoticaQueryParams = {
      cnpj: empresaCnpj,
      inicio_periodo: params?.inicio_periodo || inicio.toISOString().split('T')[0],
      fim_periodo: params?.fim_periodo || hoje.toISOString().split('T')[0],
      page: params?.page || 1,
      perPage: params?.perPage || 50,
    };

    let result: any;

    switch (action) {
      case 'consultar_os_cliente': {
        // Get CPF from either cpf_cnpj or cpf parameter
        const cpfCliente = params?.cpf_cnpj || params?.cpf;
        const cpfLimpo = cpfCliente ? cpfCliente.replace(/\D/g, '') : null;
        
        console.log(`[ssOtica] consultar_os_cliente - CPF: ${cpfLimpo}`);
        
        // Include cpf_cnpj in request to let ssOtica API filter server-side
        const osParams: SsoticaQueryParams = {
          ...defaultParams,
          ...(cpfLimpo && { cpf_cnpj: cpfLimpo }),
        };
        
        const osData = await ssoticaRequest('/integracoes/ordens-servico/periodo', token, osParams);
        
        // Also filter locally as fallback (in case ssOtica API doesn't filter)
        let filteredOS = osData.data || osData;
        
        if (cpfLimpo && Array.isArray(filteredOS)) {
          filteredOS = filteredOS.filter((os: any) => {
            const osCpf = (os.cliente?.cpf || os.cpf_cliente || '').replace(/\D/g, '');
            return osCpf === cpfLimpo;
          });
        }
        
        if (params?.telefone) {
          const telLimpo = params.telefone.replace(/\D/g, '');
          filteredOS = filteredOS.filter((os: any) => {
            const osTel = (os.cliente?.telefone || os.telefone_cliente || '').replace(/\D/g, '');
            return osTel.includes(telLimpo) || telLimpo.includes(osTel);
          });
        }

        console.log(`[ssOtica] OS encontradas para CPF ${cpfLimpo}: ${filteredOS.length}`);

        // Format response for agent
        result = {
          success: true,
          total: filteredOS.length,
          cpf_consultado: cpfLimpo,
          ordens_servico: filteredOS.map((os: any) => ({
            numero_os: os.numero || os.id,
            status: os.status || os.situacao,
            previsao_entrega: os.previsao_entrega || os.data_previsao,
            data_entrada: os.data_entrada || os.created_at,
            cliente: {
              nome: os.cliente?.nome || os.nome_cliente,
              cpf: os.cliente?.cpf || os.cpf_cliente,
              telefone: os.cliente?.telefone || os.telefone_cliente,
            },
            receita: os.receita || os.prescricao,
            itens: os.itens || os.produtos,
            valor_total: os.valor_total || os.total,
            observacoes: os.observacoes || os.obs,
          })),
        };
        break;
      }

      case 'consultar_vendas_cliente': {
        // Get CPF from either cpf_cnpj or cpf parameter
        const cpfCliente = params?.cpf_cnpj || params?.cpf;
        const cpfLimpo = cpfCliente ? cpfCliente.replace(/\D/g, '') : null;
        
        console.log(`[ssOtica] consultar_vendas_cliente - CPF: ${cpfLimpo}`);
        
        const vendasParams: SsoticaQueryParams = {
          ...defaultParams,
          ...(cpfLimpo && { cpf_cnpj: cpfLimpo }),
        };
        
        const vendasData = await ssoticaRequest('/integracoes/vendas/periodo', token, vendasParams);
        
        let filteredVendas = vendasData.data || vendasData;
        
        if (cpfLimpo && Array.isArray(filteredVendas)) {
          filteredVendas = filteredVendas.filter((v: any) => {
            const vCpf = (v.cliente?.cpf || v.cpf_cliente || '').replace(/\D/g, '');
            return vCpf === cpfLimpo;
          });
        }

        console.log(`[ssOtica] Vendas encontradas para CPF ${cpfLimpo}: ${filteredVendas.length}`);

        result = {
          success: true,
          total: filteredVendas.length,
          cpf_consultado: cpfLimpo,
          vendas: filteredVendas.map((v: any) => ({
            numero_venda: v.numero || v.id,
            data_venda: v.data_venda || v.created_at,
            cliente: {
              nome: v.cliente?.nome || v.nome_cliente,
              cpf: v.cliente?.cpf || v.cpf_cliente,
            },
            itens: v.itens || v.produtos,
            valor_total: v.valor_total || v.total,
            forma_pagamento: v.forma_pagamento || v.pagamento,
            status: v.status,
          })),
        };
        break;
      }

      case 'consultar_parcelas_cliente': {
        // Get CPF from either cpf_cnpj or cpf parameter
        const cpfCliente = params?.cpf_cnpj || params?.cpf;
        const cpfLimpo = cpfCliente ? cpfCliente.replace(/\D/g, '') : null;
        
        console.log(`[ssOtica] consultar_parcelas_cliente - CPF: ${cpfLimpo}`);
        
        const contasParams: SsoticaQueryParams = {
          ...defaultParams,
          ...(cpfLimpo && { cpf_cnpj: cpfLimpo }),
        };
        
        const contasData = await ssoticaRequest('/integracoes/financeiro/contas-a-receber/periodo', token, contasParams);
        
        let filteredContas = contasData.data || contasData;
        
        if (cpfLimpo && Array.isArray(filteredContas)) {
          filteredContas = filteredContas.filter((c: any) => {
            const cCpf = (c.cliente?.cpf || c.cpf_cliente || '').replace(/\D/g, '');
            return cCpf === cpfLimpo;
          });
        }

        // Filter only open accounts
        const contasAbertas = filteredContas.filter((c: any) => 
          c.status === 'em_aberto' || c.status === 'aberto' || c.situacao === 'pendente' || !c.data_pagamento
        );

        console.log(`[ssOtica] Parcelas encontradas para CPF ${cpfLimpo}: ${contasAbertas.length}`);

        result = {
          success: true,
          total: contasAbertas.length,
          cpf_consultado: cpfLimpo,
          parcelas: contasAbertas.map((c: any) => ({
            numero_parcela: c.numero_parcela || c.parcela,
            documento: c.documento || c.numero_documento,
            valor: c.valor || c.valor_parcela,
            vencimento: c.vencimento || c.data_vencimento,
            status: c.status || c.situacao,
            cliente: {
              nome: c.cliente?.nome || c.nome_cliente,
              cpf: c.cliente?.cpf || c.cpf_cliente,
            },
            boleto_url: c.boleto_url || c.link_boleto,
            pix_copia_cola: c.pix_copia_cola || c.pix,
          })),
          valor_total_aberto: contasAbertas.reduce((sum: number, c: any) => 
            sum + (parseFloat(c.valor) || parseFloat(c.valor_parcela) || 0), 0
          ),
        };
        break;
      }

      case 'consultar_estoque': {
        const estoqueData = await ssoticaRequest('/produto/estoque/busca', token, {
          cnpj: empresaCnpj,
          termo: params?.termo || '',
        });

        result = {
          success: true,
          produtos: estoqueData.data || estoqueData,
        };
        break;
      }

      case 'consultar_extrato_financeiro': {
        const extratoData = await ssoticaRequest('/integracoes/financeiro/extrato/periodo', token, defaultParams);
        
        result = {
          success: true,
          lancamentos: extratoData.data || extratoData,
        };
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    console.log(`[ssOtica] Success:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ssOtica] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: 'Erro ao consultar sistema. Por favor, tente novamente ou aguarde atendimento humano.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
