import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  estado_id: string;
  cidade_id?: string;
  cnae_id: string;
  limite: number;
  apenas_ativos?: boolean;
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

    const { estado_id, cidade_id, cnae_id, limite = 20, apenas_ativos = true }: ScrapeRequest = await req.json();

    console.log('Scrape request:', { estado_id, cidade_id, cnae_id, limite, apenas_ativos });

    const cnpjwsApiKey = Deno.env.get('CNPJWS_API_KEY');
    if (!cnpjwsApiKey) {
      return new Response(JSON.stringify({ error: 'CNPJWS API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build search URL for CNPJ.ws
    const searchParams = new URLSearchParams();
    searchParams.set('uf', estado_id);
    if (cidade_id) {
      searchParams.set('municipio', cidade_id);
    }
    searchParams.set('atividade_principal', cnae_id);
    if (apenas_ativos) {
      searchParams.set('situacao_cadastral', 'ATIVA');
    }
    searchParams.set('limit', String(Math.min(limite, 100)));

    console.log('Calling CNPJ.ws API with params:', searchParams.toString());

    // Call CNPJ.ws search API
    const searchResponse = await fetch(`https://comercial.cnpj.ws/cnpj?${searchParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${cnpjwsApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('CNPJ.ws API error:', searchResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch data from CNPJ.ws',
        details: errorText 
      }), {
        status: searchResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const companies: CNPJWSCompany[] = await searchResponse.json();
    console.log(`Found ${companies.length} companies from CNPJ.ws`);

    // Transform and save leads
    const leads = companies.map(company => ({
      user_id: user.id,
      cnpj: company.cnpj,
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
      count: savedLeads?.length || 0 
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
