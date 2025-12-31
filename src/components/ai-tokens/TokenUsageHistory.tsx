import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUpCircle, ArrowDownCircle, Gift, RotateCcw, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AITokenTransaction } from '@/hooks/useAITokens';

interface TokenUsageHistoryProps {
  transactions: AITokenTransaction[];
  loading: boolean;
  formatTokens: (tokens: number) => string;
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'purchase':
      return <ArrowUpCircle className="h-4 w-4 text-green-500" />;
    case 'consumption':
      return <ArrowDownCircle className="h-4 w-4 text-orange-500" />;
    case 'bonus':
      return <Gift className="h-4 w-4 text-purple-500" />;
    case 'refund':
      return <RotateCcw className="h-4 w-4 text-blue-500" />;
    default:
      return <History className="h-4 w-4 text-muted-foreground" />;
  }
};

const getTransactionBadge = (type: string) => {
  switch (type) {
    case 'purchase':
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Compra</Badge>;
    case 'consumption':
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">Consumo</Badge>;
    case 'bonus':
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Bônus</Badge>;
    case 'refund':
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Reembolso</Badge>;
    default:
      return <Badge variant="outline">Outro</Badge>;
  }
};

export const TokenUsageHistory = ({
  transactions,
  loading,
  formatTokens,
}: TokenUsageHistoryProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Histórico de Transações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma transação encontrada</p>
            <p className="text-sm">Suas transações de tokens aparecerão aqui</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="p-2 rounded-full bg-background">
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {transaction.description || 'Transação de tokens'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(transaction.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {transaction.amount >= 0 ? '+' : ''}{formatTokens(Math.abs(transaction.amount))}
                    </p>
                    {getTransactionBadge(transaction.type)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
