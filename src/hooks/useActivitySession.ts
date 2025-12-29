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

export const useActivitySession = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [currentSession, setCurrentSession] = useState<ActivitySession | null>(null);
  const [loading, setLoading] = useState(true);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());

  // Fetch current active session
  const fetchCurrentSession = useCallback(async () => {
    if (!user) return;

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
        setCurrentSession({
          ...data,
          session_type: data.session_type as SessionType
        });
      }
    } catch (err) {
      console.error('Error fetching current session:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Start a new session
  const startSession = useCallback(async (sessionType: SessionType = 'work') => {
    if (!user) return null;

    try {
      // End any existing session first
      if (currentSession) {
        await endSession();
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
      setCurrentSession(session);
      return session;
    } catch (err) {
      console.error('Error starting session:', err);
      return null;
    }
  }, [user, organization, currentSession]);

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
      setCurrentSession(null);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  }, [user, currentSession]);

  // Switch session type
  const switchSession = useCallback(async (newType: SessionType) => {
    await endSession();
    return startSession(newType);
  }, [endSession, startSession]);

  // Track user activity (called on user interactions)
  const trackActivity = useCallback(() => {
    lastActivityRef.current = new Date();

    // Auto-start work session if none exists
    if (!currentSession && user) {
      startSession('work');
    }
  }, [currentSession, user, startSession]);

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
    startSession,
    endSession,
    switchSession,
    trackActivity,
    isWorking: currentSession?.session_type === 'work',
    isOnBreak: currentSession?.session_type === 'break',
    isOnLunch: currentSession?.session_type === 'lunch',
  };
};
