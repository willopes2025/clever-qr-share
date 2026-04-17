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
  const { user, session, loading: authLoading, authReady, isAuthenticatedStable } = useAuthContext();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const checkInFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const retryCountRef = useRef(0);

  const checkSubscription = useCallback(async (isInitial = false) => {
    // Prevent concurrent checks
    if (checkInFlightRef.current) return;
    if (authLoading || !authReady || !isAuthenticatedStable) return;

    checkInFlightRef.current = true;
    // Only show loading spinner on initial check, not on re-checks
    if (!hasLoadedRef.current) {
      setLoading(true);
    }

    try {
      // Get current session
      let { data: sessionData } = await supabase.auth.getSession();
      let currentSession = sessionData?.session;

      // If no session or token looks expired, try to refresh
      if (!currentSession?.access_token) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData?.session) {
          setSubscription(null);
          setLoading(false);
          checkInFlightRef.current = false;
          return;
        }
        currentSession = refreshData.session;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });

      if (error) {
        const message = (error as any)?.message ?? '';
        const status = (error as any)?.status ?? (error as any)?.context?.status;

        // Check if it's a network/timeout error (NOT an auth error)
        const isNetworkError = /timeout|network|fetch|500|502|503|504|ECONNREFUSED|context canceled/i.test(message);

        if (isNetworkError) {
          console.warn('[SubscriptionContext] Network/timeout error, keeping current state:', message);
          // If we have no subscription data yet, schedule a retry with backoff
          if (!hasLoadedRef.current && retryCountRef.current < 5) {
            retryCountRef.current++;
            const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30000);
            console.log(`[SubscriptionContext] Scheduling retry #${retryCountRef.current} in ${delay}ms`);
            checkInFlightRef.current = false;
            setTimeout(() => checkSubscription(true), delay);
          }
          return;
        }

        const isAuthError = status === 401;

        if (isAuthError) {
          // Try refreshing the session once - but DO NOT force logout if refresh fails for any reason
          // other than an explicit invalid_grant / refresh_token_not_found.
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            const refreshMsg = refreshError.message ?? '';
            const isInvalidGrant = /invalid_grant|refresh_token_not_found|refresh_token_already_used/i.test(refreshMsg);

            if (isInvalidGrant) {
              console.warn('[SubscriptionContext] Refresh token invalid, signing out:', refreshMsg);
              await supabase.auth.signOut();
              setSubscription(null);
              return;
            }

            // Any other refresh failure (network, 500, etc.) — keep user logged in.
            console.warn('[SubscriptionContext] Refresh failed but not invalid_grant, keeping session:', refreshMsg);
            return;
          }

          if (refreshData?.session) {
            // Retry with refreshed token
            const { data: retryData, error: retryError } = await supabase.functions.invoke('check-subscription', {
              headers: {
                Authorization: `Bearer ${refreshData.session.access_token}`,
              },
            });
            if (!retryError) {
              setSubscription(retryData);
              hasLoadedRef.current = true;
              return;
            }
            console.warn('[SubscriptionContext] Retry after refresh failed, keeping session:', (retryError as any)?.message);
            return;
          }

          // No refresh data and no error: keep session, do not force logout.
          console.warn('[SubscriptionContext] Refresh returned no session, keeping current auth state.');
        } else {
          console.warn('[SubscriptionContext] Non-auth error checking subscription, keeping session:', message, status);
        }
      } else {
        setSubscription(data);
        hasLoadedRef.current = true;
        retryCountRef.current = 0;
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
      checkInFlightRef.current = false;
    }
  }, [authLoading, authReady, isAuthenticatedStable]);

  // Check subscription only when auth is fully ready and we have a real session
  useEffect(() => {
    if (!authReady || authLoading) return;

    if (isAuthenticatedStable && user && session?.access_token) {
      console.log('[SubscriptionContext] Auth ready, scheduling checkSubscription');
      checkSubscription(!subscription);
    } else if (!user) {
      setSubscription(null);
      setLoading(false);
      hasLoadedRef.current = false;
    }
  }, [user, session?.access_token, authLoading, authReady, isAuthenticatedStable, checkSubscription]);

  // Single interval for the entire app - refresh every 5 minutes
  useEffect(() => {
    if (!user || !isAuthenticatedStable) {
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
  }, [user, isAuthenticatedStable, checkSubscription]);

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
