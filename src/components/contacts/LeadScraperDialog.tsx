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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Building2 } from "lucide-react";
import { BRAZILIAN_STATES, CNAE_CATEGORIES } from "@/lib/constants/brazilian-data";

interface LeadScraperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (params: {
    estado_id: string;
    cidade_id?: string;
    cnae_id: string;
    limite: number;
    apenas_ativos: boolean;
  }) => void;
  isLoading: boolean;
}

export function LeadScraperDialog({
  open,
  onOpenChange,
  onSearch,
  isLoading,
}: LeadScraperDialogProps) {
  const [estadoId, setEstadoId] = useState("");
  const [cidadeId, setCidadeId] = useState("");
  const [cnaeId, setCnaeId] = useState("");
  const [limite, setLimite] = useState(20);
  const [apenasAtivos, setApenasAtivos] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!estadoId || !cnaeId) return;

    onSearch({
      estado_id: estadoId,
      cidade_id: cidadeId || undefined,
      cnae_id: cnaeId,
      limite,
      apenas_ativos: apenasAtivos,
    });
  };

  const isValid = estadoId && cnaeId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-card border-neon-cyan/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-glow-cyan">
            <Building2 className="h-5 w-5" />
            Buscar Leads (CNPJ.ws)
          </DialogTitle>
          <DialogDescription>
            Busque empresas por estado, cidade e segmento de negócio para gerar leads qualificados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
              disabled={!isValid || isLoading}
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
      </DialogContent>
    </Dialog>
  );
}
