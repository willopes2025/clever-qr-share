import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Coins, Zap, Star, Building2, Crown } from 'lucide-react';
import { AITokenPackage } from '@/hooks/useAITokens';

interface TokenPackagesGridProps {
  packages: AITokenPackage[];
  loading: boolean;
  purchasing: boolean;
  onPurchase: (packageId: string) => void;
  formatTokens: (tokens: number) => string;
}

const getPackageIcon = (name: string) => {
  switch (name.toLowerCase()) {
    case 'starter':
      return <Coins className="h-6 w-6" />;
    case 'básico':
      return <Zap className="h-6 w-6" />;
    case 'profissional':
      return <Star className="h-6 w-6" />;
    case 'agência':
      return <Building2 className="h-6 w-6" />;
    case 'enterprise':
      return <Crown className="h-6 w-6" />;
    default:
      return <Coins className="h-6 w-6" />;
  }
};

const getPackageColor = (name: string) => {
  switch (name.toLowerCase()) {
    case 'starter':
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
    case 'básico':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    case 'profissional':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
    case 'agência':
      return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
    case 'enterprise':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    default:
      return 'bg-primary/10 text-primary';
  }
};

const getBestValue = (packages: AITokenPackage[]) => {
  if (packages.length < 3) return null;
  // Geralmente o pacote do meio oferece melhor custo-benefício
  return packages[Math.floor(packages.length / 2)]?.id;
};

export const TokenPackagesGrid = ({
  packages,
  loading,
  purchasing,
  onPurchase,
  formatTokens,
}: TokenPackagesGridProps) => {
  const bestValueId = getBestValue(packages);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-5 w-24 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-16 mt-2" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {packages.map((pkg) => {
        const isBestValue = pkg.id === bestValueId;
        const pricePerMillion = (pkg.price_brl / pkg.tokens) * 1000000;

        return (
          <Card
            key={pkg.id}
            className={`relative flex flex-col ${
              isBestValue ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
          >
            {isBestValue && (
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                Melhor custo-benefício
              </Badge>
            )}
            <CardHeader className="pb-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getPackageColor(pkg.name)}`}>
                {getPackageIcon(pkg.name)}
              </div>
              <CardTitle className="text-lg">{pkg.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-1">
                <p className="text-3xl font-bold">
                  {formatTokens(pkg.tokens)}
                </p>
                <p className="text-sm text-muted-foreground">tokens</p>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-2xl font-semibold">
                  R$ {pkg.price_brl.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-xs text-muted-foreground">
                  R$ {pricePerMillion.toFixed(2).replace('.', ',')} / 1M tokens
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => onPurchase(pkg.id)}
                disabled={purchasing}
                variant={isBestValue ? 'default' : 'outline'}
              >
                {purchasing ? 'Processando...' : 'Comprar'}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
};
