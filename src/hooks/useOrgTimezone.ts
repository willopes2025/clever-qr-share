import { useEffect } from "react";
import { useOrganization } from "./useOrganization";
import { setActiveTimezone, getActiveTimezone, DEFAULT_TIMEZONE } from "@/lib/timezone";

/**
 * Reads the active organization's timezone and keeps the global cache
 * (`src/lib/timezone.ts`) in sync so non-React utilities can read it
 * synchronously.
 */
export function useOrgTimezone(): string {
  const { organization } = useOrganization();
  const tz = organization?.timezone || DEFAULT_TIMEZONE;

  useEffect(() => {
    setActiveTimezone(tz);
  }, [tz]);

  return tz;
}

export { getActiveTimezone };
