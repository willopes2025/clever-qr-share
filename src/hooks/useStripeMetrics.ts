import { useState, useEffect, useCallback } from 'react';
import { invokeAdminFunction } from '@/lib/supabase-functions';

interface StripeSubscription {
  id: string;
  customer_email: string;
  customer_name: string | null;
  product_name: string;
  price: number;
  status: string;
  current_period_end: string;
  created: string;
}

interface StripeInvoice {
  id: string;
  customer_email: string;
  amount_paid: number;
  status: string;
  created: string;
  invoice_pdf: string | null;
}

interface MRRHistoryItem {
  month: string;
  value: number;
}

export interface StripeMetrics {
  mrr: number;
  arr: number;
  totalRevenue: number;
  activeSubscriptions: number;
  totalSubscriptions: number;
  totalCustomers: number;
  balance: {
    available: number;
    pending: number;
  };
  subscriptions: StripeSubscription[];
  invoices: StripeInvoice[];
  mrrHistory: MRRHistoryItem[];
}

export const useStripeMetrics = () => {
  const [metrics, setMetrics] = useState<StripeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fnError } = await invokeAdminFunction<StripeMetrics>('admin-stripe-metrics');

      if (fnError) {
        throw fnError;
      }

      setMetrics(data);
    } catch (err) {
      console.error('Error fetching Stripe metrics:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar métricas do Stripe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
};
