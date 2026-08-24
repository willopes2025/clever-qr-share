import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Quantidade exibida após o filtro */
  shown: number;
  /** Quantidade total carregada */
  total: number;
  label?: string;
}

/** Busca local sobre os resultados já carregados do ERP (não chama a API) */
export const ResultSearch = ({
  value,
  onChange,
  placeholder = "Filtrar resultados...",
  shown,
  total,
  label = "registro(s)",
}: ResultSearchProps) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
    <div className="relative flex-1">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8 h-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={() => onChange("")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {value ? `${shown} de ${total} ${label}` : `${total} ${label}`}
    </span>
  </div>
);
