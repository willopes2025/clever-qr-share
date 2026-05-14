import { useEffect, useRef } from 'react';
import { useActivitySession } from '@/hooks/useActivitySession';
import { useAuth } from '@/hooks/useAuth';

/**
 * Invisible component that tracks user activity.
 * Add this to DashboardLayout to automatically track work sessions.
 */
export const ActivityTracker = () => {
  const { user } = useAuth();
  const { trackActivity, startSession, currentSession, isInitialized } = useActivitySession();
  const startingRef = useRef(false);

  // Track various user interactions
  useEffect(() => {
    if (!user || !isInitialized) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    // Throttle to avoid too many updates
    let lastTracked = 0;
    const throttledHandler = async () => {
      const now = Date.now();
      if (now - lastTracked < 30000) return; // Max once per 30s
      lastTracked = now;

      // If there's no open session (e.g. it was auto-ended after inactivity),
      // start a fresh work session as soon as the user interacts again.
      if (!currentSession && !startingRef.current) {
        startingRef.current = true;
        try {
          await startSession('work');
        } finally {
          startingRef.current = false;
        }
        return;
      }

      trackActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, throttledHandler, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledHandler);
      });
    };
  }, [user, isInitialized, currentSession, trackActivity, startSession]);

  // Auto-start work session on initial mount when no session exists
  useEffect(() => {
    if (user && isInitialized && !currentSession && !startingRef.current) {
      startingRef.current = true;
      startSession('work').finally(() => {
        startingRef.current = false;
      });
    }
  }, [user, isInitialized, currentSession, startSession]);

  return null; // Invisible component
};
