import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TopDebtor } from '@/hooks/useFinancialMetrics';
import { cn } from '@/lib/utils';
import { AlertCircle, User } from 'lucide-react';

interface TopDebtorsTableProps {
  debtors: TopDebtor[];
  isLoading?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getDaysOverdueColor = (days: number): string => {
  if (days <= 30) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  if (days <= 60) return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
  return 'bg-red-500/10 text-red-600 border-red-500/20';
};

export const TopDebtorsTable = ({ debtors, isLoading = false }: TopDebtorsTableProps) => {
  if (debtors.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Maiores Devedores</CardTitle>
          <CardDescription>Clientes com maior valor em atraso</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhum devedor encontrado</p>
            <p className="text-xs">Todas as cobranças estão em dia!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Maiores Devedores</CardTitle>
        <CardDescription>Top 10 clientes com maior valor em atraso</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Cobranças</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Atraso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debtors.map((debtor, index) => (
              <TableRow key={debtor.customer}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm line-clamp-1">
                        {debtor.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {debtor.paymentsCount}
                </TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatCurrency(debtor.value)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={cn('text-xs', getDaysOverdueColor(debtor.daysOverdue))}>
                    {debtor.daysOverdue}d
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
