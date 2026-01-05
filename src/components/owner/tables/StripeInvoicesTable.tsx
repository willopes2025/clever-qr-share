import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StripeInvoice {
  id: string;
  customer_email: string;
  amount_paid: number;
  status: string;
  created: string;
  invoice_pdf: string | null;
}

interface Props {
  invoices: StripeInvoice[];
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Paga</Badge>;
    case 'open':
      return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Aberta</Badge>;
    case 'draft':
      return <Badge className="bg-muted text-muted-foreground">Rascunho</Badge>;
    case 'void':
      return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Cancelada</Badge>;
    case 'uncollectible':
      return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Irrecuperável</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const StripeInvoicesTable = ({ invoices, loading }: Props) => {
  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando faturas...</div>;
  }

  if (invoices.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Nenhuma fatura encontrada</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell className="font-mono text-xs">{invoice.id.slice(0, 20)}...</TableCell>
            <TableCell>{invoice.customer_email}</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(invoice.amount_paid)}</TableCell>
            <TableCell>{getStatusBadge(invoice.status)}</TableCell>
            <TableCell>
              {format(new Date(invoice.created), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </TableCell>
            <TableCell className="text-right">
              {invoice.invoice_pdf && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(invoice.invoice_pdf!, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default StripeInvoicesTable;
