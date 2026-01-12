import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from './AuthContext';
import { toast } from 'sonner';
import { SubscriptionInfo, PlanKey, hasFeatureAccess } from '@/hooks/useSubscription';

interface SubscriptionContextType {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  createCheckout: (plan: PlanKey) => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  canCreateInstance: (currentInstanceCount: number) => boolean;
  canSearchLeads: () => boolean;
  getRemainingLeads: () => number;
  hasFeatureAccess: (feature: string) => boolean;
  isSubscribed: boolean;
  currentPlan: PlanKey;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user, session, loading: authLoading } = useAuthContext();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const checkInFlightRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkSubscription = useCallback(async () => {
    // Prevent concurrent checks
    if (checkInFlightRef.current) return;
    if (authLoading) return;

    checkInFlightRef.current = true;
    setLoading(true);

    try {
      // Use existing session - don't refresh manually (autoRefreshToken handles this)
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData?.session;

      if (!currentSession?.access_token) {
        setSubscription(null);
        setLoading(false);
        checkInFlightRef.current = false;
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });

      if (error) {
        const message = (error as any)?.message ?? '';
        const isAuthError = /auth|session|jwt|unauthorized|401/i.test(message);

        if (isAuthError) {
          // Don't auto-signOut - just log and set null subscription
          console.warn('Subscription check auth error, will retry on next interval');
          setSubscription(null);
        } else {
          console.error('Error checking subscription:', error);
          // Keep existing subscription on non-auth errors
        }
      } else {
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      // Keep existing subscription on error
    } finally {
      setLoading(false);
      checkInFlightRef.current = false;
    }
  }, [authLoading]);

  // Check subscription when user and session are ready
  useEffect(() => {
    if (authLoading) return;

    if (user && session?.access_token) {
      checkSubscription();
    } else if (!user) {
      setSubscription(null);
      setLoading(false);
    }
  }, [user, session?.access_token, authLoading, checkSubscription]);

  // Single interval for the entire app - refresh every 5 minutes
  useEffect(() => {
    if (!user) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      checkSubscription();
    }, 5 * 60 * 1000); // 5 minutes instead of 1 minute

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, checkSubscription]);

  const createCheckout = useCallback(async (plan: PlanKey) => {
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
  }, [session?.access_token]);

  const openCustomerPortal = useCallback(async () => {
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
  }, [session?.access_token]);

  const canCreateInstance = useCallback((currentInstanceCount: number): boolean => {
    if (!subscription?.subscribed) return false;
    
    const maxInstances = subscription.max_instances;
    if (maxInstances === null) return true;
    
    return currentInstanceCount < maxInstances;
  }, [subscription]);

  const canSearchLeads = useCallback((): boolean => {
    if (!subscription) return false;
    const maxLeads = subscription.max_leads || 0;
    const leadsUsed = subscription.leads_used || 0;
    return leadsUsed < maxLeads;
  }, [subscription]);

  const getRemainingLeads = useCallback((): number => {
    if (!subscription) return 0;
    const maxLeads = subscription.max_leads || 0;
    const leadsUsed = subscription.leads_used || 0;
    return Math.max(0, maxLeads - leadsUsed);
  }, [subscription]);

  const value: SubscriptionContextType = {
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

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptionContext = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  return context;
};
