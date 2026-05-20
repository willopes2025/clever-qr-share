/**
 * Compatibility shim — the activity tracking logic now lives inside
 * `ActivitySessionProvider` (see `src/hooks/useActivitySession.tsx`),
 * which is mounted once per app shell. Keeping this component as a no-op
 * preserves existing imports without creating duplicated listeners/intervals.
 */
export const ActivityTracker = () => null;
