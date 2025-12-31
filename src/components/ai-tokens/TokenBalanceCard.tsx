import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, TrendingUp, TrendingDown, RefreshCw, ShoppingCart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TokenBalanceCardProps {
  balance: number;
  totalPurchased: number;
  totalConsumed: number;
  loading: boolean;
  onRefresh: () => void;
  onBuyTokens: () => void;
  formatTokens: (tokens: number) => string;
}

export const TokenBalanceCard = ({
  balance,
  totalPurchased,
  totalConsumed,
  loading,
  onRefresh,
  onBuyTokens,
  formatTokens,
}: TokenBalanceCardProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Saldo de Tokens AI
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-primary">
              {formatTokens(balance)}
            </p>
            <p className="text-sm text-muted-foreground">tokens disponíveis</p>
          </div>
          <Button onClick={onBuyTokens} className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Comprar Tokens
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-500/10">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatTokens(totalPurchased)}</p>
              <p className="text-xs text-muted-foreground">Total comprado</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10">
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatTokens(totalConsumed)}</p>
              <p className="text-xs text-muted-foreground">Total consumido</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
