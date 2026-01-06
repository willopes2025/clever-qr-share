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
  cpf_cnpj?: string;
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

// Helper to extract and normalize CPF from various payload fields
function extractCpf(item: any): string | null {
  const possibleFields = [
    item.cliente?.cpf,
    item.cliente?.cpf_cnpj,
    item.cpf_cliente,
    item.cpf,
    item.cpf_cnpj,
    item.cliente?.documento,
  ];
  
  for (const field of possibleFields) {
    if (field && typeof field === 'string') {
      const cleaned = field.replace(/\D/g, '');
      if (cleaned.length === 11) {
        return cleaned;
      }
    }
  }
  
  return null;
}

// Helper to generate 30-day windows for lookback search
function generateDateWindows(lookbackDays: number = 365): Array<{ inicio: string; fim: string }> {
  const windows: Array<{ inicio: string; fim: string }> = [];
  const hoje = new Date();
  
  let fimJanela = new Date(hoje);
  
  while (lookbackDays > 0) {
    const diasNaJanela = Math.min(30, lookbackDays);
    const inicioJanela = new Date(fimJanela);
    inicioJanela.setDate(fimJanela.getDate() - diasNaJanela);
    
    windows.push({
      inicio: inicioJanela.toISOString().split('T')[0],
      fim: fimJanela.toISOString().split('T')[0],
    });
    
    fimJanela = new Date(inicioJanela);
    fimJanela.setDate(fimJanela.getDate() - 1);
    lookbackDays -= diasNaJanela;
  }
  
  return windows;
}

// Search OS with lookback in 30-day windows - STRICT CPF FILTERING
async function searchOSWithLookback(
  token: string,
  empresaCnpj: string,
  cpfCliente: string | null,
  lookbackDays: number = 365
): Promise<{ 
  data: any[]; 
  windowsSearched: number; 
  periodStart: string; 
  periodEnd: string;
  cpfValidado: boolean;
  rawTotal: number;
  itensComCpf: number;
  motivoFalhaFiltro: string | null;
}> {
  const windows = generateDateWindows(lookbackDays);
  let windowsSearched = 0;
  let rawTotal = 0;
  let itensComCpf = 0;
  
  for (const window of windows) {
    windowsSearched++;
    
    const params: SsoticaQueryParams = {
      cnpj: empresaCnpj,
      inicio_periodo: window.inicio,
      fim_periodo: window.fim,
      page: 1,
      perPage: 100,
      ...(cpfCliente && { cpf_cnpj: cpfCliente }),
    };
    
    console.log(`[ssOtica] Searching window ${windowsSearched}/${windows.length}: ${window.inicio} to ${window.fim}`);
    
    try {
      const osData = await ssoticaRequest('/integracoes/ordens-servico/periodo', token, params);
      let items = osData.data || osData;
      
      if (!Array.isArray(items)) items = [];
      
      rawTotal += items.length;
      
      if (items.length === 0) continue;
      
      // STRICT CPF FILTERING: Only match items with verified CPF
      if (cpfCliente) {
        const itemsWithCpf: any[] = [];
        const validatedItems: any[] = [];
        
        for (const os of items) {
          const osCpf = extractCpf(os);
          if (osCpf) {
            itemsWithCpf.push(os);
            if (osCpf === cpfCliente) {
              validatedItems.push(os);
            }
          }
        }
        
        itensComCpf += itemsWithCpf.length;
        
        console.log(`[ssOtica] Window ${window.inicio}: ${items.length} raw items, ${itemsWithCpf.length} with CPF, ${validatedItems.length} matched CPF ${cpfCliente}`);
        
        // ONLY return validated items (strict match)
        if (validatedItems.length > 0) {
          return { 
            data: validatedItems, 
            windowsSearched, 
            periodStart: window.inicio, 
            periodEnd: window.fim,
            cpfValidado: true,
            rawTotal,
            itensComCpf,
            motivoFalhaFiltro: null,
          };
        }
        
        // If items exist but none have CPF, the API isn't returning CPF data
        // Continue searching other windows to be thorough
      } else {
        // No CPF filter requested - return all (unsafe, but allowed for admin queries)
        return { 
          data: items, 
          windowsSearched, 
          periodStart: window.inicio, 
          periodEnd: window.fim,
          cpfValidado: false,
          rawTotal,
          itensComCpf: 0,
          motivoFalhaFiltro: 'cpf_nao_informado',
        };
      }
    } catch (error) {
      console.error(`[ssOtica] Error in window ${window.inicio} to ${window.fim}:`, error);
    }
  }
  
  // Searched all windows but found no validated matches
  let motivoFalha: string | null = null;
  if (rawTotal === 0) {
    motivoFalha = 'nenhuma_os_encontrada_no_periodo';
  } else if (itensComCpf === 0) {
    motivoFalha = 'cpf_ausente_no_payload_api';
  } else {
    motivoFalha = 'nenhuma_os_com_cpf_correspondente';
  }
  
  console.log(`[ssOtica] CPF filter result: rawTotal=${rawTotal}, itensComCpf=${itensComCpf}, motivo=${motivoFalha}`);
  
  return { 
    data: [], 
    windowsSearched, 
    periodStart: '', 
    periodEnd: '',
    cpfValidado: false,
    rawTotal,
    itensComCpf,
    motivoFalhaFiltro: motivoFalha,
  };
}

