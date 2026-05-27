// Shared timezone + date/time format helpers for Edge Functions.
// Source of truth: `public.organizations` (`timezone`, `date_format`, `time_format`).

const DEFAULT_TZ = "America/Sao_Paulo";
const DEFAULT_DATE_FORMAT: DateFormat = "DD/MM/YYYY";
const DEFAULT_TIME_FORMAT: TimeFormat = "24h";

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type TimeFormat = "24h" | "12h";

export interface OrgFormatConfig {
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

type SupabaseLike = { from: (table: string) => any };

// Cache keyed by user/org id. Stores both timezone string (legacy) and full config.
const tzCache = new Map<string, string>();
const cfgCache = new Map<string, OrgFormatConfig>();

function coerceDateFormat(v: unknown): DateFormat {
  return v === "MM/DD/YYYY" || v === "YYYY-MM-DD" ? v : "DD/MM/YYYY";
}
function coerceTimeFormat(v: unknown): TimeFormat {
  return v === "12h" ? "12h" : "24h";
}

async function fetchOrgConfigByOrgId(supabase: SupabaseLike, orgId: string): Promise<OrgFormatConfig> {
  const key = `org:${orgId}`;
  if (cfgCache.has(key)) return cfgCache.get(key)!;
  const { data } = await supabase
    .from("organizations")
    .select("timezone, date_format, time_format")
    .eq("id", orgId)
    .maybeSingle();
  const cfg: OrgFormatConfig = {
    timezone: data?.timezone || DEFAULT_TZ,
    dateFormat: coerceDateFormat(data?.date_format),
    timeFormat: coerceTimeFormat(data?.time_format),
  };
  cfgCache.set(key, cfg);
  tzCache.set(key, cfg.timezone);
  return cfg;
}

/** Resolve the organization timezone (legacy API). */
export async function resolveOrgTimezone(
  supabase: SupabaseLike,
  ref: {
    organizationId?: string | null;
    userId?: string | null;
    dealId?: string | null;
    automationId?: string | null;
  },
): Promise<string> {
  const cfg = await resolveOrgFormatConfig(supabase, ref);
  return cfg.timezone;
}

/** Resolve the full org format config (timezone + date_format + time_format). */
export async function resolveOrgFormatConfig(
  supabase: SupabaseLike,
  ref: {
    organizationId?: string | null;
    userId?: string | null;
    dealId?: string | null;
    automationId?: string | null;
  },
): Promise<OrgFormatConfig> {
  try {
    let orgId = ref.organizationId ?? null;

    if (!orgId && ref.userId) {
      const cacheKey = `user:${ref.userId}`;
      if (cfgCache.has(cacheKey)) return cfgCache.get(cacheKey)!;
      const { data: owned } = await supabase
        .from("organizations")
        .select("id, timezone, date_format, time_format")
        .eq("owner_id", ref.userId)
        .maybeSingle();
      if (owned?.id) {
        const cfg: OrgFormatConfig = {
          timezone: owned.timezone || DEFAULT_TZ,
          dateFormat: coerceDateFormat(owned.date_format),
          timeFormat: coerceTimeFormat(owned.time_format),
        };
        cfgCache.set(cacheKey, cfg);
        cfgCache.set(`org:${owned.id}`, cfg);
        return cfg;
      }
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
      if (deal?.user_id) return resolveOrgFormatConfig(supabase, { userId: deal.user_id });
    }

    if (!orgId && ref.automationId) {
      const { data: a } = await supabase
        .from("funnel_automations")
        .select("user_id")
        .eq("id", ref.automationId)
        .maybeSingle();
      if (a?.user_id) return resolveOrgFormatConfig(supabase, { userId: a.user_id });
    }

    if (orgId) return fetchOrgConfigByOrgId(supabase, orgId);
  } catch (err) {
    console.warn("[timezone] resolveOrgFormatConfig failed:", err);
  }
  return { timezone: DEFAULT_TZ, dateFormat: DEFAULT_DATE_FORMAT, timeFormat: DEFAULT_TIME_FORMAT };
}

/** Returns `local = utc + offsetMin`. Handles DST automatically. */
export function getTzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
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

/** Convert `YYYY-MM-DD` + `HH:mm` (interpreted in `tz`) into a UTC Date. */
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
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const parts = dtf.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
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

// ----------------------------------------------------------------------------
// Formatting helpers — same shape as the frontend in src/lib/timezone.ts
// ----------------------------------------------------------------------------

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
type AnyDateInput = Date | string | number | null | undefined;

function toDate(value: AnyDateInput, tz: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(DATE_ONLY_RE);
  if (m) {
    return parseInTimezone(s, "00:00", tz);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function partsIn(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = dtf.formatToParts(date).reduce<Record<string, string>>((acc, x) => {
    if (x.type !== "literal") acc[x.type] = x.value;
    return acc;
  }, {});
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
  };
}

export function formatDate(value: AnyDateInput, cfg: OrgFormatConfig): string {
  const d = toDate(value, cfg.timezone);
  if (!d) return "";
  const p = partsIn(d, cfg.timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(p.day), mm = pad(p.month), yyyy = String(p.year);
  switch (cfg.dateFormat) {
    case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
    default: return `${dd}/${mm}/${yyyy}`;
  }
}

export function formatTime(value: AnyDateInput, cfg: OrgFormatConfig): string {
  const d = toDate(value, cfg.timezone);
  if (!d) return "";
  const p = partsIn(d, cfg.timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (cfg.timeFormat === "12h") {
    const period = p.hour >= 12 ? "PM" : "AM";
    const hh12 = ((p.hour + 11) % 12) + 1;
    return `${pad(hh12)}:${pad(p.minute)} ${period}`;
  }
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatDateTime(value: AnyDateInput, cfg: OrgFormatConfig, separator = " "): string {
  const dp = formatDate(value, cfg);
  if (!dp) return "";
  return `${dp}${separator}${formatTime(value, cfg)}`;
}

/** Smart: date-only string → date only; everything else → date + time. */
export function formatDateSmart(value: AnyDateInput, cfg: OrgFormatConfig): string {
  if (typeof value === "string" && DATE_ONLY_RE.test(value.trim())) return formatDate(value, cfg);
  return formatDateTime(value, cfg);
}

export const DEFAULT_TIMEZONE = DEFAULT_TZ;
export const DEFAULT_FORMAT_CONFIG: OrgFormatConfig = {
  timezone: DEFAULT_TZ,
  dateFormat: DEFAULT_DATE_FORMAT,
  timeFormat: DEFAULT_TIME_FORMAT,
};
