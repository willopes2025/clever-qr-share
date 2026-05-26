// Shared timezone helpers for Edge Functions.
// The source of truth is `public.organizations.timezone` (IANA string).
// All scheduling/date+time interpretation MUST go through these helpers.

const DEFAULT_TZ = "America/Sao_Paulo";

type SupabaseLike = {
  from: (table: string) => any;
};

const cache = new Map<string, string>();

/** Resolve the organization timezone from one of several known references. */
export async function resolveOrgTimezone(
  supabase: SupabaseLike,
  ref: {
    organizationId?: string | null;
    userId?: string | null;
    dealId?: string | null;
    automationId?: string | null;
  },
): Promise<string> {
  try {
    let orgId = ref.organizationId ?? null;

    if (!orgId && ref.userId) {
      const cacheKey = `user:${ref.userId}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey)!;
      const { data } = await supabase
        .from("organizations")
        .select("id, timezone")
        .eq("owner_id", ref.userId)
        .maybeSingle();
      if (data?.timezone) {
        cache.set(cacheKey, data.timezone);
        return data.timezone;
      }
      // Fallback: team member -> organization
      const { data: tm } = await supabase
        .from("team_members")
        .select("organization_id")
        .eq("user_id", ref.userId)
        .eq("status", "active")
        .maybeSingle();
      if (tm?.organization_id) orgId = tm.organization_id;
    }

    if (!orgId && ref.dealId) {
      const { data: deal } = await supabase
        .from("funnel_deals")
        .select("user_id")
        .eq("id", ref.dealId)
        .maybeSingle();
      if (deal?.user_id) return resolveOrgTimezone(supabase, { userId: deal.user_id });
    }

    if (!orgId && ref.automationId) {
      const { data: a } = await supabase
        .from("funnel_automations")
        .select("user_id")
        .eq("id", ref.automationId)
        .maybeSingle();
      if (a?.user_id) return resolveOrgTimezone(supabase, { userId: a.user_id });
    }

    if (orgId) {
      const cacheKey = `org:${orgId}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey)!;
      const { data } = await supabase
        .from("organizations")
        .select("timezone")
        .eq("id", orgId)
        .maybeSingle();
      const tz = data?.timezone || DEFAULT_TZ;
      cache.set(cacheKey, tz);
      return tz;
    }
  } catch (err) {
    console.warn("[timezone] resolveOrgTimezone failed:", err);
  }
  return DEFAULT_TZ;
}

/** Returns `local = utc + offsetMin`. Handles DST automatically. */
export function getTzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>(
    (acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    },
    {},
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second || "0"),
  );
  return (asUTC - date.getTime()) / 60000;
}

/** Convert a `YYYY-MM-DD` + `HH:mm` (interpreted in `tz`) into a UTC Date. */
export function parseInTimezone(dateStr: string, timeStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offsetMin = getTzOffsetMinutes(guess, tz);
  return new Date(guess.getTime() - offsetMin * 60000);
}

/** Now broken down in the given timezone. */
export function nowInTimezone(tz: string, now: Date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = dtf.formatToParts(now).reduce<Record<string, string>>(
    (acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    },
    {},
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday] ?? 0,
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    timeHHmm: `${parts.hour.padStart(2, "0")}:${parts.minute.padStart(2, "0")}`,
  };
}

export const DEFAULT_TIMEZONE = DEFAULT_TZ;
