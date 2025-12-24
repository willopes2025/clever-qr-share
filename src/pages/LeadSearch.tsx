import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LeadSearchFilters } from "@/components/leads/LeadSearchFilters";
import { LeadSearchResults } from "@/components/leads/LeadSearchResults";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Company {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string;
  data_abertura: string | null;
  capital_social: number | null;
  porte: string | null;
  natureza_juridica: string | null;
  cnae_principal: string | null;
  telefone: string | null;
  telefone2: string | null;
  email: string | null;
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
  uf: string[];
  municipio: string[];
  bairro: string[];
  cep: string[];
  ddd: string[];
  cnae: string[];
  termo: string;
  situacao_cadastral: string;
  data_abertura_gte: string;
  data_abertura_lte: string;
  capital_social_gte: string;
  capital_social_lte: string;
  somente_mei: boolean;
  excluir_mei: boolean;
  com_email: boolean;
  com_telefone: boolean;
  somente_fixo: boolean;
  somente_celular: boolean;
  somente_matriz: boolean;
  somente_filial: boolean;
}

const initialFilters: SearchFilters = {
  uf: [],
  municipio: [],
  bairro: [],
  cep: [],
  ddd: [],
  cnae: [],
  termo: "",
  situacao_cadastral: "ATIVA",
  data_abertura_gte: "",
  data_abertura_lte: "",
  capital_social_gte: "",
  capital_social_lte: "",
  somente_mei: false,
  excluir_mei: false,
  com_email: false,
  com_telefone: true,
  somente_fixo: false,
  somente_celular: true,
  somente_matriz: false,
  somente_filial: false,
};

const LeadSearch = () => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const handleSearch = async (page = 1) => {
    setIsSearching(true);
    setCurrentPage(page);
    
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
      setSelectedCompanies(new Set());
      
      if (data.data?.length === 0) {
        toast.info('Nenhuma empresa encontrada com os filtros selecionados');
      } else {
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
      const next = new Set(prev);
      if (next.has(cnpj)) {
        next.delete(cnpj);
      } else {
        next.add(cnpj);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(companies.map(c => c.cnpj)));
    }
  };

  const getSelectedCompanies = () => {
    return companies.filter(c => selectedCompanies.has(c.cnpj));
  };

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
              onSearch={() => handleSearch(1)}
              isSearching={isSearching}
              onReset={() => setFilters(initialFilters)}
            />
          </CardContent>
        </Card>

        {/* Results */}
        {hasSearched && (
          <LeadSearchResults
            companies={companies}
            selectedCompanies={selectedCompanies}
            onSelectCompany={handleSelectCompany}
            onSelectAll={handleSelectAll}
            totalResults={totalResults}
            currentPage={currentPage}
            onPageChange={handleSearch}
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
            setSelectedCompanies(new Set());
            setImportDialogOpen(false);
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default LeadSearch;
