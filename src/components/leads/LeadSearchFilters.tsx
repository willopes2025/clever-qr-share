import { useState, useMemo, useEffect } from "react";
import { SearchFilters } from "@/pages/LeadSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RotateCcw, Building, MapPin, Phone, Calendar, Hash, Ban, Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { ESTADOS } from "@/data/estados";
import { DDD_LIST, getDddsByUf } from "@/data/ddd";
import { CNAE_LIST, searchCnae } from "@/data/cnae";
import { NATUREZA_JURIDICA } from "@/data/natureza-juridica";
import { useIbgeMunicipios } from "@/hooks/useIbgeMunicipios";

interface LeadSearchFiltersProps {
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  onSearch: (overrideFilters?: SearchFilters) => void;
  isSearching: boolean;
  onReset: () => void;
}

const SITUACOES = [
  { value: "ATIVA", label: "Ativa" },
  { value: "BAIXADA", label: "Baixada" },
  { value: "INAPTA", label: "Inapta" },
  { value: "SUSPENSA", label: "Suspensa" },
  { value: "NULA", label: "Nula" },
];

const PORTES = [
  { value: "MEI", label: "MEI" },
  { value: "ME", label: "Microempresa (ME)" },
  { value: "EPP", label: "Empresa de Pequeno Porte (EPP)" },
  { value: "MEDIO", label: "Empresa de Médio Porte" },
  { value: "GRANDE", label: "Empresa de Grande Porte" },
];

