import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSsotica, SsoticaOS } from "@/hooks/useSsotica";
import { Loader2, Search, FileText } from "lucide-react";
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

interface SsoticaOSListProps {
  dateRange: SsoticaDateRange;
}

export const SsoticaOSList = ({ dateRange }: SsoticaOSListProps) => {
  const { ordensServico, isLoading } = useSsotica();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOS, setSelectedOS] = useState<SsoticaOS | null>(null);

  const filteredOS = useMemo(() => {
    return ordensServico.filter((os: any) => {
      // Date filter
      if (os.data_entrada) {
        const dataEntrada = new Date(os.data_entrada);
        if (dataEntrada < dateRange.from || dataEntrada > dateRange.to) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all") {
        const osStatus = normalizeStatusKey(os.status);
        if (osStatus !== statusFilter) {
          return false;
        }
      }

      // Search filter
      const searchLower = search.toLowerCase();
      return (
        os.numero?.toString().includes(search) ||
        os.cliente?.nome?.toLowerCase().includes(searchLower) ||
        os.status?.toLowerCase().includes(searchLower)
      );
    });
  }, [ordensServico, dateRange, statusFilter, search]);

  const getStatusBadge = (status: string) => {
    const normalized = normalizeStatusKey(status);
    
    if (normalized === 'concluido') {
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Concluído</Badge>;
    }
    if (normalized === 'producao') {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Em Produção</Badge>;
    }
    if (normalized === 'aberto') {
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Aberto</Badge>;
    }
    if (normalized === 'pendente') {
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
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
              <FileText className="h-5 w-5" />
              Ordens de Serviço
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar O.S...."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="aberto">Aberto / Ativo</SelectItem>
                  <SelectItem value="producao">Em Produção</SelectItem>
                  <SelectItem value="pendente">Pendente / Aguardando</SelectItem>
                  <SelectItem value="concluido">Concluído / Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOS.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search || statusFilter !== "all" 
                ? "Nenhuma O.S. encontrada com os filtros aplicados" 
                : "Nenhuma O.S. no período selecionado"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOS.map((os: any) => (
                    <TableRow 
                      key={os.id || os.numero}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedOS(os)}
                    >
                      <TableCell className="font-medium">#{os.numero}</TableCell>
                      <TableCell>{os.cliente?.nome || '-'}</TableCell>
                      <TableCell>
                        {os.data_entrada 
                          ? format(new Date(os.data_entrada), "dd/MM/yyyy", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {os.previsao_entrega 
                          ? format(new Date(os.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(os.status)}</TableCell>
                      <TableCell className="text-right">
                        {os.valor_total 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.valor_total)
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
        open={!!selectedOS}
        onOpenChange={(open) => !open && setSelectedOS(null)}
        title={`O.S. #${selectedOS?.numero || ''}`}
        data={selectedOS}
        type="os"
      />
    </>
  );
};

function normalizeStatusKey(status: string | undefined): string {
  const s = (status || '').toLowerCase().trim();
  
  // Concluído/Entregue/Finalizado
  if (s.includes('conclu') || s.includes('entregu') || s.includes('finaliz') || s === 'entregue') {
    return 'concluido';
  }
  
  // Em Produção/Laboratório
  if (s.includes('produc') || s.includes('produção') || s.includes('laborat') || s === 'em_producao') {
    return 'producao';
  }
  
  // Aberto/Ativo/Em Andamento
  if (s.includes('aberto') || s.includes('aberta') || s.includes('ativ') || s.includes('andamento')) {
    return 'aberto';
  }
  
  // Pendente/Aguardando
  if (s.includes('pendent') || s.includes('aguard')) {
    return 'pendente';
  }
  
  return 'outros';
}
