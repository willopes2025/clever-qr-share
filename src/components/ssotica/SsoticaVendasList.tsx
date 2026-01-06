import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSsotica, SsoticaVenda } from "@/hooks/useSsotica";
import { Loader2, Search, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SsoticaDetailSheet } from "./SsoticaDetailSheet";
import { SsoticaDateRange } from "./SsoticaDateFilter";

interface SsoticaVendasListProps {
  dateRange: SsoticaDateRange;
}

export const SsoticaVendasList = ({ dateRange }: SsoticaVendasListProps) => {
  const { vendas, isLoading } = useSsotica();
  const [search, setSearch] = useState("");
  const [formaPagamentoFilter, setFormaPagamentoFilter] = useState("all");
  const [valorFilter, setValorFilter] = useState("all");
  const [selectedVenda, setSelectedVenda] = useState<SsoticaVenda | null>(null);

  // Get unique payment methods for filter
  const formasPagamento = useMemo(() => {
    const formas = new Set<string>();
    vendas.forEach((v) => {
      if (v.forma_pagamento) formas.add(v.forma_pagamento);
    });
    return Array.from(formas).sort();
  }, [vendas]);

  const filteredVendas = useMemo(() => {
    return vendas.filter((venda: any) => {
      // Date filter
      if (venda.data_venda) {
        const dataVenda = new Date(venda.data_venda);
        if (dataVenda < dateRange.from || dataVenda > dateRange.to) {
          return false;
        }
      }

      // Payment method filter
      if (formaPagamentoFilter !== "all" && venda.forma_pagamento !== formaPagamentoFilter) {
        return false;
      }

      // Value filter
      if (valorFilter !== "all") {
        const valor = venda.valor_total || 0;
        if (valorFilter === "ate500" && valor > 500) return false;
        if (valorFilter === "500a2000" && (valor <= 500 || valor > 2000)) return false;
        if (valorFilter === "acima2000" && valor <= 2000) return false;
      }

      // Search filter
      const searchLower = search.toLowerCase();
      return (
        venda.numero?.toString().includes(search) ||
        venda.cliente?.nome?.toLowerCase().includes(searchLower) ||
        venda.forma_pagamento?.toLowerCase().includes(searchLower)
      );
    });
  }, [vendas, dateRange, formaPagamentoFilter, valorFilter, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Vendas
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar venda..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={formaPagamentoFilter} onValueChange={setFormaPagamentoFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Forma pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Formas</SelectItem>
                  {formasPagamento.map((forma) => (
                    <SelectItem key={forma} value={forma}>{forma}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={valorFilter} onValueChange={setValorFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Faixa de valor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer Valor</SelectItem>
                  <SelectItem value="ate500">Até R$ 500</SelectItem>
                  <SelectItem value="500a2000">R$ 500 - R$ 2.000</SelectItem>
                  <SelectItem value="acima2000">Acima de R$ 2.000</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredVendas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search || formaPagamentoFilter !== "all" || valorFilter !== "all"
                ? "Nenhuma venda encontrada com os filtros aplicados" 
                : "Nenhuma venda no período selecionado"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Forma Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendas.map((venda: any) => (
                    <TableRow 
                      key={venda.id || venda.numero}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedVenda(venda)}
                    >
                      <TableCell className="font-medium">#{venda.numero}</TableCell>
                      <TableCell>{venda.cliente?.nome || '-'}</TableCell>
                      <TableCell>
                        {venda.data_venda 
                          ? format(new Date(venda.data_venda), "dd/MM/yyyy", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>{venda.forma_pagamento || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {venda.valor_total 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.valor_total)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SsoticaDetailSheet
        open={!!selectedVenda}
        onOpenChange={(open) => !open && setSelectedVenda(null)}
        title={`Venda #${selectedVenda?.numero || ''}`}
        data={selectedVenda}
        type="venda"
      />
    </>
  );
};
