import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchFilters {
  termo?: string[];
  atividade_principal?: string[];
  natureza_juridica?: string[];
  uf?: string[];
  municipio?: string[];
  bairro?: string[];
  cep?: string[];
  ddd?: string[];
  situacao_cadastral?: string;
  data_abertura_gte?: string;
  data_abertura_lte?: string;
  capital_social_gte?: number;
  capital_social_lte?: number;
  somente_mei?: boolean;
  excluir_mei?: boolean;
  com_email?: boolean;
  com_telefone?: boolean;
  somente_fixo?: boolean;
  somente_celular?: boolean;
  somente_matriz?: boolean;
  somente_filial?: boolean;
}

interface SearchRequest {
  query: SearchFilters;
  extras?: {
    somente_qsa?: boolean;
    excluir_qsa?: boolean;
  };
  range?: {
    inicio: number;
    fim: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('CNPJWS_API_KEY');
    if (!apiKey) {
      console.error('CNPJWS_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API Key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { filters, page = 1, limit = 20 } = await req.json();
    console.log('Received search request:', { filters, page, limit });

    // Build request body
    const searchBody: SearchRequest = {
      query: {},
      range: {
        inicio: (page - 1) * limit,
        fim: page * limit - 1
      }
    };

    // Map filters to API format
    if (filters.uf && filters.uf.length > 0) {
      searchBody.query.uf = filters.uf;
    }
    if (filters.municipio && filters.municipio.length > 0) {
      searchBody.query.municipio = filters.municipio.map((m: string) => m.toUpperCase());
    }
    if (filters.bairro && filters.bairro.length > 0) {
      searchBody.query.bairro = filters.bairro;
    }
    if (filters.cep && filters.cep.length > 0) {
      searchBody.query.cep = filters.cep;
    }
    if (filters.ddd && filters.ddd.length > 0) {
      searchBody.query.ddd = filters.ddd;
    }
    if (filters.cnae && filters.cnae.length > 0) {
      searchBody.query.atividade_principal = filters.cnae.map((c: string) => ({
        code: c.replace(/\D/g, '')
      }));
    }
    if (filters.termo && filters.termo.trim()) {
      searchBody.query.termo = [filters.termo.trim()];
    }
    if (filters.situacao_cadastral) {
      searchBody.query.situacao_cadastral = filters.situacao_cadastral;
    }
    if (filters.data_abertura_gte) {
      searchBody.query.data_abertura_gte = filters.data_abertura_gte;
    }
    if (filters.data_abertura_lte) {
      searchBody.query.data_abertura_lte = filters.data_abertura_lte;
    }
    if (filters.capital_social_gte) {
      searchBody.query.capital_social_gte = Number(filters.capital_social_gte);
    }
    if (filters.capital_social_lte) {
      searchBody.query.capital_social_lte = Number(filters.capital_social_lte);
    }
    if (filters.somente_mei) {
      searchBody.query.somente_mei = true;
    }
    if (filters.excluir_mei) {
      searchBody.query.excluir_mei = true;
    }
    if (filters.com_email) {
      searchBody.query.com_email = true;
    }
    if (filters.com_telefone) {
      searchBody.query.com_telefone = true;
    }
    if (filters.somente_fixo) {
      searchBody.query.somente_fixo = true;
    }
    if (filters.somente_celular) {
      searchBody.query.somente_celular = true;
    }
    if (filters.somente_matriz) {
      searchBody.query.somente_matriz = true;
    }
    if (filters.somente_filial) {
      searchBody.query.somente_filial = true;
    }

    console.log('API Request body:', JSON.stringify(searchBody, null, 2));

    // Make request to Casa dos Dados API
    const response = await fetch('https://api.casadosdados.com.br/v2/public/cnpj/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sql-api-key': apiKey,
      },
      body: JSON.stringify(searchBody),
    });

    const responseText = await response.text();
    console.log('API Response status:', response.status);
    console.log('API Response:', responseText.substring(0, 1000));

    if (!response.ok) {
      let errorMessage = 'Erro na API Casa dos Dados';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage = responseText || `HTTP ${response.status}`;
      }
      
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);
    console.log('Found companies:', data.data?.cnpj?.length || 0);

    // Format companies for frontend
    const companies = (data.data?.cnpj || []).map((company: any) => ({
      cnpj: company.cnpj,
      razao_social: company.razao_social,
      nome_fantasia: company.nome_fantasia,
      situacao_cadastral: company.situacao_cadastral,
      data_abertura: company.data_abertura,
      capital_social: company.capital_social,
      porte: company.porte,
      natureza_juridica: company.natureza_juridica,
      cnae_principal: company.atividade_principal?.subclasse 
        ? `${company.atividade_principal.subclasse} - ${company.atividade_principal.descricao}`
        : null,
      telefone: company.telefone1 || company.telefone2,
      telefone2: company.telefone2 || null,
      email: company.email,
      endereco: {
        logradouro: company.logradouro,
        numero: company.numero,
        complemento: company.complemento,
        bairro: company.bairro,
        cep: company.cep,
        municipio: company.municipio,
        uf: company.uf,
        ddd: company.ddd1 || company.ddd2,
      }
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: companies,
        total: data.data?.count || companies.length,
        page,
        limit,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-companies:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
