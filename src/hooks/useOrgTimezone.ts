import { useEffect } from "react";
import { useOrganization } from "./useOrganization";
import {
  setActiveTimezone,
  setActiveDateFormat,
  setActiveTimeFormat,
  getActiveTimezone,
  DEFAULT_TIMEZONE,
} from "@/lib/timezone";

/**
 * Reads the active organization's timezone + date/time format and keeps the
 * global cache (`src/lib/timezone.ts`) in sync so non-React utilities can read
 * them synchronously.
 */
export function useOrgTimezone(): string {
  const { organization } = useOrganization();
  const tz = organization?.timezone || DEFAULT_TIMEZONE;
  const dateFmt = (organization as any)?.date_format;
  const timeFmt = (organization as any)?.time_format;

  useEffect(() => {
    setActiveTimezone(tz);
  }, [tz]);

  useEffect(() => {
    setActiveDateFormat(dateFmt);
  }, [dateFmt]);

  useEffect(() => {
    setActiveTimeFormat(timeFmt);
  }, [timeFmt]);

  return tz;
}

export { getActiveTimezone };
