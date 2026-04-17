import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
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
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // 1) Set up auth state listener FIRST. Keep it fully synchronous.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!mounted) return;
        console.log('[AuthContext] onAuthStateChange:', event, !!nextSession?.access_token);
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        // Once we've heard from the listener at least once, auth is ready
        setAuthReady(true);
        setLoading(false);
      }
    );

    // 2) THEN check existing session
    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (!mounted) return;
      console.log('[AuthContext] getSession resolved, hasSession=', !!nextSession?.access_token);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthReady(true);
      setLoading(false);
    }).catch((err) => {
      console.warn('[AuthContext] getSession failed:', err);
      if (!mounted) return;
      setAuthReady(true);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return { error };
    }

    // Apply session immediately so dependent code doesn't have to wait
    // for the onAuthStateChange event.
    if (data?.session) {
      setSession(data.session);
      setUser(data.session.user);
      setAuthReady(true);
      setLoading(false);
    }

    return { error: null };
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
    <AuthContext.Provider value={{ user, session, loading, authReady, signIn, signUp, signOut, signInWithGoogle }}>
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
