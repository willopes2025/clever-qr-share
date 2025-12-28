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
  max_leads: number | null;
  leads_used: number | null;
  leads_reset_at: string | null;
  subscription_end: string | null;
  is_organization_member?: boolean;
  organization_id?: string;
  trial_ends_at?: string | null;
}

export type PlanKey = 'free' | 'essencial' | 'profissional' | 'agencia' | 'avancado';

export interface PlanConfig {
  name: string;
  price: number;
  priceId: string | null;
  productId: string | null;
  maxInstances: number | null;
  maxMessages: number | null;
  maxContacts: number | null;
  maxLeads: number;
  features: string[];
  featureKeys: string[];
}

// New plan configuration with Stripe IDs
export const PLANS: Record<PlanKey, PlanConfig> = {
  free: {
    name: 'Free Trial',
    price: 0,
    priceId: null,
    productId: null,
    maxInstances: 1,
    maxMessages: 300,
    maxContacts: 500,
    maxLeads: 50,
    features: [
      '1 Instância WhatsApp',
      '300 mensagens/mês',
      '500 contatos',
      '50 leads/mês',
      'Inbox / Chat',
      'Templates básicos',
      'Campanhas simples',
    ],
    featureKeys: ['inbox', 'templates', 'campaigns_basic', 'contacts'],
  },
  essencial: {
    name: 'Essencial',
    price: 147,
    priceId: 'price_1SijenIuIJFtamjKuzbqG8xt',
    productId: 'prod_Tg5qEVTAzaY2d1',
    maxInstances: 3,
    maxMessages: 10000,
    maxContacts: 10000,
    maxLeads: 1000,
    features: [
      '3 Instâncias WhatsApp',
      '10.000 mensagens/mês',
      '10.000 contatos',
      '1.000 leads/mês',
      'Aquecimento de Chip',
      'Listas de Transmissão',
      'Funis de Vendas (CRM)',
      'Templates com variações',
    ],
    featureKeys: ['inbox', 'templates', 'campaigns', 'contacts', 'broadcast', 'funnels', 'warming'],
  },
  profissional: {
    name: 'Profissional',
    price: 297,
    priceId: 'price_1SijezIuIJFtamjK45VHVMhV',
    productId: 'prod_Tg5qspfPups3iN',
    maxInstances: 10,
    maxMessages: null, // ilimitadas
    maxContacts: 50000,
    maxLeads: 5000,
    features: [
      '10 Instâncias WhatsApp',
      'Mensagens ilimitadas',
      '50.000 contatos',
      '5.000 leads/mês',
      'Tudo do Essencial',
      'Analysis (IA)',
      'Automações',
      'Agente IA',
      'API & Webhooks',
    ],
    featureKeys: ['inbox', 'templates', 'campaigns', 'contacts', 'broadcast', 'funnels', 'warming', 'analysis', 'automations', 'ai_agent', 'api', 'webhooks'],
  },
  agencia: {
    name: 'Agência',
    price: 597,
    priceId: 'price_1SijfBIuIJFtamjKkRlLwfkh',
    productId: 'prod_Tg5qcEw3OK7hU3',
    maxInstances: 30,
    maxMessages: null,
    maxContacts: null, // ilimitados
    maxLeads: 25000,
    features: [
      '30 Instâncias WhatsApp',
      'Mensagens ilimitadas',
      'Contatos ilimitados',
      '25.000 leads/mês',
      'Tudo do Profissional',
      'Multi-equipe',
      'Suporte Prioritário',
    ],
    featureKeys: ['all', 'multi_team', 'priority_support'],
  },
  avancado: {
    name: 'Avançado',
    price: 797,
    priceId: 'price_1SijfUIuIJFtamjKrRwGYD7o',
    productId: 'prod_Tg5rhArqyzOqTt',
    maxInstances: 50,
    maxMessages: null,
    maxContacts: null,
    maxLeads: 100000,
    features: [
      '50 Instâncias WhatsApp',
      'Mensagens ilimitadas',
      'Contatos ilimitados',
      '100.000 leads/mês',
      'Todas as features',
      'Suporte VIP',
    ],
    featureKeys: ['all'],
  },
};

