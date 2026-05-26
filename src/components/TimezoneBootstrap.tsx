import { useOrgTimezone } from "@/hooks/useOrgTimezone";

/** Side-effect-only component: syncs the active org timezone into the global cache. */
export const TimezoneBootstrap = () => {
  useOrgTimezone();
  return null;
};
