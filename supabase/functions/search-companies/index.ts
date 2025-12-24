import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  cnpj?: string[];
  busca_textual?: {
    texto: string[];
    tipo_busca?: 'exata' | 'radical';
    razao_social?: boolean;
    nome_fantasia?: boolean;
  }[];
  codigo_atividade_principal?: string[];
  situacao_cadastral?: string[];
  uf?: string[];
  municipio?: string[];
  bairro?: string[];
  cep?: string[];
  ddd?: string[];
  data_abertura?: {
    inicio?: string;
    fim?: string;
    ultimos_dias?: number;
  };
  capital_social?: {
    minimo?: number;
    maximo?: number;
  };
  mei?: {
    optante?: boolean;
    excluir_optante?: boolean;
  };
  mais_filtros?: {
    somente_matriz?: boolean;
    somente_filial?: boolean;
    com_email?: boolean;
    com_telefone?: boolean;
    somente_fixo?: boolean;
    somente_celular?: boolean;
  };
  limite?: number;
  pagina?: number;
}

// Sanitize API key - remove prefixes and whitespace
function sanitizeApiKey(key: string): string {
  let sanitized = key.trim();
  
  // Remove common prefixes if user pasted the full header
  if (sanitized.toLowerCase().startsWith('api-key:')) {
    sanitized = sanitized.substring(8).trim();
  }
  if (sanitized.toLowerCase().startsWith('api-key')) {
    sanitized = sanitized.substring(7).trim();
  }
  
  return sanitized;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try both secret names for compatibility
    let rawApiKey = Deno.env.get('CASADOSDADOS_API_KEY') || Deno.env.get('CNPJWS_API_KEY');
    
    if (!rawApiKey) {
      console.error('API Key not configured (checked CASADOSDADOS_API_KEY and CNPJWS_API_KEY)');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'API Key não configurada. Configure CASADOSDADOS_API_KEY ou CNPJWS_API_KEY.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = sanitizeApiKey(rawApiKey);
    
    // Log safe metadata for debugging (not the key itself)
    console.log('API Key info:', {
      length: apiKey.length,
      lastChars: apiKey.slice(-4),
      source: Deno.env.get('CASADOSDADOS_API_KEY') ? 'CASADOSDADOS_API_KEY' : 'CNPJWS_API_KEY'
    });

    const { filters, page = 1, limit = 20 } = await req.json();
    console.log('Received search request:', { filters, page, limit });

    // Build request body according to v5 API format
    const searchBody: SearchRequest = {
      limite: Math.min(limit, 1000),
      pagina: page,
    };

    // UF filter
    if (filters.uf && filters.uf.length > 0) {
      searchBody.uf = filters.uf.map((u: string) => u.toLowerCase());
    }

    // Município filter
    if (filters.municipio && filters.municipio.length > 0) {
      searchBody.municipio = filters.municipio.map((m: string) => m.toLowerCase());
    }

    // Bairro filter
    if (filters.bairro && filters.bairro.length > 0) {
      searchBody.bairro = filters.bairro;
    }

    // CEP filter
    if (filters.cep && filters.cep.length > 0) {
      searchBody.cep = filters.cep;
    }

    // DDD filter
    if (filters.ddd && filters.ddd.length > 0) {
      searchBody.ddd = filters.ddd;
    }

    // CNAE filter (atividade principal)
    if (filters.cnae && filters.cnae.length > 0) {
      searchBody.codigo_atividade_principal = filters.cnae.map((c: string) => c.replace(/\D/g, ''));
    }

    // Termo de busca textual
    if (filters.termo && filters.termo.trim()) {
      searchBody.busca_textual = [{
        texto: [filters.termo.trim()],
        tipo_busca: 'radical',
        razao_social: true,
        nome_fantasia: true,
      }];
    }

    // Situação cadastral
    if (filters.situacao_cadastral) {
      searchBody.situacao_cadastral = [filters.situacao_cadastral];
    }

    // Data de abertura
    if (filters.data_abertura_gte || filters.data_abertura_lte) {
      searchBody.data_abertura = {};
      if (filters.data_abertura_gte) {
        searchBody.data_abertura.inicio = filters.data_abertura_gte;
      }
      if (filters.data_abertura_lte) {
        searchBody.data_abertura.fim = filters.data_abertura_lte;
      }
    }

    // Capital social
    if (filters.capital_social_gte || filters.capital_social_lte) {
      searchBody.capital_social = {};
      if (filters.capital_social_gte) {
        searchBody.capital_social.minimo = Number(filters.capital_social_gte);
      }
      if (filters.capital_social_lte) {
        searchBody.capital_social.maximo = Number(filters.capital_social_lte);
      }
    }

    // MEI options
    if (filters.somente_mei || filters.excluir_mei) {
      searchBody.mei = {};
      if (filters.somente_mei) {
        searchBody.mei.optante = true;
      }
      if (filters.excluir_mei) {
        searchBody.mei.excluir_optante = true;
      }
    }

    // Mais filtros (contact and matrix/branch options)
    const maisFilters: SearchRequest['mais_filtros'] = {};
    let hasMaisFilters = false;

    if (filters.com_email) {
      maisFilters.com_email = true;
      hasMaisFilters = true;
    }
    if (filters.com_telefone) {
      maisFilters.com_telefone = true;
      hasMaisFilters = true;
    }
    if (filters.somente_fixo) {
      maisFilters.somente_fixo = true;
      hasMaisFilters = true;
    }
    if (filters.somente_celular) {
      maisFilters.somente_celular = true;
      hasMaisFilters = true;
    }
    if (filters.somente_matriz) {
      maisFilters.somente_matriz = true;
      hasMaisFilters = true;
    }
    if (filters.somente_filial) {
      maisFilters.somente_filial = true;
      hasMaisFilters = true;
    }

    if (hasMaisFilters) {
      searchBody.mais_filtros = maisFilters;
    }

    console.log('API Request body:', JSON.stringify(searchBody, null, 2));

    // Make request to Casa dos Dados API v5 with tipo_resultado=completo to get all fields
    const apiUrl = 'https://api.casadosdados.com.br/v5/cnpj/pesquisa?tipo_resultado=completo';
    console.log('Calling API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(searchBody),
    });

    const responseText = await response.text();
    console.log('API Response status:', response.status);
    console.log('API Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('API Response preview:', responseText.substring(0, 500));

    if (!response.ok) {
      let errorMessage = 'Erro na API Casa dos Dados';
      
      // Specific error messages based on status
      if (response.status === 401) {
        errorMessage = 'API Key inválida. Verifique se a chave está correta no portal da Casa dos Dados (https://casadosdados.com.br). Cole apenas o valor da chave, sem prefixos.';
        console.error('401 Unauthorized - API Key rejected by Casa dos Dados');
      } else if (response.status === 403) {
        errorMessage = 'Sem permissão para acessar este recurso. Verifique se seu plano na Casa dos Dados permite pesquisas avançadas.';
        console.error('403 Forbidden - Access denied');
      } else if (response.status === 429) {
        errorMessage = 'Limite de requisições excedido. Aguarde alguns minutos e tente novamente.';
        console.error('429 Rate Limited');
      } else {
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorData.msg || `HTTP ${response.status}`;
        } catch {
          errorMessage = responseText || `HTTP ${response.status}`;
        }
      }
      
      console.error('API Error:', errorMessage);
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);
    console.log('Found companies:', data.cnpjs?.length || 0, 'Total:', data.total);

    // Log first company structure for debugging phone fields
    if (data.cnpjs && data.cnpjs.length > 0) {
      const first = data.cnpjs[0];
      console.log('First company structure (full):', JSON.stringify(first, null, 2));
      console.log('Phone fields check:', {
        telefone1: first.telefone1,
        telefone2: first.telefone2,
        telefone: first.telefone,
        telefones: first.telefones,
        ddd1: first.ddd1,
        ddd2: first.ddd2,
        contato: first.contato,
        contatos: first.contatos,
      });
    }

    // Helper function to extract phone from various possible fields
    const extractPhone = (company: any): string | null => {
      // Try direct phone fields first
      if (company.telefone1) return company.telefone1;
      if (company.telefone) return company.telefone;
      
      // Try with DDD prefix
      const ddd = company.ddd1 || company.ddd;
      if (ddd) {
        if (company.telefone1) return `${ddd}${company.telefone1}`;
        if (company.telefone) return `${ddd}${company.telefone}`;
      }
      
      // Try telefones array
      if (Array.isArray(company.telefones) && company.telefones.length > 0) {
        const tel = company.telefones[0];
        if (typeof tel === 'string') return tel;
        if (tel && tel.numero) return tel.ddd ? `${tel.ddd}${tel.numero}` : tel.numero;
      }
      
      // Try contato object
      if (company.contato) {
        if (company.contato.telefone) return company.contato.telefone;
        if (company.contato.telefone1) return company.contato.telefone1;
      }
      
      // Try contatos array
      if (Array.isArray(company.contatos) && company.contatos.length > 0) {
        const contato = company.contatos[0];
        if (contato.telefone) return contato.telefone;
        if (contato.numero) return contato.ddd ? `${contato.ddd}${contato.numero}` : contato.numero;
      }
      
      return null;
    };

    // Format companies for frontend
    const companies = (data.cnpjs || []).map((company: any) => {
      const phone = extractPhone(company);
      
      return {
        cnpj: company.cnpj,
        razao_social: company.razao_social,
        nome_fantasia: company.nome_fantasia,
        situacao_cadastral: company.situacao_cadastral,
        data_abertura: company.data_abertura,
        capital_social: company.capital_social,
        porte: company.porte,
        natureza_juridica: company.natureza_juridica?.descricao || null,
        cnae_principal: company.atividade_principal?.descricao 
          ? `${company.atividade_principal.codigo} - ${company.atividade_principal.descricao}`
          : null,
        telefone: phone,
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
          ddd: company.ddd1 || company.ddd2 || company.ddd,
        }
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: companies,
        total: data.total || companies.length,
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