export const LeadSearchFilters = ({
  filters,
  setFilters,
  onSearch,
  isSearching,
  onReset,
}: LeadSearchFiltersProps) => {
  const [cnaeSearch, setCnaeSearch] = useState("");
  const [municipioSearch, setMunicipioSearch] = useState("");
  const [bairroDraft, setBairroDraft] = useState("");
  const [cepDraft, setCepDraft] = useState("");
  
  // Use IBGE API for municipalities
  const { municipios: ibgeMunicipios, isLoading: isLoadingMunicipios } = useIbgeMunicipios(filters.uf);

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters({ ...filters, [key]: value });
  };
  
  // Clear municipio selection when UF changes
  useEffect(() => {
    if (filters.municipio.length > 0) {
      // Check if selected municipios are still valid for the current UFs
      const validMunicipios = filters.municipio.filter(m => 
        ibgeMunicipios.includes(m)
      );
      if (validMunicipios.length !== filters.municipio.length) {
        updateFilter('municipio', validMunicipios);
      }
    }
  }, [ibgeMunicipios]);

  // For mutually exclusive filters - updates both in a single state change
  const updateExclusiveFilters = (updates: Partial<SearchFilters>) => {
    setFilters({ ...filters, ...updates });
  };

  const handleUfChange = (uf: string) => {
    const current = filters.uf;
    if (current.includes(uf)) {
      updateFilter('uf', current.filter(u => u !== uf));
    } else {
      updateFilter('uf', [...current, uf]);
    }
  };

  const handleAddTag = (key: keyof SearchFilters, value: string) => {
    const current = filters[key] as string[];
    if (value && !current.includes(value)) {
      updateFilter(key, [...current, value] as any);
    }
  };

  const handleRemoveTag = (key: keyof SearchFilters, value: string) => {
    const current = filters[key] as string[];
    updateFilter(key, current.filter(v => v !== value) as any);
  };

  const normalizeBairroValue = (raw: string) => raw.trim().replace(/\s+/g, ' ').toUpperCase();
  const normalizeCepValue = (raw: string) => raw.replace(/\D/g, '').slice(0, 8);

  const commitBairroDraft = () => {
    const bairro = normalizeBairroValue(bairroDraft);
    if (!bairro) return;
    if (!filters.bairro.includes(bairro)) {
      setFilters({ ...filters, bairro: [...filters.bairro, bairro] });
    }
    setBairroDraft("");
  };

  const commitCepDraft = () => {
    const cep = normalizeCepValue(cepDraft);
    if (!cep) return;
    if (!filters.cep.includes(cep)) {
      setFilters({ ...filters, cep: [...filters.cep, cep] });
    }
    setCepDraft("");
  };

  const handleSearchClick = () => {
    // Importante: se usuário digitou bairro/CEP e não apertou Enter,
    // precisamos incorporar isso na busca (e não depender do setState assíncrono).
    let next: SearchFilters = filters;

    const bairro = normalizeBairroValue(bairroDraft);
    if (bairro && !next.bairro.includes(bairro)) {
      next = { ...next, bairro: [...next.bairro, bairro] };
    }

    const cep = normalizeCepValue(cepDraft);
    if (cep && !next.cep.includes(cep)) {
      next = { ...next, cep: [...next.cep, cep] };
    }

    if (next !== filters) {
      setFilters(next);
    }

    setBairroDraft("");
    setCepDraft("");

    onSearch(next);
  };

  // Filter DDDs based on selected UFs
  const availableDdds = useMemo(() => {
    if (filters.uf.length === 0) return DDD_LIST.map(d => ({ value: d.value, label: d.label }));
    const ddds: { value: string; label: string }[] = [];
    filters.uf.forEach(uf => {
      getDddsByUf(uf).forEach(d => ddds.push({ value: d.value, label: d.label }));
    });
    return ddds;
  }, [filters.uf]);

  // Filter municipios based on selected UFs and search term
  const municipioOptions = useMemo(() => {
    if (filters.uf.length === 0) {
      return [];
    }
    
    if (isLoadingMunicipios) {
      return [];
    }
    
    if (municipioSearch.length < 2) {
      // Show first 50 if no search
      return ibgeMunicipios.slice(0, 50).map(m => ({ value: m, label: m }));
    }
    
    // Filter by search term (case insensitive, accent insensitive)
    const normalizedSearch = municipioSearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
    
    return ibgeMunicipios
      .filter(m => 
        m.normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .includes(normalizedSearch)
      )
      .slice(0, 50)
      .map(m => ({ value: m, label: m }));
  }, [filters.uf, municipioSearch, ibgeMunicipios, isLoadingMunicipios]);

  // Filter CNAEs based on search
  const cnaeOptions = useMemo(() => {
    if (cnaeSearch.length < 2) return CNAE_LIST.slice(0, 30).map(c => ({ value: c.value, label: c.label }));
    return searchCnae(cnaeSearch).map(c => ({ value: c.value, label: c.label }));
  }, [cnaeSearch]);

  const activeFiltersCount = () => {
    let count = 0;
    if (filters.uf.length > 0) count++;
    if (filters.municipio.length > 0) count++;
    if (filters.ddd.length > 0) count++;
    if (filters.cnae.length > 0) count++;
    if (filters.natureza_juridica.length > 0) count++;
    if (filters.termo) count++;
    if (filters.data_abertura_gte || filters.data_abertura_lte) count++;
    if (filters.capital_social_gte || filters.capital_social_lte) count++;
    if (filters.com_email || filters.com_telefone || filters.somente_celular) count++;
    if (filters.cnpj.length > 0) count++;
    return count;
  };

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={["location", "activity", "contact"]} className="space-y-2">
        {/* Localização */}
        <AccordionItem value="location" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Localização</span>
              {(filters.uf.length > 0 || filters.municipio.length > 0 || filters.ddd.length > 0) && (
                <Badge variant="secondary" className="ml-2">
                  {filters.uf.length + filters.municipio.length + filters.ddd.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium">Estados (UF)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ESTADOS.map((estado) => (
                  <Button
                    key={estado.value}
                    type="button"
                    variant={filters.uf.includes(estado.value) ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => handleUfChange(estado.value)}
                  >
                    {estado.value}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Municípios</Label>
              {isLoadingMunicipios ? (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando municípios...
                </div>
              ) : (
                <AutocompleteInput
                  placeholder={filters.uf.length === 0 ? "Selecione um estado primeiro" : "Pesquisar município..."}
                  options={municipioOptions}
                  value={filters.municipio}
                  onChange={(v) => updateFilter('municipio', v)}
                  onSearch={setMunicipioSearch}
                  emptyMessage={
                    filters.uf.length === 0 
                      ? "Selecione um estado primeiro" 
                      : municipioSearch.length < 2 
                        ? "Digite pelo menos 2 letras para filtrar" 
                        : "Nenhum município encontrado"
                  }
                  disabled={filters.uf.length === 0}
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {filters.uf.length > 0 && !isLoadingMunicipios && (
                  <>{ibgeMunicipios.length} municípios disponíveis</>
                )}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">DDD</Label>
              <MultiSelect
                options={availableDdds}
                value={filters.ddd}
                onChange={(v) => updateFilter('ddd', v)}
                placeholder="Selecionar DDDs..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Bairro</Label>
                <Input
                  placeholder="Digite e pressione Enter (ou clique em Pesquisar)"
                  value={bairroDraft}
                  onChange={(e) => setBairroDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitBairroDraft();
                    }
                  }}
                  onBlur={commitBairroDraft}
                  className="mt-1"
                />
                {filters.bairro.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {filters.bairro.map((b) => (
                      <Badge key={b} variant="secondary" className="gap-1 pr-1">
                        {b}
                        <button onClick={() => handleRemoveTag('bairro', b)} className="ml-1 hover:text-destructive">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium">CEP</Label>
                <Input
                  placeholder="Digite e pressione Enter (ou clique em Pesquisar)"
                  value={cepDraft}
                  onChange={(e) => setCepDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitCepDraft();
                    }
                  }}
                  onBlur={commitCepDraft}
                  className="mt-1"
                />
                {filters.cep.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {filters.cep.map((c) => (
                      <Badge key={c} variant="secondary" className="gap-1 pr-1">
                        {c}
                        <button onClick={() => handleRemoveTag('cep', c)} className="ml-1 hover:text-destructive">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Atividade */}
        <AccordionItem value="activity" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <span>Atividade Empresarial</span>
              {(filters.cnae.length > 0 || filters.termo || filters.natureza_juridica.length > 0) && (
                <Badge variant="secondary" className="ml-2">
                  {filters.cnae.length + (filters.termo ? 1 : 0) + filters.natureza_juridica.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium">Termo de Busca</Label>
              <Input
                placeholder="Ex: restaurante, tecnologia, advocacia..."
                value={filters.termo}
                onChange={(e) => updateFilter('termo', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">CNAE Principal</Label>
              <AutocompleteInput
                placeholder="Pesquisar por código ou descrição..."
                options={cnaeOptions}
                value={filters.cnae}
                onChange={(v) => updateFilter('cnae', v)}
                onSearch={setCnaeSearch}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir_atividade_secundaria"
                checked={filters.incluir_atividade_secundaria}
                onCheckedChange={(c) => updateFilter('incluir_atividade_secundaria', !!c)}
              />
              <Label htmlFor="incluir_atividade_secundaria" className="text-sm">Incluir atividade secundária na busca</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Situação Cadastral</Label>
                <Select value={filters.situacao_cadastral} onValueChange={(v) => updateFilter('situacao_cadastral', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SITUACOES.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Natureza Jurídica</Label>
                <MultiSelect
                  options={NATUREZA_JURIDICA.map(n => ({ value: n.value, label: n.label }))}
                  value={filters.natureza_juridica}
                  onChange={(v) => updateFilter('natureza_juridica', v)}
                  placeholder="Selecionar..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_mei" 
                  checked={filters.somente_mei} 
                  onCheckedChange={(c) => updateExclusiveFilters({ somente_mei: !!c, excluir_mei: c ? false : filters.excluir_mei })} 
                />
                <Label htmlFor="somente_mei" className="text-sm">Somente MEI</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="excluir_mei" 
                  checked={filters.excluir_mei} 
                  onCheckedChange={(c) => updateExclusiveFilters({ excluir_mei: !!c, somente_mei: c ? false : filters.somente_mei })} 
                />
                <Label htmlFor="excluir_mei" className="text-sm">Excluir MEI</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_matriz" 
                  checked={filters.somente_matriz} 
                  onCheckedChange={(c) => updateExclusiveFilters({ somente_matriz: !!c, somente_filial: c ? false : filters.somente_filial })} 
                />
                <Label htmlFor="somente_matriz" className="text-sm">Somente Matriz</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_filial" 
                  checked={filters.somente_filial} 
                  onCheckedChange={(c) => updateExclusiveFilters({ somente_filial: !!c, somente_matriz: c ? false : filters.somente_matriz })} 
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
                <Checkbox id="com_telefone" checked={filters.com_telefone} onCheckedChange={(c) => updateFilter('com_telefone', !!c)} />
                <Label htmlFor="com_telefone" className="text-sm">Com Telefone</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_celular" 
                  checked={filters.somente_celular} 
                  onCheckedChange={(c) => updateExclusiveFilters({ somente_celular: !!c, somente_fixo: c ? false : filters.somente_fixo })} 
                />
                <Label htmlFor="somente_celular" className="text-sm">Somente Celular</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="somente_fixo" 
                  checked={filters.somente_fixo} 
                  onCheckedChange={(c) => updateExclusiveFilters({ somente_fixo: !!c, somente_celular: c ? false : filters.somente_celular })} 
                />
                <Label htmlFor="somente_fixo" className="text-sm">Somente Fixo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="com_email" checked={filters.com_email} onCheckedChange={(c) => updateFilter('com_email', !!c)} />
                <Label htmlFor="com_email" className="text-sm">Com Email</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="excluir_email_contab" checked={filters.excluir_email_contab} onCheckedChange={(c) => updateFilter('excluir_email_contab', !!c)} />
              <Label htmlFor="excluir_email_contab" className="text-sm">Excluir emails de contabilidade</Label>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Data Abertura (de)</Label>
                <Input type="date" value={filters.data_abertura_gte} onChange={(e) => updateFilter('data_abertura_gte', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Data Abertura (até)</Label>
                <Input type="date" value={filters.data_abertura_lte} onChange={(e) => updateFilter('data_abertura_lte', e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Capital Social (mín.)</Label>
                <Input type="number" placeholder="R$ 0,00" value={filters.capital_social_gte} onChange={(e) => updateFilter('capital_social_gte', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Capital Social (máx.)</Label>
                <Input type="number" placeholder="R$ 0,00" value={filters.capital_social_lte} onChange={(e) => updateFilter('capital_social_lte', e.target.value)} className="mt-1" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Identificação */}
        <AccordionItem value="identification" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              <span>Identificação</span>
              {(filters.cnpj.length > 0 || filters.cnpj_raiz.length > 0) && (
                <Badge variant="secondary" className="ml-2">{filters.cnpj.length + filters.cnpj_raiz.length}</Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium">CNPJs específicos</Label>
              <Input placeholder="Digite o CNPJ e pressione Enter" onKeyDown={(e) => { if (e.key === 'Enter') { handleAddTag('cnpj', e.currentTarget.value.replace(/\D/g, '')); e.currentTarget.value = ''; }}} className="mt-1" />
              {filters.cnpj.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {filters.cnpj.map((c) => (<Badge key={c} variant="secondary" className="gap-1 pr-1">{c}<button onClick={() => handleRemoveTag('cnpj', c)} className="ml-1 hover:text-destructive">×</button></Badge>))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Exclusões */}
        <AccordionItem value="exclusions" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-primary" />
              <span>Exclusões</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium">Excluir CNPJs</Label>
              <Input placeholder="Digite o CNPJ a excluir e pressione Enter" onKeyDown={(e) => { if (e.key === 'Enter') { handleAddTag('excluir_cnpj', e.currentTarget.value.replace(/\D/g, '')); e.currentTarget.value = ''; }}} className="mt-1" />
              {filters.excluir_cnpj.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {filters.excluir_cnpj.map((c) => (<Badge key={c} variant="secondary" className="gap-1 pr-1">{c}<button onClick={() => handleRemoveTag('excluir_cnpj', c)} className="ml-1 hover:text-destructive">×</button></Badge>))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button onClick={handleSearchClick} disabled={isSearching} className="flex-1 md:flex-none">
          <Search className="h-4 w-4 mr-2" />
          {isSearching ? "Pesquisando..." : "Pesquisar Empresas"}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isSearching}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Limpar Filtros
        </Button>
        {activeFiltersCount() > 0 && (<Badge variant="secondary">{activeFiltersCount()} filtro(s) ativo(s)</Badge>)}
      </div>
    </div>
  );
};