// Feature access by plan
export const FEATURE_ACCESS: Record<string, PlanKey[]> = {
  inbox: ['free', 'essencial', 'profissional', 'agencia', 'avancado'],
  templates: ['free', 'essencial', 'profissional', 'agencia', 'avancado'],
  campaigns: ['free', 'essencial', 'profissional', 'agencia', 'avancado'],
  contacts: ['free', 'essencial', 'profissional', 'agencia', 'avancado'],
  broadcast: ['essencial', 'profissional', 'agencia', 'avancado'],
  funnels: ['essencial', 'profissional', 'agencia', 'avancado'],
  warming: ['essencial', 'profissional', 'agencia', 'avancado'],
  analysis: ['profissional', 'agencia', 'avancado'],
  automations: ['profissional', 'agencia', 'avancado'],
  ai_agent: ['profissional', 'agencia', 'avancado'],
  api: ['profissional', 'agencia', 'avancado'],
  webhooks: ['profissional', 'agencia', 'avancado'],
  multi_team: ['agencia', 'avancado'],
  priority_support: ['agencia', 'avancado'],
  lead_search: ['essencial', 'profissional', 'agencia', 'avancado'],
};

export function hasFeatureAccess(plan: string, feature: string): boolean {
  const allowedPlans = FEATURE_ACCESS[feature];
  if (!allowedPlans) return true; // Feature not restricted
  return allowedPlans.includes(plan as PlanKey);
}

export const useSubscription = () => {
  const { user, session, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  const checkSubscription = useCallback(async () => {
    // Wait for auth to finish loading before making requests
    if (authLoading) return;
    
    // Prevent multiple simultaneous calls
    if (isChecking) return;
    setIsChecking(true);

    setLoading(true);

    try {
      // Always use the freshest session (avoids stale tokens)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('Session error, signing out:', sessionError.message);
        await supabase.auth.signOut();
        setSubscription(null);
        setLoading(false);
        return;
      }

      const currentSession = sessionData?.session;

      if (!currentSession?.access_token) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      const invokeCheck = async (accessToken: string) =>
        supabase.functions.invoke('check-subscription', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

      let { data, error } = await invokeCheck(currentSession.access_token);

      if (error) {
        const message = (error as any)?.message ?? '';
        const isAuthError = /auth|session|jwt|unauthorized|missing/i.test(message);

        if (isAuthError) {
          console.warn('Auth error detected, attempting refresh...', message);
          
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          const refreshedSession = refreshData?.session;

          if (!refreshError && refreshedSession?.access_token) {
            console.log('Session refreshed successfully');
            ({ data, error } = await invokeCheck(refreshedSession.access_token));
          } else {
            // Session is invalid server-side, force re-login
            console.warn('Session refresh failed, signing out');
            await supabase.auth.signOut();
            setSubscription(null);
            setLoading(false);
            return;
          }
        }

        if (error) throw error;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
      setIsChecking(false);
    }
  }, [authLoading, isChecking]);

  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) {
      return;
    }

    if (user) {
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

  const createCheckout = async (plan: PlanKey) => {
    if (!session?.access_token) {
      toast.error('Você precisa estar logado para assinar');
      return;
    }

    if (plan === 'free') {
      toast.error('O plano gratuito não requer checkout');
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

  const canSearchLeads = (): boolean => {
    if (!subscription) return false;
    const maxLeads = subscription.max_leads || 0;
    const leadsUsed = subscription.leads_used || 0;
    return leadsUsed < maxLeads;
  };

  const getRemainingLeads = (): number => {
    if (!subscription) return 0;
    const maxLeads = subscription.max_leads || 0;
    const leadsUsed = subscription.leads_used || 0;
    return Math.max(0, maxLeads - leadsUsed);
  };

  return {
    subscription,
    loading,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    canCreateInstance,
    canSearchLeads,
    getRemainingLeads,
    hasFeatureAccess: (feature: string) => hasFeatureAccess(subscription?.plan || 'free', feature),
    isSubscribed: subscription?.subscribed || false,
    currentPlan: (subscription?.plan || 'free') as PlanKey,
  };
};
