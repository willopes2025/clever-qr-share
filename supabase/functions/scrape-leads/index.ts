import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  mode: 'search' | 'cnpj';
  // For mode='search' (Premium)
  estado_id?: string;
  cidade_id?: string;
  cnae_id?: string;
  limite?: number;
  apenas_ativos?: boolean;
  // For mode='cnpj' (Basic)
  cnpjs?: string[];
}

interface CNPJWSCompany {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  telefone: string;
  atividade_principal: {
    codigo: string;
    descricao: string;
  };
  porte: string;
  situacao_cadastral: string;
  capital_social: number;
  data_abertura: string;
}

// Helper to normalize CNPJ (remove non-digits)
function normalizeCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

// Validate CNPJ format (14 digits)
function isValidCNPJ(cnpj: string): boolean {
  const normalized = normalizeCNPJ(cnpj);
  return normalized.length === 14 && /^\d+$/.test(normalized);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestBody: ScrapeRequest = await req.json();
    const mode = requestBody.mode || 'search';

    console.log('Scrape request:', requestBody);

    const cnpjwsApiKey = Deno.env.get('CNPJWS_API_KEY');
    if (!cnpjwsApiKey) {
      return new Response(JSON.stringify({ error: 'CNPJWS API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let cnpjsToFetch: string[] = [];

    // ========== MODE: CNPJ (Direct lookup - works with basic plan) ==========
    if (mode === 'cnpj') {
      const { cnpjs = [] } = requestBody;
      
      if (!cnpjs.length) {
        return new Response(JSON.stringify({ error: 'No CNPJs provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate and normalize CNPJs
      const validCnpjs: string[] = [];
      const invalidCnpjs: string[] = [];
      
      for (const cnpj of cnpjs) {
        const normalized = normalizeCNPJ(cnpj);
        if (isValidCNPJ(cnpj)) {
          validCnpjs.push(normalized);
        } else {
          invalidCnpjs.push(cnpj);
        }
      }

      if (invalidCnpjs.length > 0) {
        console.warn('Invalid CNPJs ignored:', invalidCnpjs);
      }

      if (validCnpjs.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No valid CNPJs provided',
          details: `Invalid CNPJs: ${invalidCnpjs.join(', ')}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Limit to 20 CNPJs to avoid rate limiting
      cnpjsToFetch = validCnpjs.slice(0, 20);
      console.log(`Processing ${cnpjsToFetch.length} CNPJs in direct mode`);

    // ========== MODE: SEARCH (Premium only) ==========
    } else {
      const { estado_id, cidade_id, cnae_id, limite = 20, apenas_ativos = true } = requestBody;

      if (!estado_id || !cnae_id) {
        return new Response(JSON.stringify({ error: 'estado_id and cnae_id are required for search mode' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build search URL for CNPJ.ws - using pesquisa endpoint with correct filters
      const searchParams = new URLSearchParams();
      searchParams.set('estado_id', estado_id);
      if (cidade_id) {
        searchParams.set('cidade_id', cidade_id);
      }
      searchParams.set('atividade_principal_id', cnae_id);
      if (apenas_ativos) {
        searchParams.set('situacao_cadastral', 'ATIVA');
      }
      searchParams.set('limite', String(Math.min(limite, 100)));

      console.log('Calling CNPJ.ws search API with params:', searchParams.toString());

      // Call CNPJ.ws search API - use x_api_token header as per documentation
      const searchResponse = await fetch(`https://comercial.cnpj.ws/pesquisa?${searchParams.toString()}`, {
        headers: {
          'x_api_token': cnpjwsApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        let upstream: any = null;
        try {
          upstream = JSON.parse(errorText);
        } catch {
          // ignore
        }

        // CNPJ.ws /pesquisa is Premium-only (per docs). Give a clear hint when access is denied.
        const hint =
          upstream?.status === 403
            ? 'O endpoint /pesquisa da CNPJ.ws requer plano Premium. Use a aba "Por CNPJ" para consultar CNPJs específicos (funciona com plano básico).'
            : upstream?.status === 401
              ? 'Seu token CNPJ.ws não foi aceito. Verifique se o token está correto.'
              : undefined;

        console.error('CNPJ.ws API error:', searchResponse.status, upstream ?? errorText);

        return new Response(
          JSON.stringify({
            error: 'Falha ao buscar dados da CNPJ.ws',
            details: upstream ?? errorText,
            hint,
          }),
          {
            status: searchResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const searchResult = await searchResponse.json();
      const cnpjList: string[] = searchResult.data || [];
      console.log(`Found ${cnpjList.length} CNPJs from search`);

      if (cnpjList.length === 0) {
        return new Response(JSON.stringify({ 
          success: true,
          leads: [],
          count: 0 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      cnpjsToFetch = cnpjList.slice(0, Math.min(limite, 50));
    }

    // ========== FETCH DETAILS FOR EACH CNPJ ==========
    const companies: CNPJWSCompany[] = [];
    const errors: { cnpj: string; error: string }[] = [];
    
    for (const cnpj of cnpjsToFetch) {
      try {
        console.log(`Fetching details for CNPJ: ${cnpj}`);
        const detailResponse = await fetch(`https://comercial.cnpj.ws/cnpj/${cnpj}`, {
          headers: {
            'x_api_token': cnpjwsApiKey,
            'Content-Type': 'application/json',
          },
        });
        
        if (detailResponse.ok) {
          const company = await detailResponse.json();
          companies.push(company);
        } else {
          const errText = await detailResponse.text();
          console.error(`Error fetching CNPJ ${cnpj}:`, detailResponse.status, errText);
          errors.push({ cnpj, error: `HTTP ${detailResponse.status}` });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (e) {
        console.error(`Exception fetching CNPJ ${cnpj}:`, e);
        errors.push({ cnpj, error: String(e) });
      }
    }
    
    console.log(`Fetched details for ${companies.length} companies, ${errors.length} errors`);

    if (companies.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        leads: [],
        count: 0,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0 ? 'Nenhum CNPJ foi encontrado. Verifique se os CNPJs são válidos.' : 'Nenhum resultado encontrado.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform and save leads
    const leads = companies.map(company => ({
      user_id: user.id,
      cnpj: normalizeCNPJ(company.cnpj),
      razao_social: company.razao_social,
      nome_fantasia: company.nome_fantasia || company.razao_social,
      phone: company.telefone?.replace(/\D/g, '') || null,
      email: company.email?.toLowerCase() || null,
      address: [company.logradouro, company.numero, company.complemento].filter(Boolean).join(', '),
      neighborhood: company.bairro,
      city: company.municipio,
      state: company.uf,
      cep: company.cep?.replace(/\D/g, ''),
      cnae_code: company.atividade_principal?.codigo,
      cnae_description: company.atividade_principal?.descricao,
      porte: company.porte,
      situacao_cadastral: company.situacao_cadastral,
      capital_social: company.capital_social,
      data_abertura: company.data_abertura || null,
      source: 'cnpjws',
      raw_data: company,
    }));

    // Upsert leads to database (update if exists, insert if not)
    const { data: savedLeads, error: insertError } = await supabase
      .from('scraped_leads')
      .upsert(leads, { 
        onConflict: 'user_id,cnpj',
        ignoreDuplicates: false 
      })
      .select();

    if (insertError) {
      console.error('Error saving leads:', insertError);
      return new Response(JSON.stringify({ 
        error: 'Failed to save leads',
        details: insertError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Successfully saved ${savedLeads?.length || 0} leads`);

    return new Response(JSON.stringify({ 
      success: true,
      leads: savedLeads,
      count: savedLeads?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in scrape-leads function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
