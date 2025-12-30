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
  const hasAutoStarted = useRef(false);

  // Track various user interactions
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    // Throttle to avoid too many updates
    let lastTracked = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastTracked > 60000) { // Max once per minute
        lastTracked = now;
        trackActivity();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, throttledHandler, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledHandler);
      });
    };
  }, [user, trackActivity]);

  // Auto-start work session only once after initialization
  useEffect(() => {
    // Only auto-start if:
    // 1. We have a user
    // 2. The hook has finished initializing (fetched from DB)
    // 3. There's no current session
    // 4. We haven't already tried to auto-start
    if (user && isInitialized && !currentSession && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      startSession('work');
    }
  }, [user, isInitialized, currentSession, startSession]);

  // Reset the flag when user changes
  useEffect(() => {
    hasAutoStarted.current = false;
  }, [user?.id]);

  return null; // Invisible component
};
