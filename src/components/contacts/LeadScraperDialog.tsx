import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Building2, AlertTriangle, FileSearch } from "lucide-react";
import { BRAZILIAN_STATES, CNAE_CATEGORIES } from "@/lib/constants/brazilian-data";
import { ScrapeParams } from "@/hooks/useScrapedLeads";

interface LeadScraperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (params: ScrapeParams) => void;
  isLoading: boolean;
}

export function LeadScraperDialog({
  open,
  onOpenChange,
  onSearch,
  isLoading,
}: LeadScraperDialogProps) {
  const [activeTab, setActiveTab] = useState<"cnpj" | "search">("cnpj");
  
  // Search mode state
  const [estadoId, setEstadoId] = useState("");
  const [cidadeId, setCidadeId] = useState("");
  const [cnaeId, setCnaeId] = useState("");
  const [limite, setLimite] = useState(20);
  const [apenasAtivos, setApenasAtivos] = useState(true);
  
  // CNPJ mode state
  const [cnpjInput, setCnpjInput] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!estadoId || !cnaeId) return;

    onSearch({
      mode: 'search',
      estado_id: estadoId,
      cidade_id: cidadeId || undefined,
      cnae_id: cnaeId,
      limite,
      apenas_ativos: apenasAtivos,
    });
  };

  const handleCnpjSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse CNPJs from input (one per line or comma-separated)
    const cnpjs = cnpjInput
      .split(/[\n,;]/)
      .map(c => c.trim())
      .filter(c => c.length > 0);
    
    if (cnpjs.length === 0) return;
    
    if (cnpjs.length > 20) {
      alert("Limite de 20 CNPJs por consulta. Por favor, reduza a quantidade.");
      return;
    }

    onSearch({
      mode: 'cnpj',
      cnpjs,
    });
  };

  const isSearchValid = estadoId && cnaeId;
  const isCnpjValid = cnpjInput.trim().length > 0;
  
  const cnpjCount = cnpjInput
    .split(/[\n,;]/)
    .map(c => c.trim())
    .filter(c => c.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] glass-card border-neon-cyan/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-glow-cyan">
            <Building2 className="h-5 w-5" />
            Buscar Leads (CNPJ.ws)
          </DialogTitle>
          <DialogDescription>
            Busque empresas por CNPJ específico ou por filtros de segmento.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "cnpj" | "search")} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cnpj" className="flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              Por CNPJ
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Por Filtros
            </TabsTrigger>
          </TabsList>

          {/* CNPJ Mode - Works with basic plan */}
          <TabsContent value="cnpj" className="mt-4">
            <form onSubmit={handleCnpjSubmit} className="space-y-4">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
                <p className="text-sm text-emerald-400">
                  ✓ Funciona com plano básico da CNPJ.ws
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpjs">CNPJs para consultar</Label>
                <Textarea
                  id="cnpjs"
                  placeholder={`Cole os CNPJs aqui (um por linha ou separados por vírgula)

Exemplo:
00.000.000/0001-00
11111111000111
22.222.222/0001-22`}
                  value={cnpjInput}
                  onChange={(e) => setCnpjInput(e.target.value)}
                  className="bg-dark-800/50 border-neon-cyan/30 min-h-[150px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {cnpjCount > 0 ? `${cnpjCount} CNPJ(s) detectado(s)` : "Máximo 20 CNPJs por consulta"}
                  {cnpjCount > 20 && (
                    <span className="text-destructive ml-2">(excede o limite de 20)</span>
                  )}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="neon-border"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={!isCnpjValid || cnpjCount > 20 || isLoading}
                  className="bg-gradient-neon hover:opacity-90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Consultar CNPJs
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Search Mode - Premium only */}
          <TabsContent value="search" className="mt-4">
            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-400">
                  Requer plano Premium da CNPJ.ws. Se você tem plano básico, use a aba "Por CNPJ".
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <Select value={estadoId} onValueChange={setEstadoId}>
                    <SelectTrigger className="bg-dark-800/50 border-neon-cyan/30">
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map((state) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade (opcional)</Label>
                  <Input
                    id="cidade"
                    placeholder="Ex: São Paulo"
                    value={cidadeId}
                    onChange={(e) => setCidadeId(e.target.value)}
                    className="bg-dark-800/50 border-neon-cyan/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="segmento">Segmento de Negócio *</Label>
                <Select value={cnaeId} onValueChange={setCnaeId}>
                  <SelectTrigger className="bg-dark-800/50 border-neon-cyan/30">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {CNAE_CATEGORIES.map((category) => (
                      <SelectItem key={category.code} value={category.code}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="limite">Quantidade de Leads</Label>
                  <Input
                    id="limite"
                    type="number"
                    min={1}
                    max={100}
                    value={limite}
                    onChange={(e) => setLimite(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="bg-dark-800/50 border-neon-cyan/30"
                  />
                </div>

                <div className="flex items-end pb-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="apenas-ativos"
                      checked={apenasAtivos}
                      onCheckedChange={(checked) => setApenasAtivos(checked as boolean)}
                    />
                    <Label htmlFor="apenas-ativos" className="text-sm cursor-pointer">
                      Apenas empresas ativas
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="neon-border"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={!isSearchValid || isLoading}
                  className="bg-gradient-neon hover:opacity-90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Buscar Leads
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
