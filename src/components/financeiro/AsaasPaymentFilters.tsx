import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Filter, X, Search } from "lucide-react";
import { AsaasCustomer } from "@/hooks/useAsaas";

export interface PaymentFilters {
  customer: string;
  status: string;
  billingType: string;
  dueDateStart: string;
  dueDateEnd: string;
  valueMin: string;
  valueMax: string;
  searchQuery: string;
}

interface AsaasPaymentFiltersProps {
  filters: PaymentFilters;
  onFiltersChange: (filters: PaymentFilters) => void;
  customers: AsaasCustomer[];
}

const statusOptions = [
  { value: "all", label: "Todos os status" },
  { value: "PENDING", label: "Pendente" },
  { value: "RECEIVED", label: "Recebido" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "OVERDUE", label: "Vencido" },
  { value: "REFUNDED", label: "Estornado" },
  { value: "RECEIVED_IN_CASH", label: "Recebido em dinheiro" },
  { value: "REFUND_REQUESTED", label: "Estorno solicitado" },
  { value: "CHARGEBACK_REQUESTED", label: "Chargeback" },
  { value: "CHARGEBACK_DISPUTE", label: "Disputa de chargeback" },
  { value: "AWAITING_CHARGEBACK_REVERSAL", label: "Aguardando reversão" },
  { value: "DUNNING_REQUESTED", label: "Negativação solicitada" },
  { value: "DUNNING_RECEIVED", label: "Recuperado por negativação" },
  { value: "AWAITING_RISK_ANALYSIS", label: "Análise de risco" },
];

const billingTypeOptions = [
  { value: "all", label: "Todos os tipos" },
  { value: "PIX", label: "PIX" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CREDIT_CARD", label: "Cartão de Crédito" },
  { value: "DEBIT_CARD", label: "Cartão de Débito" },
  { value: "UNDEFINED", label: "Indefinido" },
];

export const AsaasPaymentFilters = ({ filters, onFiltersChange, customers }: AsaasPaymentFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof PaymentFilters>(key: K, value: PaymentFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      customer: "",
      status: "all",
      billingType: "all",
      dueDateStart: "",
      dueDateEnd: "",
      valueMin: "",
      valueMax: "",
      searchQuery: "",
    });
  };

  const activeFiltersCount = [
    filters.customer,
    filters.status !== "all" ? filters.status : "",
    filters.billingType !== "all" ? filters.billingType : "",
    filters.dueDateStart,
    filters.dueDateEnd,
    filters.valueMin,
    filters.valueMax,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Busca por texto */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.searchQuery}
          onChange={(e) => updateFilter("searchQuery", e.target.value)}
          placeholder="Buscar por descrição..."
          className="pl-9"
        />
      </div>

      {/* Filtros avançados */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filtros</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>

            {/* Cliente */}
            <div className="space-y-2">
              <Label className="text-xs">Cliente</Label>
              <Select
                value={filters.customer || "all"}
                onValueChange={(value) => updateFilter("customer", value === "all" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilter("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label className="text-xs">Tipo de Cobrança</Label>
              <Select
                value={filters.billingType}
                onValueChange={(value) => updateFilter("billingType", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {billingTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data de Vencimento */}
            <div className="space-y-2">
              <Label className="text-xs">Vencimento</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={filters.dueDateStart}
                    onChange={(e) => updateFilter("dueDateStart", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={filters.dueDateEnd}
                    onChange={(e) => updateFilter("dueDateEnd", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Faixa de Valor */}
            <div className="space-y-2">
              <Label className="text-xs">Valor (R$)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={filters.valueMin}
                    onChange={(e) => updateFilter("valueMin", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Máximo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={filters.valueMax}
                    onChange={(e) => updateFilter("valueMax", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>

            <Button onClick={() => setIsOpen(false)} className="w-full">
              Aplicar Filtros
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const initialPaymentFilters: PaymentFilters = {
  customer: "",
  status: "all",
  billingType: "all",
  dueDateStart: "",
  dueDateEnd: "",
  valueMin: "",
  valueMax: "",
  searchQuery: "",
};
