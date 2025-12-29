import { useEffect } from 'react';
import { useActivitySession } from '@/hooks/useActivitySession';
import { useAuth } from '@/hooks/useAuth';

/**
 * Invisible component that tracks user activity.
 * Add this to DashboardLayout to automatically track work sessions.
 */
export const ActivityTracker = () => {
  const { user } = useAuth();
  const { trackActivity, startSession, currentSession } = useActivitySession();

  // Track various user interactions
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      trackActivity();
    };

    // Throttle to avoid too many updates
    let lastTracked = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastTracked > 60000) { // Max once per minute
        lastTracked = now;
        handleActivity();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, throttledHandler, { passive: true });
    });

    // Auto-start work session on mount if user is logged in
    if (!currentSession) {
      startSession('work');
    }

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledHandler);
      });
    };
  }, [user, trackActivity, startSession, currentSession]);

  return null; // Invisible component
};
