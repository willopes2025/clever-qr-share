import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Repeat, Users } from 'lucide-react';

interface MRRCardProps {
  mrr: number;
  subscriptionsCount: number;
  isLoading?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const MRRCard = ({ mrr, subscriptionsCount, isLoading = false }: MRRCardProps) => {
  const averageTicket = subscriptionsCount > 0 ? mrr / subscriptionsCount : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Receita Recorrente (MRR)</CardTitle>
            <CardDescription>Assinaturas ativas normalizadas mensalmente</CardDescription>
          </div>
          <Repeat className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-primary">
            {formatCurrency(mrr)}
          </span>
          <span className="text-muted-foreground">/mês</span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Assinaturas ativas</p>
              <p className="text-lg font-semibold">{subscriptionsCount}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ticket médio</p>
            <p className="text-lg font-semibold">{formatCurrency(averageTicket)}</p>
          </div>
        </div>

        {/* ARR projection */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Projeção anual (ARR)</span>
            <span className="text-sm font-semibold">{formatCurrency(mrr * 12)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
