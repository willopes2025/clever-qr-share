import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SSOTICA_BASE_URL = 'https://app.ssotica.com.br/api/v1';

async function ssoticaRequest(endpoint: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${SSOTICA_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
  });
  
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
    throw new Error(`ssOtica API error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

function extractCpf(item: any): string | null {
  const fields = [item.cliente?.cpf, item.cliente?.cpf_cnpj, item.cpf_cliente, item.cpf, item.cpf_cnpj, item.cliente?.documento];
  for (const field of fields) {
    if (field && typeof field === 'string') {
      const cleaned = field.replace(/\D/g, '');
      if (cleaned.length === 11) return cleaned;
    }
  }
  return null;
}

function generateDateWindows(lookbackDays: number): Array<{ inicio: string; fim: string }> {
  const windows: Array<{ inicio: string; fim: string }> = [];
  const hoje = new Date();
  let fimJanela = new Date(hoje);
  
  while (lookbackDays > 0) {
    const diasNaJanela = Math.min(30, lookbackDays);
    const inicioJanela = new Date(fimJanela);
    inicioJanela.setDate(fimJanela.getDate() - diasNaJanela);
    windows.push({ inicio: inicioJanela.toISOString().split('T')[0], fim: fimJanela.toISOString().split('T')[0] });
    fimJanela = new Date(inicioJanela);
    fimJanela.setDate(fimJanela.getDate() - 1);
    lookbackDays -= diasNaJanela;
  }
  return windows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ssoticaToken = Deno.env.get('SSOTICA_API_TOKEN');
    const ssoticaCnpj = Deno.env.get('SSOTICA_CNPJ');

    if (!ssoticaToken || !ssoticaCnpj) {
      return new Response(JSON.stringify({ error: 'ssOtica não configurado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader! } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userId = user.id;

    console.log(`[BULK-SSOTICA] Starting bulk sync for user ${userId}`);

    // 1. Fetch ALL active deals for user with contact data (paginated)
    let allDeals: any[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data: page, error: pageError } = await supabase
        .from('funnel_deals')
        .select('id, contact_id, custom_fields, contact:contacts(id, phone, custom_fields)')
        .eq('user_id', userId)
        .is('closed_at', null)
        .range(offset, offset + PAGE_SIZE - 1);
      
      if (pageError) throw pageError;
      if (!page || page.length === 0) break;
      allDeals.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const deals = allDeals;
    if (deals.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum deal ativo encontrado', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[BULK-SSOTICA] Found ${deals.length} active deals`);

    // 2. Build CPF/phone map for each deal
    const dealIdentifiers = deals.map((deal: any) => {
      const contact = deal.contact;
      let cpf: string | null = null;
      
      if (contact?.custom_fields) {
        const cf = contact.custom_fields as Record<string, unknown>;
        for (const key of ['cpf', 'cpf_cnpj', 'documento', 'CPF', 'Cpf']) {
          const val = cf[key];
          if (val && typeof val === 'string') {
            const cleaned = val.replace(/\D/g, '');
            if (cleaned.length === 11 || cleaned.length === 14) { cpf = cleaned; break; }
          }
        }
      }

      const phone = contact?.phone?.replace(/\D/g, '')?.replace(/^55/, '') || null;
      return { dealId: deal.id, contactId: deal.contact_id, cpf, phone, currentFields: (deal.custom_fields || {}) as Record<string, unknown> };
    });

    const dealsWithIdentifier = dealIdentifiers.filter(d => d.cpf || d.phone);
    console.log(`[BULK-SSOTICA] ${dealsWithIdentifier.length} deals with CPF/phone`);

    // 3. Fetch ssOtica data in bulk - use 30-day windows (last 365 days for CPF, 90 for phone)
    const windows = generateDateWindows(365);
    const cleanedCnpj = ssoticaCnpj.replace(/\D/g, '');

    // Fetch all OS, vendas, parcelas for the windows
    let allOs: any[] = [];
    let allVendas: any[] = [];
    let allParcelas: any[] = [];

    for (const window of windows) {
      try {
        const [osData, vendasData] = await Promise.all([
          ssoticaRequest('/integracoes/ordens-servico/periodo', ssoticaToken, {
            cnpj: cleanedCnpj, inicio_periodo: window.inicio, fim_periodo: window.fim, page: '1', perPage: '100',
          }).catch(() => ({ data: [] })),
          ssoticaRequest('/integracoes/vendas/periodo', ssoticaToken, {
            cnpj: cleanedCnpj, inicio_periodo: window.inicio, fim_periodo: window.fim, page: '1', perPage: '100',
          }).catch(() => ({ data: [] })),
        ]);
        
        const osItems = Array.isArray(osData?.data || osData) ? (osData?.data || osData) : [];
        const vendasItems = Array.isArray(vendasData?.data || vendasData) ? (vendasData?.data || vendasData) : [];
        
        allOs.push(...(Array.isArray(osItems) ? osItems : []));
        allVendas.push(...(Array.isArray(vendasItems) ? vendasItems : []));
        
        console.log(`[BULK-SSOTICA] Window ${window.inicio}-${window.fim}: ${osItems.length} OS, ${vendasItems.length} vendas`);
      } catch (e) {
        console.error(`[BULK-SSOTICA] Error in window ${window.inicio}:`, e);
      }
    }

    // Fetch parcelas (windowed, 31-day max, only last 90 days)
    const parcelasWindows = generateDateWindows(90);
    for (const window of parcelasWindows) {
      try {
        const parcelasData = await ssoticaRequest('/integracoes/financeiro/contas-a-receber/periodo', ssoticaToken, {
          cnpj: cleanedCnpj, inicio_periodo: window.inicio, fim_periodo: window.fim, page: '1', perPage: '100',
        });
        const items = Array.isArray(parcelasData?.data || parcelasData) ? (parcelasData?.data || parcelasData) : [];
        if (Array.isArray(items)) allParcelas.push(...items);
        console.log(`[BULK-SSOTICA] Parcelas window ${window.inicio}-${window.fim}: ${Array.isArray(items) ? items.length : 0}`);
      } catch (e) {
        console.error(`[BULK-SSOTICA] Error fetching parcelas window ${window.inicio}:`, e);
      }
    }

    console.log(`[BULK-SSOTICA] Total fetched: ${allOs.length} OS, ${allVendas.length} vendas, ${allParcelas.length} parcelas`);

    // 4. Index by CPF and phone
    const indexByCpf = (items: any[]) => {
      const map: Record<string, any[]> = {};
      for (const item of items) {
        const cpf = extractCpf(item);
        if (cpf) {
          if (!map[cpf]) map[cpf] = [];
          map[cpf].push(item);
        }
      }
      return map;
    };

    const indexByPhone = (items: any[]) => {
      const map: Record<string, any[]> = {};
      for (const item of items) {
        const phone = (item.cliente?.telefone || item.telefone_cliente || '').replace(/\D/g, '').replace(/^55/, '');
        if (phone && phone.length >= 10) {
          if (!map[phone]) map[phone] = [];
          map[phone].push(item);
        }
      }
      return map;
    };

    const osByCpf = indexByCpf(allOs);
    const vendasByCpf = indexByCpf(allVendas);
    const parcelasByCpf = indexByCpf(allParcelas);
    const osByPhone = indexByPhone(allOs);
    const vendasByPhone = indexByPhone(allVendas);
    const parcelasByPhone = indexByPhone(allParcelas);

    // 5. Match each deal and update
    let synced = 0;
    let errors = 0;

    for (const deal of dealsWithIdentifier) {
      try {
        let matchedOs: any[] = [];
        let matchedVendas: any[] = [];
        let matchedParcelas: any[] = [];

        if (deal.cpf) {
          matchedOs = osByCpf[deal.cpf] || [];
          matchedVendas = vendasByCpf[deal.cpf] || [];
          matchedParcelas = parcelasByCpf[deal.cpf] || [];
        }
        
        if (matchedOs.length === 0 && matchedVendas.length === 0 && deal.phone) {
          // Fallback to phone matching
          const phoneClean = deal.phone;
          for (const [key, items] of Object.entries(osByPhone)) {
            if (key.includes(phoneClean) || phoneClean.includes(key)) {
              matchedOs.push(...items);
            }
          }
          for (const [key, items] of Object.entries(vendasByPhone)) {
            if (key.includes(phoneClean) || phoneClean.includes(key)) {
              matchedVendas.push(...items);
            }
          }
          for (const [key, items] of Object.entries(parcelasByPhone)) {
            if (key.includes(phoneClean) || phoneClean.includes(key)) {
              matchedParcelas.push(...items);
            }
          }
        }

        if (matchedOs.length === 0 && matchedVendas.length === 0 && matchedParcelas.length === 0) {
          continue; // No data for this deal
        }

        // Build sync data
        const lastOs = matchedOs[0];
        const lastVenda = matchedVendas[0];
        const sortedParcelas = [...matchedParcelas].sort((a, b) => {
          const dateA = new Date(a.vencimento || a.data_vencimento || '9999-12-31');
          const dateB = new Date(b.vencimento || b.data_vencimento || '9999-12-31');
          return dateA.getTime() - dateB.getTime();
        });
        const urgentParcela = sortedParcelas[0];
        const valorTotalAberto = matchedParcelas.reduce((sum: number, p: any) => sum + (parseFloat(p.valor || p.valor_parcela) || 0), 0);

        const ssoticaFields: Record<string, unknown> = {
          ssotica_ultima_sync: new Date().toISOString(),
          ssotica_total_os: matchedOs.length,
          ssotica_total_vendas: matchedVendas.length,
          ssotica_total_parcelas_abertas: matchedParcelas.length,
          ssotica_valor_total_aberto: valorTotalAberto,
          ...(lastOs && {
            ssotica_os_numero: lastOs.numero_os || lastOs.numero || '',
            ssotica_os_status: lastOs.status || '',
            ssotica_os_etapa_atual: lastOs.etapa_atual || '',
            ssotica_os_tipo: lastOs.tipo_os || '',
            ssotica_os_data_entrada: lastOs.data_entrada || '',
            ssotica_os_previsao_entrega: lastOs.previsao_entrega || '',
            ssotica_os_valor_total: parseFloat(lastOs.valor_total) || 0,
            ssotica_os_observacoes: lastOs.observacoes || '',
            ssotica_os_receita: typeof lastOs.receita === 'object' ? JSON.stringify(lastOs.receita) : (lastOs.receita || ''),
          }),
          ...(lastVenda && {
            ssotica_venda_numero: lastVenda.numero_venda || lastVenda.numero || '',
            ssotica_venda_data: lastVenda.data_venda || '',
            ssotica_venda_valor_total: parseFloat(lastVenda.valor_total) || 0,
            ssotica_venda_forma_pagamento: lastVenda.forma_pagamento || '',
            ssotica_venda_status: lastVenda.status || '',
          }),
          ...(urgentParcela && {
            ssotica_parcela_numero: urgentParcela.numero_parcela || urgentParcela.numero || '',
            ssotica_parcela_documento: urgentParcela.documento || '',
            ssotica_parcela_valor: parseFloat(urgentParcela.valor || urgentParcela.valor_parcela) || 0,
            ssotica_parcela_vencimento: urgentParcela.vencimento || urgentParcela.data_vencimento || '',
            ssotica_parcela_status: urgentParcela.status || '',
            ssotica_parcela_boleto_url: urgentParcela.boleto_url || '',
            ssotica_parcela_pix: urgentParcela.pix_copia_cola || '',
          }),
          ssotica_todas_os: JSON.stringify(matchedOs),
          ssotica_todas_vendas: JSON.stringify(matchedVendas),
          ssotica_todas_parcelas: JSON.stringify(matchedParcelas),
        };

        const mergedFields = { ...deal.currentFields, ...ssoticaFields };

        const { error: updateError } = await supabase
          .from('funnel_deals')
          .update({ custom_fields: mergedFields })
          .eq('id', deal.dealId);

        if (updateError) {
          console.error(`[BULK-SSOTICA] Error updating deal ${deal.dealId}:`, updateError);
          errors++;
        } else {
          synced++;
        }
      } catch (e) {
        console.error(`[BULK-SSOTICA] Error processing deal ${deal.dealId}:`, e);
        errors++;
      }
    }

    console.log(`[BULK-SSOTICA] Complete: ${synced} synced, ${errors} errors out of ${dealsWithIdentifier.length} deals`);

    return new Response(JSON.stringify({
      message: `Sincronização concluída`,
      total_deals: deals.length,
      deals_with_identifier: dealsWithIdentifier.length,
      synced,
      errors,
      total_os_fetched: allOs.length,
      total_vendas_fetched: allVendas.length,
      total_parcelas_fetched: allParcelas.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[BULK-SSOTICA] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
