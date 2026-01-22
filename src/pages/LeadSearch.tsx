import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LeadSearchFilters } from "@/components/leads/LeadSearchFilters";
import { LeadSearchResults } from "@/components/leads/LeadSearchResults";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Socio {
  nome: string;
  qualificacao_socio?: string;
  documento?: string;
  data_entrada?: string;
}

export interface Company {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string | { situacao_atual: string; motivo?: string; data?: string };
  data_abertura: string | null;
  capital_social: number | null;
  porte: string | null;
  natureza_juridica: string | null;
  cnae_principal: string | null;
  telefone: string | null;
  telefone2: string | null;
  email: string | null;
  socios?: Socio[] | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    municipio: string | null;
    uf: string | null;
    ddd: string | null;
  };
}

export interface SearchFilters {
  // Localização
  uf: string[];
  municipio: string[];
  bairro: string[];
  cep: string[];
  ddd: string[];
  
  // Atividade
  cnae: string[];
  cnae_secundario: string[];
  incluir_atividade_secundaria: boolean;
  termo: string;
  situacao_cadastral: string;
  natureza_juridica: string[];
  porte: string[];
  
  // Identificação
  cnpj: string[];
  cnpj_raiz: string[];
  somente_matriz: boolean;
  somente_filial: boolean;
  
  // MEI / Simples
  somente_mei: boolean;
  excluir_mei: boolean;
  simples_optante: boolean;
  simples_excluir: boolean;
  
  // Contato
  com_email: boolean;
  com_telefone: boolean;
  somente_fixo: boolean;
  somente_celular: boolean;
  telefone: string[];
  excluir_email_contab: boolean;
  
  // Data e Capital
  data_abertura_gte: string;
  data_abertura_lte: string;
  capital_social_gte: string;
  capital_social_lte: string;
  
  // Exclusões
  excluir_cnpj: string[];
}

export const initialFilters: SearchFilters = {
  // Localização
  uf: [],
  municipio: [],
  bairro: [],
  cep: [],
  ddd: [],
  
  // Atividade
  cnae: [],
  cnae_secundario: [],
  incluir_atividade_secundaria: false,
  termo: "",
  situacao_cadastral: "ATIVA",
  natureza_juridica: [],
  porte: [],
  
  // Identificação
  cnpj: [],
  cnpj_raiz: [],
  somente_matriz: false,
  somente_filial: false,
  
  // MEI / Simples
  somente_mei: false,
  excluir_mei: false,
  simples_optante: false,
  simples_excluir: false,
  
  // Contato
  com_email: false,
  com_telefone: true,
  somente_fixo: false,
  somente_celular: true,
  telefone: [],
  excluir_email_contab: false,
  
  // Data e Capital
  data_abertura_gte: "",
  data_abertura_lte: "",
  capital_social_gte: "",
  capital_social_lte: "",
  
  // Exclusões
  excluir_cnpj: [],
};

const LeadSearch = () => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [companies, setCompanies] = useState<Company[]>([]);
  // Store full company objects to persist selections across pages
  const [selectedCompanies, setSelectedCompanies] = useState<Map<string, Company>>(new Map());
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const handleSearch = async (page = 1, isNewSearch = false) => {
    setIsSearching(true);
    setCurrentPage(page);
    
    // Only clear selections on new search (page 1 from button click)
    if (isNewSearch) {
      setSelectedCompanies(new Map());
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('search-companies', {
        body: { filters, page, limit: 20 }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Erro na pesquisa');
      }

      setCompanies(data.data || []);
      setTotalResults(data.total || 0);
      setHasSearched(true);
      
      if (data.data?.length === 0) {
        toast.info('Nenhuma empresa encontrada com os filtros selecionados');
      } else if (isNewSearch) {
        toast.success(`${data.total} empresas encontradas`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao pesquisar empresas');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCompany = (cnpj: string) => {
    setSelectedCompanies(prev => {
      const next = new Map(prev);
      if (next.has(cnpj)) {
        next.delete(cnpj);
      } else {
        const company = companies.find(c => c.cnpj === cnpj);
        if (company) {
          next.set(cnpj, company);
        }
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const currentPageCnpjs = companies.map(c => c.cnpj);
    const allCurrentSelected = currentPageCnpjs.every(cnpj => selectedCompanies.has(cnpj));
    
    if (allCurrentSelected) {
      // Deselect all from current page
      setSelectedCompanies(prev => {
        const next = new Map(prev);
        currentPageCnpjs.forEach(cnpj => next.delete(cnpj));
        return next;
      });
    } else {
      // Select all from current page (add to existing)
      setSelectedCompanies(prev => {
        const next = new Map(prev);
        companies.forEach(c => next.set(c.cnpj, c));
        return next;
      });
    }
  };

  const getSelectedCompanies = (): Company[] => {
    return Array.from(selectedCompanies.values());
  };

  // Get CNPJs for current page selection check
  const selectedCnpjs = new Set(selectedCompanies.keys());

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            Pesquisa de Leads
          </h1>
          <p className="text-muted-foreground mt-1">
            Pesquise empresas e importe leads diretamente para seus contatos
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtros de Pesquisa
            </CardTitle>
            <CardDescription>
              Configure os filtros para encontrar empresas específicas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadSearchFilters
              filters={filters}
              setFilters={setFilters}
              onSearch={() => handleSearch(1, true)}
              isSearching={isSearching}
              onReset={() => setFilters(initialFilters)}
            />
          </CardContent>
        </Card>

        {/* Results */}
        {hasSearched && (
          <LeadSearchResults
            companies={companies}
            selectedCompanies={selectedCnpjs}
            totalSelected={selectedCompanies.size}
            onSelectCompany={handleSelectCompany}
            onSelectAll={handleSelectAll}
            totalResults={totalResults}
            currentPage={currentPage}
            onPageChange={(page) => handleSearch(page, false)}
            isLoading={isSearching}
            onImport={() => setImportDialogOpen(true)}
          />
        )}

        {/* Import Dialog */}
        <ImportLeadsDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          companies={getSelectedCompanies()}
          onSuccess={() => {
            setSelectedCompanies(new Map());
            setImportDialogOpen(false);
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default LeadSearch;
