import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  cnpj?: string[];
  cnpj_raiz?: string[];
  busca_textual?: {
    texto: string[];
    tipo_busca?: 'exata' | 'radical';
    razao_social?: boolean;
    nome_fantasia?: boolean;
  }[];
  codigo_atividade_principal?: string[];
  codigo_atividade_secundaria?: string[];
  codigo_natureza_juridica?: string[];
  codigo_porte?: string[];
  situacao_cadastral?: string[];
  uf?: string[];
  municipio?: string[];
  bairro?: string[];
  cep?: string[];
  ddd?: string[];
  telefone?: string[];
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
  simples?: {
    optante?: boolean;
    excluir_optante?: boolean;
  };
  matriz_filial?: "MATRIZ" | "FILIAL";
  mais_filtros?: {
    com_email?: boolean;
    com_telefone?: boolean;
    somente_fixo?: boolean;
    somente_celular?: boolean;
    excluir_email_contabilidade?: boolean;
  };
  excluir_cnpj?: string[];
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

    // Filtro Matriz/Filial - Campo separado no nível raiz (não dentro de mais_filtros)
    if (filters.somente_matriz) {
      searchBody.matriz_filial = "MATRIZ";
      console.log('Aplicando filtro matriz_filial: MATRIZ');
    }
    if (filters.somente_filial) {
      searchBody.matriz_filial = "FILIAL";
      console.log('Aplicando filtro matriz_filial: FILIAL');
    }

    // Mais filtros (contact options only)
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

    // Excluir email contabilidade
    if (filters.excluir_email_contab) {
      maisFilters.excluir_email_contabilidade = true;
      hasMaisFilters = true;
    }

    if (hasMaisFilters) {
      searchBody.mais_filtros = maisFilters;
    }

    // Natureza Jurídica filter
    if (filters.natureza_juridica && filters.natureza_juridica.length > 0) {
      searchBody.codigo_natureza_juridica = filters.natureza_juridica;
    }

    // Porte filter
    if (filters.porte && filters.porte.length > 0) {
      searchBody.codigo_porte = filters.porte;
    }

    // CNPJ específico filter
    if (filters.cnpj && filters.cnpj.length > 0) {
      searchBody.cnpj = filters.cnpj.map((c: string) => c.replace(/\D/g, ''));
    }

    // CNPJ Raiz filter
    if (filters.cnpj_raiz && filters.cnpj_raiz.length > 0) {
      searchBody.cnpj_raiz = filters.cnpj_raiz.map((c: string) => c.replace(/\D/g, ''));
    }

    // CNAE Secundário filter
    if (filters.cnae_secundario && filters.cnae_secundario.length > 0) {
      searchBody.codigo_atividade_secundaria = filters.cnae_secundario.map((c: string) => c.replace(/\D/g, ''));
    }

    // Simples Nacional options
    if (filters.simples_optante || filters.simples_excluir) {
      searchBody.simples = {};
      if (filters.simples_optante) {
        searchBody.simples.optante = true;
      }
      if (filters.simples_excluir) {
        searchBody.simples.excluir_optante = true;
      }
    }

    // Telefone específico filter
    if (filters.telefone && filters.telefone.length > 0) {
      searchBody.telefone = filters.telefone;
    }

    // Excluir CNPJ filter
    if (filters.excluir_cnpj && filters.excluir_cnpj.length > 0) {
      searchBody.excluir_cnpj = filters.excluir_cnpj.map((c: string) => c.replace(/\D/g, ''));
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

    // Log first company structure for debugging
    if (data.cnpjs && data.cnpjs.length > 0) {
      const first = data.cnpjs[0];
      console.log('First company keys:', Object.keys(first));
      console.log('contato_telefonico:', first.contato_telefonico);
      console.log('contato_email:', first.contato_email);
      console.log('endereco:', first.endereco);
    }

    // Helper function to extract phone from contato_telefonico array
    // Returns phone WITHOUT DDD, keeping DDD separate for proper formatting
    const extractPhone = (company: any, preferCelular = false): { phone: string | null, phone2: string | null, ddd: string | null } => {
      const contatos = company.contato_telefonico;
      
      if (!Array.isArray(contatos) || contatos.length === 0) {
        // Fallback to old fields - return phone WITHOUT ddd
        const phone = company.telefone1 || company.telefone || null;
        const ddd = company.ddd1 || company.ddd || null;
        return { 
          phone, 
          phone2: company.telefone2 || null,
          ddd 
        };
      }
      
      // Sort: prefer celular if requested
      let sorted = [...contatos];
      if (preferCelular) {
        sorted.sort((a, b) => {
          if (a.tipo === 'celular' && b.tipo !== 'celular') return -1;
          if (a.tipo !== 'celular' && b.tipo === 'celular') return 1;
          return 0;
        });
      }
      
      const first = sorted[0];
      const second = sorted[1];
      
      // Return ONLY the numero, not completo (which includes DDD)
      const getNumero = (c: any) => c.numero || null;
      
      return {
        phone: getNumero(first),
        phone2: second ? getNumero(second) : null,
        ddd: first.ddd || null,
      };
    };

    // Helper function to extract email from contato_email array
    const extractEmail = (company: any): string | null => {
      const emails = company.contato_email;
      
      if (!Array.isArray(emails) || emails.length === 0) {
        return company.email || null;
      }
      
      // Prefer valid emails
      const valid = emails.find((e: any) => e.valido === true);
      if (valid) return valid.email;
      
      // Otherwise first email
      return emails[0]?.email || null;
    };

    // Format companies for frontend
    const companies = (data.cnpjs || []).map((company: any) => {
      const { phone, phone2, ddd } = extractPhone(company);
      const email = extractEmail(company);
      const endereco = company.endereco || {};
      
      return {
        cnpj: company.cnpj,
        razao_social: company.razao_social,
        nome_fantasia: company.nome_fantasia,
        situacao_cadastral: company.situacao_cadastral,
        data_abertura: company.data_abertura,
        capital_social: company.capital_social,
        porte: company.porte_empresa?.descricao || company.porte || null,
        natureza_juridica: company.natureza_juridica?.descricao || company.descricao_natureza_juridica || null,
        cnae_principal: company.atividade_principal?.descricao 
          ? `${company.atividade_principal.codigo} - ${company.atividade_principal.descricao}`
          : null,
        telefone: phone,
        telefone2: phone2,
        email: email,
        endereco: {
          logradouro: endereco.logradouro || company.logradouro,
          numero: endereco.numero || company.numero,
          complemento: endereco.complemento || company.complemento,
          bairro: endereco.bairro || company.bairro,
          cep: endereco.cep || company.cep,
          municipio: endereco.municipio || company.municipio,
          uf: endereco.uf || company.uf,
          ddd: ddd,
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