// Search OS by number with lookback - STRICT equality match
async function searchOSByNumber(
  token: string,
  empresaCnpj: string,
  numeroOS: string,
  lookbackDays: number = 365
): Promise<{ data: any | null; windowsSearched: number; periodFound: string | null }> {
  const windows = generateDateWindows(lookbackDays);
  let windowsSearched = 0;
  const numeroLimpo = numeroOS.replace(/\D/g, '');
  
  for (const window of windows) {
    windowsSearched++;
    
    console.log(`[ssOtica] Searching OS ${numeroOS} in window ${windowsSearched}/${windows.length}: ${window.inicio} to ${window.fim}`);
    
    // Paginate through each window
    for (let page = 1; page <= 10; page++) {
      const params: SsoticaQueryParams = {
        cnpj: empresaCnpj,
        inicio_periodo: window.inicio,
        fim_periodo: window.fim,
        page,
        perPage: 100,
      };
      
      try {
        const osData = await ssoticaRequest('/integracoes/ordens-servico/periodo', token, params);
        let items = osData.data || osData;
        
        if (!Array.isArray(items) || items.length === 0) break;
        
        // Find by OS number - STRICT EQUALITY ONLY
        const found = items.find((os: any) => {
          const osNum = String(os.numero || '');
          const osId = String(os.id || '');
          const osNumero2 = String(os.numero_os || '');
          
          // Strict equality only - no endsWith which causes false positives
          return osNum === numeroLimpo || 
                 osNum === numeroOS || 
                 osId === numeroLimpo || 
                 osId === numeroOS ||
                 osNumero2 === numeroLimpo ||
                 osNumero2 === numeroOS;
        });
        
        if (found) {
          console.log(`[ssOtica] Found OS ${numeroOS} in window ${window.inicio} to ${window.fim}`);
          return { 
            data: found, 
            windowsSearched, 
            periodFound: `${window.inicio} a ${window.fim}` 
          };
        }
        
        // If less than perPage items, no more pages
        if (items.length < 100) break;
      } catch (error) {
        console.error(`[ssOtica] Error searching OS ${numeroOS} page ${page}:`, error);
        break;
      }
    }
  }
  
  return { data: null, windowsSearched, periodFound: null };
}

