import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAITokens } from '@/hooks/useAITokens';
import { TokenBalanceCard } from './TokenBalanceCard';
import { TokenPackagesGrid } from './TokenPackagesGrid';
import { TokenUsageHistory } from './TokenUsageHistory';

export const AITokensSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    packages,
    balance,
    transactions,
    loadingPackages,
    loadingBalance,
    loadingTransactions,
    purchasing,
    fetchBalance,
    fetchTransactions,
    purchasePackage,
    formatTokens,
  } = useAITokens();

  // Handle purchase success/cancel from URL params
  useEffect(() => {
    const purchase = searchParams.get('purchase');
    const tokensParam = searchParams.get('tokens');

    if (purchase === 'success') {
      toast.success(
        tokensParam 
          ? `Compra de ${Number(tokensParam).toLocaleString('pt-BR')} tokens realizada com sucesso!`
          : 'Compra de tokens realizada com sucesso!'
      );
      // Refresh balance
      fetchBalance();
      fetchTransactions();
      // Remove params from URL
      searchParams.delete('purchase');
      searchParams.delete('tokens');
      setSearchParams(searchParams, { replace: true });
    } else if (purchase === 'cancelled') {
      toast.info('Compra de tokens cancelada');
      searchParams.delete('purchase');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, fetchBalance, fetchTransactions]);

  const handleBuyTokens = () => {
    const packagesSection = document.getElementById('token-packages');
    if (packagesSection) {
      packagesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRefresh = () => {
    fetchBalance();
    fetchTransactions();
  };

  return (
    <div className="space-y-8">
      {/* Balance Card */}
      <TokenBalanceCard
        balance={balance?.balance || 0}
        totalPurchased={balance?.totalPurchased || 0}
        totalConsumed={balance?.totalConsumed || 0}
        loading={loadingBalance}
        onRefresh={handleRefresh}
        onBuyTokens={handleBuyTokens}
        formatTokens={formatTokens}
      />

      {/* Packages Grid */}
      <div id="token-packages">
        <h2 className="text-xl font-semibold mb-4">Pacotes de Tokens</h2>
        <TokenPackagesGrid
          packages={packages}
          loading={loadingPackages}
          purchasing={purchasing}
          onPurchase={purchasePackage}
          formatTokens={formatTokens}
        />
      </div>

      {/* Usage History */}
      <TokenUsageHistory
        transactions={transactions}
        loading={loadingTransactions}
        formatTokens={formatTokens}
      />
    </div>
  );
};
