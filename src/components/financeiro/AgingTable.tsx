import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Aging } from '@/hooks/useFinancialMetrics';
import { cn } from '@/lib/utils';

interface AgingTableProps {
  aging: Aging;
  isLoading?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const AgingTable = ({ aging, isLoading = false }: AgingTableProps) => {
  const total = aging.days0to30.value + aging.days31to60.value + aging.days61to90.value + aging.days90plus.value;
  
  const categories = [
    { 
      label: '0-30 dias', 
      data: aging.days0to30, 
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600'
    },
    { 
      label: '31-60 dias', 
      data: aging.days31to60, 
      color: 'bg-orange-500',
      textColor: 'text-orange-600'
    },
    { 
      label: '61-90 dias', 
      data: aging.days61to90, 
      color: 'bg-red-500',
      textColor: 'text-red-600'
    },
    { 
      label: '90+ dias', 
      data: aging.days90plus, 
      color: 'bg-red-700',
      textColor: 'text-red-700'
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aging de Cobranças</CardTitle>
        <CardDescription>Distribuição por tempo de atraso</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[100px]">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => {
              const percentage = total > 0 ? (category.data.value / total) * 100 : 0;
              
              return (
                <TableRow key={category.label}>
                  <TableCell className={cn('font-medium', category.textColor)}>
                    {category.label}
                  </TableCell>
                  <TableCell className="text-right">
                    {category.data.count}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(category.data.value)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('absolute top-0 left-0 h-full rounded-full', category.color)}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="border-t-2">
              <TableCell className="font-bold">Total</TableCell>
              <TableCell className="text-right font-bold">
                {categories.reduce((sum, c) => sum + c.data.count, 0)}
              </TableCell>
              <TableCell className="text-right font-bold">
                {formatCurrency(total)}
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
