import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useFinancialMetrics } from '@/hooks/useFinancialMetrics';
import { cn } from '@/lib/utils';
import { 
  ArrowLeft, 
  Filter, 
  User,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';

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

const DebtorsManagement = () => {
  const navigate = useNavigate();

  const [minValue, setMinValue] = useState('0');
  const [selectedDebtors, setSelectedDebtors] = useState<string[]>([]);

  const dateRange = useMemo(() => ({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  }), []);

  const metrics = useFinancialMetrics(dateRange);

  // Pegar todos os devedores (não só top 10) - precisamos recalcular
  const allDebtors = useMemo(() => {
    // Por enquanto usamos o topDebtors, mas sem limite
    // A lógica completa seria expor uma versão sem limite do useFinancialMetrics
    return metrics.topDebtors;
  }, [metrics.topDebtors]);

  const filteredDebtors = useMemo(() => {
    const minValueNum = parseFloat(minValue) || 0;
    return allDebtors.filter(d => d.value >= minValueNum);
  }, [allDebtors, minValue]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDebtors(filteredDebtors.map(d => d.customer));
    } else {
      setSelectedDebtors([]);
    }
  };

  const handleSelectDebtor = (customerId: string, checked: boolean) => {
    if (checked) {
      setSelectedDebtors(prev => [...prev, customerId]);
    } else {
      setSelectedDebtors(prev => prev.filter(id => id !== customerId));
    }
  };

  const totalSelected = selectedDebtors.length;
  const totalValueSelected = filteredDebtors
    .filter(d => selectedDebtors.includes(d.customer))
    .reduce((sum, d) => sum + d.value, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/financeiro')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Gestão de Inadimplentes</h1>
            <p className="text-muted-foreground">
              Gerencie devedores e cobranças em atraso
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minValue">Valor mínimo da dívida</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">R$</span>
                    <Input
                      id="minValue"
                      type="number"
                      value={minValue}
                      onChange={(e) => setMinValue(e.target.value)}
                      className="w-32"
                      min="0"
                      step="100"
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredDebtors.length} devedor(es) encontrado(s)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Devedores */}
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-base">Lista de Devedores</CardTitle>
                <CardDescription>
                  Clientes com cobranças vencidas
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {metrics.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredDebtors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhum devedor encontrado</p>
                  <p className="text-sm">
                    {parseFloat(minValue) > 0 
                      ? 'Tente diminuir o valor mínimo do filtro' 
                      : 'Todas as cobranças estão em dia!'}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedDebtors.length === filteredDebtors.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead className="text-right">Cobranças</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Atraso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDebtors.map((debtor) => (
                        <TableRow key={debtor.customer}>
                          <TableCell>
                            <Checkbox
                              checked={selectedDebtors.includes(debtor.customer)}
                              onCheckedChange={(checked) => 
                                handleSelectDebtor(debtor.customer, !!checked)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <span className="font-medium">{debtor.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {debtor.customerCpfCnpj || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {debtor.paymentsCount}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-destructive">
                            {formatCurrency(debtor.value)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant="outline" 
                              className={cn('text-xs', getDaysOverdueColor(debtor.daysOverdue))}
                            >
                              {debtor.daysOverdue}d
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {totalSelected > 0 && (
                    <div className="mt-4 p-4 rounded-lg bg-muted/50 flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium">{totalSelected}</span> devedor(es) selecionado(s)
                        <span className="mx-2">•</span>
                        Total: <span className="font-semibold text-destructive">
                          {formatCurrency(totalValueSelected)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DebtorsManagement;
