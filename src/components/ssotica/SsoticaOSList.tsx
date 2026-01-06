import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSsotica } from "@/hooks/useSsotica";
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

export const SsoticaOSList = () => {
  const { ordensServico, isLoading } = useSsotica();
  const [search, setSearch] = useState("");

  const filteredOS = ordensServico.filter((os: any) => {
    const searchLower = search.toLowerCase();
    return (
      os.numero?.toString().includes(search) ||
      os.cliente?.nome?.toLowerCase().includes(searchLower) ||
      os.status?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'concluido' || statusLower === 'entregue') {
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Concluído</Badge>;
    }
    if (statusLower === 'em_andamento' || statusLower === 'producao') {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Em Andamento</Badge>;
    }
    if (statusLower === 'pendente' || statusLower === 'aguardando') {
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
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ordens de Serviço
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar O.S...."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredOS.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {search ? "Nenhuma O.S. encontrada para esta busca" : "Nenhuma O.S. nos últimos 30 dias"}
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
                  <TableRow key={os.id || os.numero}>
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
  );
};