// Search sales with lookback - STRICT CPF FILTERING
async function searchVendasWithLookback(
  token: string,
  empresaCnpj: string,
  cpfCliente: string | null,
  lookbackDays: number = 365
): Promise<{ 
  data: any[]; 
  windowsSearched: number; 
  periodStart: string; 
  periodEnd: string;
  cpfValidado: boolean;
  rawTotal: number;
  motivoFalhaFiltro: string | null;
}> {
  const windows = generateDateWindows(lookbackDays);
  let windowsSearched = 0;
  let rawTotal = 0;
  let itensComCpf = 0;
  
  for (const window of windows) {
    windowsSearched++;
    
    const params: SsoticaQueryParams = {
      cnpj: empresaCnpj,
      inicio_periodo: window.inicio,
      fim_periodo: window.fim,
      page: 1,
      perPage: 100,
      ...(cpfCliente && { cpf_cnpj: cpfCliente }),
    };
    
    console.log(`[ssOtica] Searching vendas window ${windowsSearched}/${windows.length}: ${window.inicio} to ${window.fim}`);
    
    try {
      const vendasData = await ssoticaRequest('/integracoes/vendas/periodo', token, params);
      let items = vendasData.data || vendasData;
      
      if (!Array.isArray(items)) items = [];
      
      rawTotal += items.length;
      
      if (items.length === 0) continue;
      
      // STRICT CPF FILTERING
      if (cpfCliente) {
        const validatedItems: any[] = [];
        
        for (const v of items) {
          const vCpf = extractCpf(v);
          if (vCpf) itensComCpf++;
          if (vCpf === cpfCliente) {
            validatedItems.push(v);
          }
        }
        
        if (validatedItems.length > 0) {
          return { 
            data: validatedItems, 
            windowsSearched, 
            periodStart: window.inicio, 
            periodEnd: window.fim,
            cpfValidado: true,
            rawTotal,
            motivoFalhaFiltro: null,
          };
        }
      } else {
        return { 
          data: items, 
          windowsSearched, 
          periodStart: window.inicio, 
          periodEnd: window.fim,
          cpfValidado: false,
          rawTotal,
          motivoFalhaFiltro: 'cpf_nao_informado',
        };
      }
    } catch (error) {
      console.error(`[ssOtica] Error in vendas window:`, error);
    }
  }
  
  let motivoFalha: string | null = null;
  if (rawTotal === 0) {
    motivoFalha = 'nenhuma_venda_encontrada_no_periodo';
  } else if (itensComCpf === 0) {
    motivoFalha = 'cpf_ausente_no_payload_api';
  } else {
    motivoFalha = 'nenhuma_venda_com_cpf_correspondente';
  }
  
  return { 
    data: [], 
    windowsSearched, 
    periodStart: '', 
    periodEnd: '',
    cpfValidado: false,
    rawTotal,
    motivoFalhaFiltro: motivoFalha,
  };
}

