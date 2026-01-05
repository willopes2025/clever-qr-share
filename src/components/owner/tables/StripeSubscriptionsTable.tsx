import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StripeSubscription {
  id: string;
  customer_email: string;
  customer_name: string | null;
  product_name: string;
  price: number;
  status: string;
  current_period_end: string;
  created: string;
}

interface Props {
  subscriptions: StripeSubscription[];
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
    case 'active':
      return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Ativa</Badge>;
    case 'trialing':
      return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Trial</Badge>;
    case 'past_due':
      return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">Atrasada</Badge>;
    case 'canceled':
      return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Cancelada</Badge>;
    case 'unpaid':
      return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Não Paga</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const StripeSubscriptionsTable = ({ subscriptions, loading }: Props) => {
  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando assinaturas...</div>;
  }

  if (subscriptions.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Nenhuma assinatura encontrada</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Plano</TableHead>
          <TableHead className="text-right">Valor/mês</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Próx. Cobrança</TableHead>
          <TableHead>Criada em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.map((sub) => (
          <TableRow key={sub.id}>
            <TableCell>
              <div>
                <p className="font-medium">{sub.customer_name || sub.customer_email}</p>
                {sub.customer_name && (
                  <p className="text-xs text-muted-foreground">{sub.customer_email}</p>
                )}
              </div>
            </TableCell>
            <TableCell>{sub.product_name}</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(sub.price)}</TableCell>
            <TableCell>{getStatusBadge(sub.status)}</TableCell>
            <TableCell>
              {format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {format(new Date(sub.created), "dd/MM/yyyy", { locale: ptBR })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default StripeSubscriptionsTable;
