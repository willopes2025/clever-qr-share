import { Company } from "@/pages/LeadSearch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Building2, Phone, Mail, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LeadSearchResultsProps {
  companies: Company[];
  selectedCompanies: Set<string>;
  totalSelected: number;
  onSelectCompany: (cnpj: string) => void;
  onSelectAll: () => void;
  totalResults: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  onImport: () => void;
}

export const LeadSearchResults = ({
  companies,
  selectedCompanies,
  totalSelected,
  onSelectCompany,
  onSelectAll,
  totalResults,
  currentPage,
  onPageChange,
  isLoading,
  onImport,
}: LeadSearchResultsProps) => {
  const totalPages = Math.ceil(totalResults / 20);
  const currentPageSelected = companies.filter(c => selectedCompanies.has(c.cnpj)).length;
  const allCurrentPageSelected = companies.length > 0 && currentPageSelected === companies.length;
  const otherPagesSelected = totalSelected - currentPageSelected;

  const formatPhone = (company: Company) => {
    const ddd = company.endereco?.ddd || '';
    const phone = company.telefone || '';
    if (!phone) return '-';
    return ddd ? `(${ddd}) ${phone}` : phone;
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Resultados
          </CardTitle>
          <Badge variant="outline">
            {totalResults.toLocaleString('pt-BR')} empresas
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          {totalSelected > 0 && (
            <>
              <Badge variant="secondary" className="text-sm">
                {totalSelected} selecionado(s)
                {otherPagesSelected > 0 && (
                  <span className="ml-1 opacity-70">
                    (+{otherPagesSelected} de outras páginas)
                  </span>
                )}
              </Badge>
              <Button onClick={onImport}>
                <Download className="h-4 w-4 mr-2" />
                Importar {totalSelected} Selecionado(s)
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {companies.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma empresa encontrada com os filtros selecionados</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allCurrentPageSelected}
                        onCheckedChange={onSelectAll}
                      />
                    </TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Capital</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow 
                      key={company.cnpj}
                      className={selectedCompanies.has(company.cnpj) ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedCompanies.has(company.cnpj)}
                          onCheckedChange={() => onSelectCompany(company.cnpj)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">
                            {company.nome_fantasia || company.razao_social}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            CNPJ: {company.cnpj}
                          </p>
                          {company.cnae_principal && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {company.cnae_principal}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {company.telefone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {formatPhone(company)}
                            </div>
                          )}
                          {company.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{company.email}</span>
                            </div>
                          )}
                          {!company.telefone && !company.email && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {company.endereco?.municipio && company.endereco?.uf
                            ? `${company.endereco.municipio}/${company.endereco.uf}`
                            : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatCurrency(company.capital_social)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (typeof company.situacao_cadastral === 'string' 
                              ? company.situacao_cadastral 
                              : (company.situacao_cadastral as { situacao_atual: string })?.situacao_atual) === 'ATIVA' 
                              ? 'default' 
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {typeof company.situacao_cadastral === 'string' 
                            ? company.situacao_cadastral 
                            : (company.situacao_cadastral as { situacao_atual: string })?.situacao_atual || '-'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
