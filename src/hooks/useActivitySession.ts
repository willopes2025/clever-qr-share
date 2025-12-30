import { useState, useEffect, useCallback, useRef } from 'react';
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

// Helper to get cached session from sessionStorage
const getCachedSession = (): ActivitySession | null => {
  try {
    const cached = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Error reading cached session:', e);
  }
  return null;
};

// Helper to cache session in sessionStorage
const cacheSession = (session: ActivitySession | null) => {
  try {
    if (session) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error caching session:', e);
  }
};

export const useActivitySession = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  
  // Initialize with cached session for instant display
  const [currentSession, setCurrentSession] = useState<ActivitySession | null>(() => getCachedSession());
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const startSessionCalledRef = useRef(false);

  // Update state and cache together
  const updateSession = useCallback((session: ActivitySession | null) => {
    setCurrentSession(session);
    cacheSession(session);
  }, []);

  // Fetch current active session
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
        const session = {
          ...data,
          session_type: data.session_type as SessionType
        };
        updateSession(session);
      } else {
        // No active session found, clear cache
        updateSession(null);
      }
    } catch (err) {
      console.error('Error fetching current session:', err);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [user, updateSession]);

  // Start a new session
  const startSession = useCallback(async (sessionType: SessionType = 'work') => {
    if (!user) return null;

    // Prevent duplicate calls
    if (startSessionCalledRef.current) return null;
    startSessionCalledRef.current = true;

    try {
      // End any existing session first
      if (currentSession) {
        const endedAt = new Date();
        const startedAt = new Date(currentSession.started_at);
        const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

        await supabase
          .from('user_activity_sessions')
          .update({
            ended_at: endedAt.toISOString(),
            duration_seconds: durationSeconds,
          })
          .eq('id', currentSession.id);
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
      const session = {
        ...data,
        session_type: data.session_type as SessionType
      };
      updateSession(session);
      return session;
    } catch (err) {
      console.error('Error starting session:', err);
      return null;
    } finally {
      startSessionCalledRef.current = false;
    }
  }, [user, organization, currentSession, updateSession]);

  // End current session
  const endSession = useCallback(async () => {
    if (!user || !currentSession) return;

    try {
      const endedAt = new Date();
      const startedAt = new Date(currentSession.started_at);
      const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

      const { error } = await supabase
        .from('user_activity_sessions')
        .update({
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', currentSession.id);

      if (error) throw error;
      updateSession(null);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  }, [user, currentSession, updateSession]);

  // Switch session type
  const switchSession = useCallback(async (newType: SessionType) => {
    await endSession();
    return startSession(newType);
  }, [endSession, startSession]);

  // Track user activity (called on user interactions)
  const trackActivity = useCallback(() => {
    lastActivityRef.current = new Date();
  }, []);

  // Auto-end session after inactivity
  useEffect(() => {
    if (!currentSession || currentSession.session_type !== 'work') return;

    const checkInactivity = () => {
      const now = new Date();
      const inactiveMinutes = (now.getTime() - lastActivityRef.current.getTime()) / 1000 / 60;

      // Auto-end after 30 minutes of inactivity
      if (inactiveMinutes >= 30) {
        endSession();
      }
    };

    activityTimeoutRef.current = setInterval(checkInactivity, 60000); // Check every minute

    return () => {
      if (activityTimeoutRef.current) {
        clearInterval(activityTimeoutRef.current);
      }
    };
  }, [currentSession, endSession]);

  // Fetch session on mount
  useEffect(() => {
    fetchCurrentSession();
  }, [fetchCurrentSession]);

  // End session on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (currentSession) {
        // Use sendBeacon for reliable delivery
        const endedAt = new Date().toISOString();
        const startedAt = new Date(currentSession.started_at);
        const durationSeconds = Math.floor((new Date().getTime() - startedAt.getTime()) / 1000);

        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_activity_sessions?id=eq.${currentSession.id}`,
          JSON.stringify({ ended_at: endedAt, duration_seconds: durationSeconds })
        );
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [currentSession]);

  return {
    currentSession,
    loading,
    isInitialized,
    startSession,
    endSession,
    switchSession,
    trackActivity,
    isWorking: currentSession?.session_type === 'work',
    isOnBreak: currentSession?.session_type === 'break',
    isOnLunch: currentSession?.session_type === 'lunch',
  };
};
