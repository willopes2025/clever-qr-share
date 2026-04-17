import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialSessionResolved = false;
    let sessionEstablishedFromEvent = false;

    const hasPendingAuthParams = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      return searchParams.has('code') || hashParams.has('access_token') || hashParams.get('type') === 'recovery';
    };

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;

      if (nextSession?.access_token) {
        sessionEstablishedFromEvent = true;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const finishLoading = () => {
      if (mounted) {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        applySession(nextSession);

        if (initialSessionResolved) {
          finishLoading();
        }
      }
    );

    const resolveInitialSession = async () => {
      const shouldRetryForCallback = hasPendingAuthParams();
      const maxAttempts = shouldRetryForCallback ? 6 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data: { session: nextSession }, error } = await supabase.auth.getSession();

        if (error) {
          break;
        }

        if (nextSession?.access_token) {
          initialSessionResolved = true;
          applySession(nextSession);
          finishLoading();
          return;
        }

        if (sessionEstablishedFromEvent) {
          initialSessionResolved = true;
          finishLoading();
          return;
        }

        if (!shouldRetryForCallback || attempt === maxAttempts - 1) {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      initialSessionResolved = true;

      if (!sessionEstablishedFromEvent) {
        applySession(null);
      }

      finishLoading();
    };

    resolveInitialSession().catch(() => {
      initialSessionResolved = true;
      finishLoading();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setLoading(false);
      return { error };
    }

    // Apply session immediately so the rest of the app doesn't have to wait
    // for the onAuthStateChange event (which can be racy).
    if (data?.session) {
      setSession(data.session);
      setUser(data.session.user);
    }
    setLoading(false);

    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
      }
    });
    return { error: error as Error | null };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