// Search parcelas with lookback - STRICT CPF FILTERING
async function searchParcelasWithLookback(
  token: string,
  empresaCnpj: string,
  cpfCliente: string | null,
  lookbackDays: number = 365
): Promise<{ 
  data: any[]; 
  windowsSearched: number; 
  periodStart: string; 
  periodEnd: string;
  cpfValidado: boolean;
  rawTotal: number;
  motivoFalhaFiltro: string | null;
}> {
  const windows = generateDateWindows(lookbackDays);
  let windowsSearched = 0;
  let rawTotal = 0;
  let itensComCpf = 0;
  
  for (const window of windows) {
    windowsSearched++;
    
    const params: SsoticaQueryParams = {
      cnpj: empresaCnpj,
      inicio_periodo: window.inicio,
      fim_periodo: window.fim,
      page: 1,
      perPage: 100,
      ...(cpfCliente && { cpf_cnpj: cpfCliente }),
    };
    
    console.log(`[ssOtica] Searching parcelas window ${windowsSearched}/${windows.length}: ${window.inicio} to ${window.fim}`);
    
    try {
      const contasData = await ssoticaRequest('/integracoes/financeiro/contas-a-receber/periodo', token, params);
      let items = contasData.data || contasData;
      
      if (!Array.isArray(items)) items = [];
      
      rawTotal += items.length;
      
      if (items.length === 0) continue;
      
      // STRICT CPF FILTERING
      if (cpfCliente) {
        const validatedItems: any[] = [];
        
        for (const c of items) {
          const cCpf = extractCpf(c);
          if (cCpf) itensComCpf++;
          if (cCpf === cpfCliente) {
            validatedItems.push(c);
          }
        }
        
        // Filter open accounts from validated items only
        const contasAbertas = validatedItems.filter((c: any) => 
          c.status === 'em_aberto' || c.status === 'aberto' || c.situacao === 'pendente' || !c.data_pagamento
        );
        
        if (contasAbertas.length > 0) {
          return { 
            data: contasAbertas, 
            windowsSearched, 
            periodStart: window.inicio, 
            periodEnd: window.fim,
            cpfValidado: true,
            rawTotal,
            motivoFalhaFiltro: null,
          };
        }
      } else {
        const contasAbertas = items.filter((c: any) => 
          c.status === 'em_aberto' || c.status === 'aberto' || c.situacao === 'pendente' || !c.data_pagamento
        );
        
        if (contasAbertas.length > 0) {
          return { 
            data: contasAbertas, 
            windowsSearched, 
            periodStart: window.inicio, 
            periodEnd: window.fim,
            cpfValidado: false,
            rawTotal,
            motivoFalhaFiltro: 'cpf_nao_informado',
          };
        }
      }
    } catch (error) {
      console.error(`[ssOtica] Error in parcelas window:`, error);
    }
  }
  
  let motivoFalha: string | null = null;
  if (rawTotal === 0) {
    motivoFalha = 'nenhuma_parcela_encontrada_no_periodo';
  } else if (itensComCpf === 0) {
    motivoFalha = 'cpf_ausente_no_payload_api';
  } else {
    motivoFalha = 'nenhuma_parcela_com_cpf_correspondente';
  }
  
  return { 
    data: [], 
    windowsSearched, 
    periodStart: '', 
    periodEnd: '',
    cpfValidado: false,
    rawTotal,
    motivoFalhaFiltro: motivoFalha,
  };
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
    const lookbackDays = params?.lookback_days || 365;

    let result: any;

    switch (action) {
      case 'consultar_os_cliente': {
        const cpfCliente = params?.cpf_cnpj || params?.cpf;
        const cpfLimpo = cpfCliente ? cpfCliente.replace(/\D/g, '') : null;
        
        console.log(`[ssOtica] consultar_os_cliente - CPF: ${cpfLimpo}, lookback: ${lookbackDays} days`);
        
        const searchResult = await searchOSWithLookback(token, empresaCnpj, cpfLimpo, lookbackDays);
        
        console.log(`[ssOtica] OS encontradas para CPF ${cpfLimpo}: ${searchResult.data.length} (validado: ${searchResult.cpfValidado}, raw: ${searchResult.rawTotal}, motivo: ${searchResult.motivoFalhaFiltro})`);

        result = {
          success: true,
          total: searchResult.data.length,
          cpf_consultado: cpfLimpo,
          cpf_validado: searchResult.cpfValidado,
          periodo_consultado: searchResult.periodStart && searchResult.periodEnd 
            ? `${searchResult.periodStart} a ${searchResult.periodEnd}` 
            : `últimos ${lookbackDays} dias`,
          janelas_verificadas: searchResult.windowsSearched,
          raw_total: searchResult.rawTotal,
          itens_com_cpf: searchResult.itensComCpf,
          motivo_falha_filtro: searchResult.motivoFalhaFiltro,
          ordens_servico: searchResult.data.map((os: any) => ({
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

      case 'consultar_os_por_numero': {
        const numeroOS = params?.numero_os || params?.numero;
        
        if (!numeroOS) {
          throw new Error('Número da OS é obrigatório');
        }
        
        console.log(`[ssOtica] consultar_os_por_numero - OS: ${numeroOS}, lookback: ${lookbackDays} days`);
        
        const searchResult = await searchOSByNumber(token, empresaCnpj, String(numeroOS), lookbackDays);
        
        if (searchResult.data) {
          const os = searchResult.data;
          result = {
            success: true,
            total: 1,
            numero_os_consultado: numeroOS,
            periodo_encontrado: searchResult.periodFound,
            janelas_verificadas: searchResult.windowsSearched,
            ordem_servico: {
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
            },
          };
        } else {
          result = {
            success: true,
            total: 0,
            numero_os_consultado: numeroOS,
            janelas_verificadas: searchResult.windowsSearched,
            mensagem: `Não encontrei OS com número ${numeroOS} nos últimos ${lookbackDays} dias.`,
          };
        }
        break;
      }

      case 'consultar_vendas_cliente': {
        const cpfCliente = params?.cpf_cnpj || params?.cpf;
        const cpfLimpo = cpfCliente ? cpfCliente.replace(/\D/g, '') : null;
        
        console.log(`[ssOtica] consultar_vendas_cliente - CPF: ${cpfLimpo}, lookback: ${lookbackDays} days`);
        
        const searchResult = await searchVendasWithLookback(token, empresaCnpj, cpfLimpo, lookbackDays);
        
        console.log(`[ssOtica] Vendas encontradas para CPF ${cpfLimpo}: ${searchResult.data.length} (validado: ${searchResult.cpfValidado})`);

        result = {
          success: true,
          total: searchResult.data.length,
          cpf_consultado: cpfLimpo,
          cpf_validado: searchResult.cpfValidado,
          periodo_consultado: searchResult.periodStart && searchResult.periodEnd 
            ? `${searchResult.periodStart} a ${searchResult.periodEnd}` 
            : `últimos ${lookbackDays} dias`,
          janelas_verificadas: searchResult.windowsSearched,
          raw_total: searchResult.rawTotal,
          motivo_falha_filtro: searchResult.motivoFalhaFiltro,
          vendas: searchResult.data.map((v: any) => ({
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
        const cpfCliente = params?.cpf_cnpj || params?.cpf;
        const cpfLimpo = cpfCliente ? cpfCliente.replace(/\D/g, '') : null;
        
        console.log(`[ssOtica] consultar_parcelas_cliente - CPF: ${cpfLimpo}, lookback: ${lookbackDays} days`);
        
        const searchResult = await searchParcelasWithLookback(token, empresaCnpj, cpfLimpo, lookbackDays);
        
        console.log(`[ssOtica] Parcelas encontradas para CPF ${cpfLimpo}: ${searchResult.data.length} (validado: ${searchResult.cpfValidado})`);

        const valorTotalAberto = searchResult.data.reduce((sum: number, c: any) => 
          sum + (parseFloat(c.valor) || parseFloat(c.valor_parcela) || 0), 0
        );

        result = {
          success: true,
          total: searchResult.data.length,
          cpf_consultado: cpfLimpo,
          cpf_validado: searchResult.cpfValidado,
          periodo_consultado: searchResult.periodStart && searchResult.periodEnd 
            ? `${searchResult.periodStart} a ${searchResult.periodEnd}` 
            : `últimos ${lookbackDays} dias`,
          janelas_verificadas: searchResult.windowsSearched,
          raw_total: searchResult.rawTotal,
          motivo_falha_filtro: searchResult.motivoFalhaFiltro,
          parcelas: searchResult.data.map((c: any) => ({
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
          valor_total_aberto: valorTotalAberto,
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
        const hoje = new Date();
        const inicio = new Date();
        inicio.setDate(hoje.getDate() - 30);
        
        const extratoData = await ssoticaRequest('/integracoes/financeiro/extrato/periodo', token, {
          cnpj: empresaCnpj,
          inicio_periodo: params?.inicio_periodo || inicio.toISOString().split('T')[0],
          fim_periodo: params?.fim_periodo || hoje.toISOString().split('T')[0],
          page: params?.page || 1,
          perPage: params?.perPage || 50,
        });
        
        result = {
          success: true,
          lancamentos: extratoData.data || extratoData,
        };
        break;
      }

      // === LISTAGEM GERAL (sem filtro de CPF) para dashboard ===
      case 'listar_os': {
        console.log(`[ssOtica] listar_os - lookback: ${lookbackDays} days`);
        
        const searchResult = await searchOSWithLookback(token, empresaCnpj, null, lookbackDays);
        
        console.log(`[ssOtica] OS listadas: ${searchResult.data.length} (raw: ${searchResult.rawTotal})`);

        result = {
          success: true,
          total: searchResult.data.length,
          periodo_consultado: searchResult.periodStart && searchResult.periodEnd 
            ? `${searchResult.periodStart} a ${searchResult.periodEnd}` 
            : `últimos ${lookbackDays} dias`,
          janelas_verificadas: searchResult.windowsSearched,
          data: searchResult.data.map((os: any) => ({
            id: os.id,
            numero: os.numero || os.id,
            status: os.status || os.situacao,
            previsao_entrega: os.previsao_entrega || os.data_previsao,
            data_entrada: os.data_entrada || os.created_at,
            cliente: {
              nome: os.cliente?.nome || os.nome_cliente,
              cpf: os.cliente?.cpf || os.cpf_cliente,
              telefone: os.cliente?.telefone || os.telefone_cliente,
            },
            valor_total: os.valor_total || os.total,
            observacoes: os.observacoes || os.obs,
          })),
        };
        break;
      }

      case 'listar_vendas': {
        console.log(`[ssOtica] listar_vendas - lookback: ${lookbackDays} days`);
        
        const searchResult = await searchVendasWithLookback(token, empresaCnpj, null, lookbackDays);
        
        console.log(`[ssOtica] Vendas listadas: ${searchResult.data.length} (raw: ${searchResult.rawTotal})`);

        result = {
          success: true,
          total: searchResult.data.length,
          periodo_consultado: searchResult.periodStart && searchResult.periodEnd 
            ? `${searchResult.periodStart} a ${searchResult.periodEnd}` 
            : `últimos ${lookbackDays} dias`,
          janelas_verificadas: searchResult.windowsSearched,
          data: searchResult.data.map((v: any) => ({
            id: v.id,
            numero: v.numero || v.id,
            data_venda: v.data_venda || v.created_at,
            cliente: {
              nome: v.cliente?.nome || v.nome_cliente,
              cpf: v.cliente?.cpf || v.cpf_cliente,
            },
            valor_total: v.valor_total || v.total,
            forma_pagamento: v.forma_pagamento || v.pagamento,
            status: v.status,
          })),
        };
        break;
      }

      case 'listar_parcelas': {
        console.log(`[ssOtica] listar_parcelas - lookback: ${lookbackDays} days`);
        
        const searchResult = await searchParcelasWithLookback(token, empresaCnpj, null, lookbackDays);
        
        console.log(`[ssOtica] Parcelas listadas: ${searchResult.data.length} (raw: ${searchResult.rawTotal})`);

        const valorTotalAberto = searchResult.data.reduce((sum: number, c: any) => 
          sum + (parseFloat(c.valor) || parseFloat(c.valor_parcela) || 0), 0
        );

        result = {
          success: true,
          total: searchResult.data.length,
          periodo_consultado: searchResult.periodStart && searchResult.periodEnd 
            ? `${searchResult.periodStart} a ${searchResult.periodEnd}` 
            : `últimos ${lookbackDays} dias`,
          janelas_verificadas: searchResult.windowsSearched,
          valor_total_aberto: valorTotalAberto,
          data: searchResult.data.map((c: any) => ({
            id: c.id,
            numero: c.numero_parcela || c.parcela,
            documento: c.documento || c.numero_documento,
            valor: c.valor || c.valor_parcela,
            vencimento: c.vencimento || c.data_vencimento,
            status: c.status || c.situacao || 'em_aberto',
            cliente: {
              nome: c.cliente?.nome || c.nome_cliente,
              cpf: c.cliente?.cpf || c.cpf_cliente,
            },
            boleto_url: c.boleto_url || c.link_boleto,
            pix_copia_cola: c.pix_copia_cola || c.pix,
          })),
        };
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    console.log(`[ssOtica] Success:`, JSON.stringify(result).substring(0, 500));

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
