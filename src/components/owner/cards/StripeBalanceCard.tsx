import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Clock } from "lucide-react";

interface Props {
  available: number;
  pending: number;
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const StripeBalanceCard = ({ available, pending, loading }: Props) => {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span className="text-sm font-medium">Saldo Disponível</span>
          </div>
          <p className={`text-2xl font-bold mt-2 ${available >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {loading ? '...' : formatCurrency(available)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Disponível para saque no Stripe</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Saldo Pendente</span>
          </div>
          <p className="text-2xl font-bold mt-2 text-amber-500">
            {loading ? '...' : formatCurrency(pending)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Em processamento pelo Stripe</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StripeBalanceCard;
