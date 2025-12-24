import { SearchFilters } from "@/pages/LeadSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RotateCcw, Building, MapPin, Phone, Calendar, DollarSign } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface LeadSearchFiltersProps {
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  onSearch: () => void;
  isSearching: boolean;
  onReset: () => void;
}

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const SITUACOES = [
  { value: "ATIVA", label: "Ativa" },
  { value: "BAIXADA", label: "Baixada" },
  { value: "INAPTA", label: "Inapta" },
  { value: "SUSPENSA", label: "Suspensa" },
  { value: "NULA", label: "Nula" },
];

export const LeadSearchFilters = ({
  filters,
  setFilters,
  onSearch,
  isSearching,
  onReset,
}: LeadSearchFiltersProps) => {
  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleUfChange = (uf: string) => {
    const current = filters.uf;
    if (current.includes(uf)) {
      updateFilter('uf', current.filter(u => u !== uf));
    } else {
      updateFilter('uf', [...current, uf]);
    }
  };

  const handleCnaeAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = e.currentTarget.value.trim();
      if (value && !filters.cnae.includes(value)) {
        updateFilter('cnae', [...filters.cnae, value]);
        e.currentTarget.value = '';
      }
    }
  };

  const handleMunicipioAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = e.currentTarget.value.trim().toUpperCase();
      if (value && !filters.municipio.includes(value)) {
        updateFilter('municipio', [...filters.municipio, value]);
        e.currentTarget.value = '';
      }
    }
  };

  const activeFiltersCount = () => {
    let count = 0;
    if (filters.uf.length > 0) count++;
    if (filters.municipio.length > 0) count++;
    if (filters.cnae.length > 0) count++;
    if (filters.termo) count++;
    if (filters.data_abertura_gte || filters.data_abertura_lte) count++;
    if (filters.capital_social_gte || filters.capital_social_lte) count++;
    if (filters.com_email || filters.com_telefone || filters.somente_celular) count++;
    return count;
  };

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={["location", "contact"]} className="space-y-2">
        {/* Localização */}
        <AccordionItem value="location" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Localização</span>
              {(filters.uf.length > 0 || filters.municipio.length > 0) && (
                <Badge variant="secondary" className="ml-2">
                  {filters.uf.length + filters.municipio.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {/* Estados */}
            <div>
              <Label className="text-sm font-medium">Estados (UF)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ESTADOS.map((uf) => (
                  <Button
                    key={uf}
                    type="button"
                    variant={filters.uf.includes(uf) ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => handleUfChange(uf)}
                  >
                    {uf}
                  </Button>
                ))}
              </div>
            </div>

            {/* Municípios */}
            <div>
              <Label className="text-sm font-medium">Municípios</Label>
              <Input
                placeholder="Digite o município e pressione Enter"
                onKeyDown={handleMunicipioAdd}
                className="mt-1"
              />
              {filters.municipio.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {filters.municipio.map((m) => (
                    <Badge key={m} variant="secondary" className="gap-1">
                      {m}
                      <button
                        onClick={() => updateFilter('municipio', filters.municipio.filter(x => x !== m))}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Atividade */}
        <AccordionItem value="activity" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <span>Atividade Empresarial</span>
              {(filters.cnae.length > 0 || filters.termo) && (
                <Badge variant="secondary" className="ml-2">
                  {filters.cnae.length + (filters.termo ? 1 : 0)}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {/* Termo de busca */}
            <div>
              <Label className="text-sm font-medium">Termo de Busca</Label>
              <Input
                placeholder="Ex: restaurante, tecnologia, advocacia..."
                value={filters.termo}
                onChange={(e) => updateFilter('termo', e.target.value)}
                className="mt-1"
              />
            </div>

            {/* CNAE */}
            <div>
              <Label className="text-sm font-medium">Código CNAE</Label>
              <Input
                placeholder="Digite o CNAE e pressione Enter"
                onKeyDown={handleCnaeAdd}
                className="mt-1"
              />
              {filters.cnae.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {filters.cnae.map((c) => (
                    <Badge key={c} variant="secondary" className="gap-1">
                      {c}
                      <button
                        onClick={() => updateFilter('cnae', filters.cnae.filter(x => x !== c))}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Situação Cadastral */}
            <div>
              <Label className="text-sm font-medium">Situação Cadastral</Label>
              <Select 
                value={filters.situacao_cadastral} 
                onValueChange={(v) => updateFilter('situacao_cadastral', v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITUACOES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* MEI options */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_mei"
                  checked={filters.somente_mei}
                  onCheckedChange={(c) => {
                    updateFilter('somente_mei', !!c);
                    if (c) updateFilter('excluir_mei', false);
                  }}
                />
                <Label htmlFor="somente_mei" className="text-sm">Somente MEI</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="excluir_mei"
                  checked={filters.excluir_mei}
                  onCheckedChange={(c) => {
                    updateFilter('excluir_mei', !!c);
                    if (c) updateFilter('somente_mei', false);
                  }}
                />
                <Label htmlFor="excluir_mei" className="text-sm">Excluir MEI</Label>
              </div>
            </div>

            {/* Matriz/Filial */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_matriz"
                  checked={filters.somente_matriz}
                  onCheckedChange={(c) => {
                    updateFilter('somente_matriz', !!c);
                    if (c) updateFilter('somente_filial', false);
                  }}
                />
                <Label htmlFor="somente_matriz" className="text-sm">Somente Matriz</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_filial"
                  checked={filters.somente_filial}
                  onCheckedChange={(c) => {
                    updateFilter('somente_filial', !!c);
                    if (c) updateFilter('somente_matriz', false);
                  }}
                />
                <Label htmlFor="somente_filial" className="text-sm">Somente Filial</Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Contato */}
        <AccordionItem value="contact" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span>Contato</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="com_telefone"
                  checked={filters.com_telefone}
                  onCheckedChange={(c) => updateFilter('com_telefone', !!c)}
                />
                <Label htmlFor="com_telefone" className="text-sm">Com Telefone</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_celular"
                  checked={filters.somente_celular}
                  onCheckedChange={(c) => {
                    updateFilter('somente_celular', !!c);
                    if (c) updateFilter('somente_fixo', false);
                  }}
                />
                <Label htmlFor="somente_celular" className="text-sm">Somente Celular</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_fixo"
                  checked={filters.somente_fixo}
                  onCheckedChange={(c) => {
                    updateFilter('somente_fixo', !!c);
                    if (c) updateFilter('somente_celular', false);
                  }}
                />
                <Label htmlFor="somente_fixo" className="text-sm">Somente Fixo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="com_email"
                  checked={filters.com_email}
                  onCheckedChange={(c) => updateFilter('com_email', !!c)}
                />
                <Label htmlFor="com_email" className="text-sm">Com Email</Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Data e Capital */}
        <AccordionItem value="financial" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Data e Capital</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {/* Data Abertura */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Data Abertura (de)</Label>
                <Input
                  type="date"
                  value={filters.data_abertura_gte}
                  onChange={(e) => updateFilter('data_abertura_gte', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Data Abertura (até)</Label>
                <Input
                  type="date"
                  value={filters.data_abertura_lte}
                  onChange={(e) => updateFilter('data_abertura_lte', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Capital Social */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Capital Social (mín.)</Label>
                <Input
                  type="number"
                  placeholder="R$ 0,00"
                  value={filters.capital_social_gte}
                  onChange={(e) => updateFilter('capital_social_gte', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Capital Social (máx.)</Label>
                <Input
                  type="number"
                  placeholder="R$ 0,00"
                  value={filters.capital_social_lte}
                  onChange={(e) => updateFilter('capital_social_lte', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button
          onClick={onSearch}
          disabled={isSearching}
          className="flex-1 md:flex-none"
        >
          <Search className="h-4 w-4 mr-2" />
          {isSearching ? "Pesquisando..." : "Pesquisar Empresas"}
        </Button>
        <Button
          variant="outline"
          onClick={onReset}
          disabled={isSearching}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Limpar Filtros
        </Button>
        {activeFiltersCount() > 0 && (
          <Badge variant="secondary">
            {activeFiltersCount()} filtro(s) ativo(s)
          </Badge>
        )}
      </div>
    </div>
  );
};
