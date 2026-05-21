import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';

type SessionType = 'work' | 'break' | 'lunch';

interface ActivitySession {
  id: string;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

const SESSION_STORAGE_KEY = 'activity_session_cache';
const END_SESSION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/end-session`;

const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10 min → ocioso
const AUTO_END_MS = 60 * 60 * 1000; // 60 min → encerrar sessão
const DB_PERSIST_INTERVAL_MS = 30 * 1000; // persistir last_activity a cada 30s

const getCachedSession = (): ActivitySession | null => {
  try {
    const cached = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error('Error reading cached session:', e);
  }
  return null;
};

const cacheSession = (session: ActivitySession | null) => {
  try {
    if (session) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    console.error('Error caching session:', e);
  }
};

interface ActivitySessionContextValue {
  currentSession: ActivitySession | null;
  loading: boolean;
  isInitialized: boolean;
  isIdle: boolean;
  startSession: (sessionType?: SessionType) => Promise<ActivitySession | null>;
  endSession: () => Promise<void>;
  switchSession: (newType: SessionType) => Promise<ActivitySession | null>;
  trackActivity: () => void;
  isWorking: boolean;
  isOnBreak: boolean;
  isOnLunch: boolean;
}

const ActivitySessionContext = createContext<ActivitySessionContextValue | null>(null);

export const ActivitySessionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [currentSession, setCurrentSession] = useState<ActivitySession | null>(() => getCachedSession());
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isIdle, setIsIdle] = useState(false);

  const lastActivityRef = useRef<Date>(new Date());
  const isIdleRef = useRef(false);
  const lastDbUpdateRef = useRef<number>(0);
  const startSessionCalledRef = useRef(false);
  const currentSessionRef = useRef<ActivitySession | null>(currentSession);

  const updateSession = useCallback((session: ActivitySession | null) => {
    currentSessionRef.current = session;
    setCurrentSession(session);
    cacheSession(session);
  }, []);

  // Fetch current open session from DB
  const fetchCurrentSession = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setIsInitialized(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_activity_sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        updateSession({ ...data, session_type: data.session_type as SessionType });
      } else {
        updateSession(null);
      }
    } catch (err) {
      console.error('Error fetching current session:', err);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [user?.id, updateSession]);

  const startSession = useCallback(
    async (sessionType: SessionType = 'work') => {
      if (!user) return null;
      if (startSessionCalledRef.current) return null;
      startSessionCalledRef.current = true;

      try {
        const existing = currentSessionRef.current;
        if (existing) {
          const endedAt = new Date();
          const startedAt = new Date(existing.started_at);
          const durationSeconds = Math.floor(
            (endedAt.getTime() - startedAt.getTime()) / 1000,
          );
          await supabase
            .from('user_activity_sessions')
            .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
            .eq('id', existing.id);
        }

        const { data, error } = await supabase
          .from('user_activity_sessions')
          .insert({
            user_id: user.id,
            organization_id: organization?.id || null,
            session_type: sessionType,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        const session = { ...data, session_type: data.session_type as SessionType };
        updateSession(session);
        lastActivityRef.current = new Date();
        isIdleRef.current = false;
        setIsIdle(false);
        return session;
      } catch (err) {
        console.error('Error starting session:', err);
        return null;
      } finally {
        startSessionCalledRef.current = false;
      }
    },
    [user, organization, updateSession],
  );

  const endSession = useCallback(async () => {
    const existing = currentSessionRef.current;
    if (!user || !existing) return;

    try {
      const endedAt = new Date();
      const startedAt = new Date(existing.started_at);
      const durationSeconds = Math.floor(
        (endedAt.getTime() - startedAt.getTime()) / 1000,
      );

      const { error } = await supabase
        .from('user_activity_sessions')
        .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
        .eq('id', existing.id);

      if (error) throw error;
      updateSession(null);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  }, [user, updateSession]);

  const switchSession = useCallback(
    async (newType: SessionType) => {
      await endSession();
      return startSession(newType);
    },
    [endSession, startSession],
  );

  // Track user activity — updates ref always, persists to DB throttled
  const trackActivity = useCallback(() => {
    const now = new Date();
    lastActivityRef.current = now;

    const session = currentSessionRef.current;

    // Imediatamente sair do estado ocioso
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      if (session) {
        lastDbUpdateRef.current = now.getTime();
        supabase
          .from('user_activity_sessions')
          .update({ last_activity: now.toISOString(), is_idle: false } as any)
          .eq('id', session.id)
          .is('ended_at', null)
          .select('id')
          .then(({ data, error }) => {
            if (error) {
              console.error('Error clearing idle:', error);
              return;
            }
            // Session was closed remotely — drop local cache so we re-fetch/start fresh.
            if (!data || data.length === 0) {
              updateSession(null);
            }
          });
        return;
      }
    }

    // Persiste no DB no máximo a cada 30s
    if (session && now.getTime() - lastDbUpdateRef.current > DB_PERSIST_INTERVAL_MS) {
      lastDbUpdateRef.current = now.getTime();
      supabase
        .from('user_activity_sessions')
        .update({ last_activity: now.toISOString() } as any)
        .eq('id', session.id)
        .is('ended_at', null)
        .select('id')
        .then(({ data, error }) => {
          if (error) {
            console.error('Error updating last_activity:', error);
            return;
          }
          if (!data || data.length === 0) {
            // Server already closed this session — clear stale local reference.
            updateSession(null);
          }
        });
    }
  }, [updateSession]);

  // Window event listeners (singleton — só uma instância no app)
  useEffect(() => {
    if (!user || !isInitialized) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'click'];

    let lastTracked = 0;
    const throttledHandler = () => {
      const now = Date.now();
      // Throttle leve (5s) — não precisa derrubar todo evento mas evita 60fps
      if (now - lastTracked < 5000) {
        // Mesmo dentro do throttle, se idle, libera
        if (isIdleRef.current) {
          lastTracked = now;
          trackActivity();
        }
        return;
      }
      lastTracked = now;
      trackActivity();
    };

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') trackActivity();
    };

    events.forEach((evt) => window.addEventListener(evt, throttledHandler, { passive: true }));
    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('focus', visibilityHandler);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, throttledHandler));
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('focus', visibilityHandler);
    };
  }, [user, isInitialized, trackActivity]);

  // Inactivity checker (singleton)
  useEffect(() => {
    if (!currentSession || currentSession.session_type !== 'work') {
      setIsIdle(false);
      isIdleRef.current = false;
      return;
    }

    const checkInactivity = () => {
      const now = new Date();
      const inactiveMs = now.getTime() - lastActivityRef.current.getTime();

      if (inactiveMs >= IDLE_THRESHOLD_MS && !isIdleRef.current) {
        isIdleRef.current = true;
        setIsIdle(true);
        supabase
          .from('user_activity_sessions')
          .update({ is_idle: true } as any)
          .eq('id', currentSession.id)
          .then(({ error }) => {
            if (error) console.error('Error marking idle:', error);
          });
      }

      if (inactiveMs >= AUTO_END_MS) {
        endSession();
      }
    };

    const interval = setInterval(checkInactivity, 30000);
    return () => clearInterval(interval);
  }, [currentSession, endSession]);

  // Auto-start work session on mount if none exists
  useEffect(() => {
    if (user && isInitialized && !currentSession && !startSessionCalledRef.current) {
      startSession('work');
    }
  }, [user, isInitialized, currentSession, startSession]);

  // Initial fetch
  useEffect(() => {
    fetchCurrentSession();
  }, [fetchCurrentSession]);

  // beforeunload — encerrar sessão via beacon
  useEffect(() => {
    const handleUnload = () => {
      const session = currentSessionRef.current;
      if (session) {
        const payload = JSON.stringify({ session_id: session.id });
        navigator.sendBeacon(END_SESSION_URL, payload);
        cacheSession(null);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // End session on sign-out
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && currentSessionRef.current) {
        fetch(END_SESSION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: currentSessionRef.current.id }),
          keepalive: true,
        }).catch(console.error);
        updateSession(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [updateSession]);

  const value: ActivitySessionContextValue = {
    currentSession,
    loading,
    isInitialized,
    isIdle,
    startSession,
    endSession,
    switchSession,
    trackActivity,
    isWorking: currentSession?.session_type === 'work',
    isOnBreak: currentSession?.session_type === 'break',
    isOnLunch: currentSession?.session_type === 'lunch',
  };

  return (
    <ActivitySessionContext.Provider value={value}>
      {children}
    </ActivitySessionContext.Provider>
  );
};

// Fallback no-op para evitar crash quando consumido fora do Provider (ex: em testes ou rotas públicas)
const NOOP_VALUE: ActivitySessionContextValue = {
  currentSession: null,
  loading: false,
  isInitialized: false,
  isIdle: false,
  startSession: async () => null,
  endSession: async () => {},
  switchSession: async () => null,
  trackActivity: () => {},
  isWorking: false,
  isOnBreak: false,
  isOnLunch: false,
};

export const useActivitySession = (): ActivitySessionContextValue => {
  const ctx = useContext(ActivitySessionContext);
  return ctx ?? NOOP_VALUE;
};
