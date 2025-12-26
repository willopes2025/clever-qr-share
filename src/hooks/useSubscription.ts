import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SubscriptionInfo {
  subscribed: boolean;
  plan: string;
  max_instances: number | null;
  max_contacts: number | null;
  max_messages: number | null;
  subscription_end: string | null;
  is_organization_member?: boolean;
  organization_id?: string;
}

// Plan configuration with Stripe IDs
export const PLANS = {
  free: {
    name: 'Grátis',
    price: 0,
    priceId: null,
    productId: null,
    maxInstances: 1,
    maxMessages: 300,
    maxContacts: 1000,
    features: [
      '1 Instância WhatsApp',
      '300 mensagens/mês',
      '1.000 contatos',
      'Templates básicos',
      'Campanhas simples',
    ],
  },
  starter: {
    name: 'Starter',
    price: 67,
    priceId: 'price_1SfqabIuIJFtamjKBREt4KzH',
    productId: 'prod_Td6oCDIlCW9tXp',
    maxInstances: 1,
    maxMessages: null,
    maxContacts: null,
    features: [
      '1 Instância WhatsApp',
      'Contatos ilimitados',
      'Mensagens ilimitadas',
      'Templates com variações',
      'Campanhas agendadas',
      'Suporte por email',
    ],
  },
  pro: {
    name: 'Pro',
    price: 147,
    priceId: 'price_1SfqaoIuIJFtamjKUw2Z0zdd',
    productId: 'prod_Td6oDKN8AXJsXf',
    maxInstances: 10,
    maxMessages: null,
    maxContacts: null,
    features: [
      'Até 10 Instâncias WhatsApp',
      'Contatos ilimitados',
      'Mensagens ilimitadas',
      'Templates com IA',
      'Campanhas avançadas',
      'Relatórios detalhados',
      'Suporte prioritário',
    ],
  },
  business: {
    name: 'Business',
    price: 297,
    priceId: 'price_1SfqazIuIJFtamjKBQLRF2AL',
    productId: 'prod_Td6otV5Ef9IHSt',
    maxInstances: null,
    maxMessages: null,
    maxContacts: null,
    features: [
      'Instâncias ilimitadas',
      'Contatos ilimitados',
      'Mensagens ilimitadas',
      'Tudo do Pro',
      'API completa',
      'Webhooks personalizados',
      'Gerente de conta dedicado',
      'SLA garantido',
    ],
  },
};

export const useSubscription = () => {
  const { user, session, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    // Wait for auth to finish loading before making requests
    if (authLoading) {
      return;
    }

    if (!session?.access_token) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, authLoading]);

  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) {
      return;
    }

    if (user && session?.access_token) {
      checkSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user, session?.access_token, authLoading, checkSubscription]);

  // Auto-refresh subscription every minute
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      checkSubscription();
    }, 60000);

    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const createCheckout = async (plan: 'starter' | 'pro' | 'business') => {
    if (!session?.access_token) {
      toast.error('Você precisa estar logado para assinar');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Erro ao criar checkout. Tente novamente.');
    }
  };

  const openCustomerPortal = async () => {
    if (!session?.access_token) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Erro ao abrir portal. Tente novamente.');
    }
  };

  const canCreateInstance = (currentInstanceCount: number): boolean => {
    if (!subscription?.subscribed) return false;
    
    const maxInstances = subscription.max_instances;
    if (maxInstances === null) return true; // unlimited
    
    return currentInstanceCount < maxInstances;
  };

  return {
    subscription,
    loading,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    canCreateInstance,
    isSubscribed: subscription?.subscribed || false,
    currentPlan: subscription?.plan || 'free',
  };
};
