import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useAdmin = () => {
  const { user, session, loading: authLoading, authReady, isAuthenticatedStable } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    let cancelled = false;
    retryCountRef.current = 0;

    const checkAdmin = async () => {
        if (!authReady || authLoading || !isAuthenticatedStable) return;

      if (!user || !session?.access_token) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      while (retryCountRef.current < maxRetries && !cancelled) {
        try {
          const { data, error } = await supabase
            .rpc('has_role', {
              _user_id: user.id,
              _role: 'admin'
            });

          if (cancelled) return;

          if (error) {
            console.warn(`[useAdmin] Attempt ${retryCountRef.current + 1} failed:`, error.message);
            retryCountRef.current++;
            if (retryCountRef.current < maxRetries) {
              await new Promise(r => setTimeout(r, 1000 * retryCountRef.current));
              continue;
            }
            setIsAdmin(false);
          } else {
            setIsAdmin(data === true);
          }
          break;
        } catch (err) {
          console.error(`[useAdmin] Attempt ${retryCountRef.current + 1} error:`, err);
          retryCountRef.current++;
          if (retryCountRef.current < maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * retryCountRef.current));
            continue;
          }
          setIsAdmin(false);
          break;
        }
      }

      if (!cancelled) setLoading(false);
    };

    checkAdmin();

    return () => { cancelled = true; };
  }, [user, session?.access_token, authLoading, authReady, isAuthenticatedStable]);

  return { isAdmin, loading };
};
