import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSsotica } from "@/hooks/useSsotica";
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

export const SsoticaVendasList = () => {
  const { vendas, isLoading } = useSsotica();
  const [search, setSearch] = useState("");

  const filteredVendas = vendas.filter((venda: any) => {
    const searchLower = search.toLowerCase();
    return (
      venda.numero?.toString().includes(search) ||
      venda.cliente?.nome?.toLowerCase().includes(searchLower) ||
      venda.forma_pagamento?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Vendas
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar venda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredVendas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {search ? "Nenhuma venda encontrada para esta busca" : "Nenhuma venda nos últimos 30 dias"}
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
                  <TableRow key={venda.id || venda.numero}>
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
  );
};
