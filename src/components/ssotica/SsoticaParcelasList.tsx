import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSsotica, SsoticaParcela } from "@/hooks/useSsotica";
import { Loader2, Search, Receipt, AlertTriangle } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
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

export const SsoticaParcelasList = () => {
  const { parcelas, isLoading } = useSsotica();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [valorFilter, setValorFilter] = useState("all");
  const [selectedParcela, setSelectedParcela] = useState<SsoticaParcela | null>(null);

  const filteredParcelas = useMemo(() => {
    return parcelas.filter((parcela: any) => {
      // Status filter
      if (statusFilter !== "all") {
        const vencimento = new Date(parcela.vencimento);
        const isVencida = isPast(vencimento) && !isToday(vencimento);
        const isHoje = isToday(vencimento);
        
        if (statusFilter === "vencidas" && !isVencida) return false;
        if (statusFilter === "hoje" && !isHoje) return false;
        if (statusFilter === "em_dia" && (isVencida || isHoje)) return false;
      }

      // Value filter
      if (valorFilter !== "all") {
        const valor = parcela.valor || 0;
        if (valorFilter === "ate500" && valor > 500) return false;
        if (valorFilter === "500a2000" && (valor <= 500 || valor > 2000)) return false;
        if (valorFilter === "acima2000" && valor <= 2000) return false;
      }

      // Search filter
      const searchLower = search.toLowerCase();
      return (
        parcela.numero?.toString().includes(search) ||
        parcela.documento?.toString().includes(search) ||
        parcela.cliente?.nome?.toLowerCase().includes(searchLower)
      );
    });
  }, [parcelas, statusFilter, valorFilter, search]);

  // Sort by vencimento (oldest first)
  const sortedParcelas = useMemo(() => {
    return [...filteredParcelas].sort((a: any, b: any) => {
      return new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime();
    });
  }, [filteredParcelas]);

  const getVencimentoBadge = (vencimento: string) => {
    const dataVencimento = new Date(vencimento);
    
    if (isPast(dataVencimento) && !isToday(dataVencimento)) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Vencida
        </Badge>
      );
    }
    if (isToday(dataVencimento)) {
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Vence hoje</Badge>;
    }
    return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Em dia</Badge>;
  };

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
              <Receipt className="h-5 w-5" />
              Parcelas em Aberto
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar parcela..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="vencidas">Vencidas</SelectItem>
                  <SelectItem value="hoje">Vence Hoje</SelectItem>
                  <SelectItem value="em_dia">Em Dia</SelectItem>
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
          {sortedParcelas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search || statusFilter !== "all" || valorFilter !== "all"
                ? "Nenhuma parcela encontrada com os filtros aplicados" 
                : "Nenhuma parcela em aberto encontrada"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedParcelas.map((parcela: any, index: number) => (
                    <TableRow 
                      key={parcela.id || index}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedParcela(parcela)}
                    >
                      <TableCell className="font-medium">
                        {parcela.documento || parcela.numero || '-'}
                      </TableCell>
                      <TableCell>
                        {parcela.cliente?.nome || (
                          <span className="text-muted-foreground italic">Não disponível</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {parcela.vencimento 
                          ? format(new Date(parcela.vencimento), "dd/MM/yyyy", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>{getVencimentoBadge(parcela.vencimento)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {parcela.valor 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcela.valor)
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
        open={!!selectedParcela}
        onOpenChange={(open) => !open && setSelectedParcela(null)}
        title={`Parcela ${selectedParcela?.documento || selectedParcela?.numero || ''}`}
        data={selectedParcela}
        type="parcela"
      />
    </>
  );
};
