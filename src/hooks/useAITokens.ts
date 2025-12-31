import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AITokenPackage {
  id: string;
  name: string;
  tokens: number;
  price_brl: number;
  stripe_price_id: string;
  stripe_product_id: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface AITokenBalance {
  balance: number;
  totalPurchased: number;
  totalConsumed: number;
}

export interface AITokenTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
  package_id: string | null;
}

export const useAITokens = () => {
  const { user } = useAuth();
  const [packages, setPackages] = useState<AITokenPackage[]>([]);
  const [balance, setBalance] = useState<AITokenBalance | null>(null);
  const [transactions, setTransactions] = useState<AITokenTransaction[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // Buscar pacotes disponíveis
  const fetchPackages = useCallback(async () => {
    try {
      setLoadingPackages(true);
      const { data, error } = await supabase
        .from('ai_token_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  }, []);

  // Buscar saldo do usuário
  const fetchBalance = useCallback(async () => {
    if (!user) {
      setBalance(null);
      setLoadingBalance(false);
      return;
    }

    try {
      setLoadingBalance(true);
      const { data, error } = await supabase
        .from('user_ai_tokens')
        .select('balance, total_purchased, total_consumed')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setBalance({
          balance: data.balance || 0,
          totalPurchased: data.total_purchased || 0,
          totalConsumed: data.total_consumed || 0,
        });
      } else {
        setBalance({
          balance: 0,
          totalPurchased: 0,
          totalConsumed: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance({
        balance: 0,
        totalPurchased: 0,
        totalConsumed: 0,
      });
    } finally {
      setLoadingBalance(false);
    }
  }, [user]);

  // Buscar histórico de transações
  const fetchTransactions = useCallback(async (limit = 20) => {
    if (!user) {
      setTransactions([]);
      setLoadingTransactions(false);
      return;
    }

    try {
      setLoadingTransactions(true);
      const { data, error } = await supabase
        .from('ai_token_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  }, [user]);

  // Comprar pacote de tokens
  const purchasePackage = useCallback(async (packageId: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para comprar tokens');
      return null;
    }

    try {
      setPurchasing(true);
      const { data, error } = await supabase.functions.invoke('purchase-ai-tokens', {
        body: { packageId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        return data.url;
      }

      throw new Error('URL de checkout não retornada');
    } catch (error) {
      console.error('Error purchasing tokens:', error);
      toast.error('Erro ao iniciar compra de tokens');
      return null;
    } finally {
      setPurchasing(false);
    }
  }, [user]);

  // Verificar se tem saldo suficiente
  const hasSufficientBalance = useCallback((requiredTokens: number): boolean => {
    return (balance?.balance || 0) >= requiredTokens;
  }, [balance]);

  // Formatar quantidade de tokens
  const formatTokens = useCallback((tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(tokens % 1000000 === 0 ? 0 : 1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(tokens % 1000 === 0 ? 0 : 1)}K`;
    }
    return tokens.toLocaleString('pt-BR');
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, [fetchBalance, fetchTransactions]);

  return {
    packages,
    balance,
    transactions,
    loadingPackages,
    loadingBalance,
    loadingTransactions,
    purchasing,
    fetchPackages,
    fetchBalance,
    fetchTransactions,
    purchasePackage,
    hasSufficientBalance,
    formatTokens,
  };
};
