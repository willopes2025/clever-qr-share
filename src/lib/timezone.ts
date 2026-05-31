// Frontend timezone + date/time format helpers.
// Single source of truth: `public.organizations` (`timezone`, `date_format`, `time_format`).
// Small module-level cache lets non-React code read the active values synchronously
// after `setActiveTimezone` / `setActiveDateFormat` / `setActiveTimeFormat` are called once
// on app boot (via <TimezoneBootstrap/>).

const DEFAULT_TZ = "America/Sao_Paulo";
const DEFAULT_DATE_FORMAT: DateFormat = "DD/MM/YYYY";
const DEFAULT_TIME_FORMAT: TimeFormat = "24h";

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type TimeFormat = "24h" | "12h";

let activeTimezone: string = DEFAULT_TZ;
let activeDateFormat: DateFormat = DEFAULT_DATE_FORMAT;
let activeTimeFormat: TimeFormat = DEFAULT_TIME_FORMAT;

export function setActiveTimezone(tz: string | null | undefined) {
  if (tz && typeof tz === "string") activeTimezone = tz;
}
export function getActiveTimezone(): string {
  return activeTimezone;
}

export function setActiveDateFormat(fmt: string | null | undefined) {
  if (fmt === "DD/MM/YYYY" || fmt === "MM/DD/YYYY" || fmt === "YYYY-MM-DD") {
    activeDateFormat = fmt;
  }
}
export function getActiveDateFormat(): DateFormat {
  return activeDateFormat;
}

export function setActiveTimeFormat(fmt: string | null | undefined) {
  if (fmt === "24h" || fmt === "12h") activeTimeFormat = fmt;
}
export function getActiveTimeFormat(): TimeFormat {
  return activeTimeFormat;
}

export function getTzOffsetMinutes(date: Date, tz: string = activeTimezone): number {
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

/** Convert a Date (any) to the wall-clock parts in the active timezone. */
export function partsInTimezone(date: Date, tz: string = activeTimezone) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second || "0"),
  };
}

/** Convert wall-clock fields in `tz` into a real UTC Date. */
export function fromTimezoneToUtc(
  args: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  tz: string = activeTimezone,
): Date {
  const { year, month, day, hour = 0, minute = 0, second = 0 } = args;
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMin = getTzOffsetMinutes(guess, tz);
  return new Date(guess.getTime() - offsetMin * 60000);
}

/** Convert a `<input type="datetime-local">` value (interpreted in the active tz) to ISO UTC. */
export function localInputToUtcIso(value: string, tz: string = activeTimezone): string {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm, ss = 0] = timePart.split(":").map(Number);
  return fromTimezoneToUtc({ year: y, month: m, day: d, hour: hh, minute: mm, second: Number(ss) }, tz)
    .toISOString();
}

/** Build a `<input type="datetime-local">` value from a UTC Date, expressed in the active tz. */
export function utcToLocalInput(date: Date | string | null | undefined, tz: string = activeTimezone): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const p = partsInTimezone(d, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// ----------------------------------------------------------------------------
// Formatting helpers (display only) — respect org timezone + date/time format.
// ----------------------------------------------------------------------------

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// ISO datetime SEM fuso (naive). Interpretado como horário local da organização.
const NAIVE_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

type AnyDateInput = Date | string | number | null | undefined;

function toDate(value: AnyDateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s) return null;
  // Date-only strings (YYYY-MM-DD) should be interpreted as local-to-active-tz wall date,
  // not as UTC midnight (which shifts the day backwards for BR).
  const m = s.match(DATE_ONLY_RE);
  if (m) {
    return fromTimezoneToUtc(
      { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) },
      activeTimezone,
    );
  }
  // Naive datetimes (without tz) are also interpreted as local-to-active-tz wall time.
  const naive = s.match(NAIVE_DATETIME_RE);
  if (naive) {
    return fromTimezoneToUtc(
      {
        year: Number(naive[1]),
        month: Number(naive[2]),
        day: Number(naive[3]),
        hour: Number(naive[4]),
        minute: Number(naive[5]),
        second: Number(naive[6] || 0),
      },
      activeTimezone,
    );
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateParts(d: Date, tz = activeTimezone, fmt = activeDateFormat): string {
  const p = partsInTimezone(d, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(p.day);
  const mm = pad(p.month);
  const yyyy = String(p.year);
  switch (fmt) {
    case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
    case "DD/MM/YYYY":
    default: return `${dd}/${mm}/${yyyy}`;
  }
}

function formatTimeParts(d: Date, tz = activeTimezone, fmt = activeTimeFormat): string {
  const p = partsInTimezone(d, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (fmt === "12h") {
    const hh24 = p.hour;
    const period = hh24 >= 12 ? "PM" : "AM";
    const hh12 = ((hh24 + 11) % 12) + 1;
    return `${pad(hh12)}:${pad(p.minute)} ${period}`;
  }
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Format a date value as date-only string in the active org format/timezone. */
export function formatDate(value: AnyDateInput, opts?: { timezone?: string; format?: DateFormat }): string {
  const d = toDate(value);
  if (!d) return "";
  return formatDateParts(d, opts?.timezone || activeTimezone, opts?.format || activeDateFormat);
}

/** Format a date value as time-only string (HH:mm or hh:mm AM/PM) in the active org format/timezone. */
export function formatTime(value: AnyDateInput, opts?: { timezone?: string; format?: TimeFormat }): string {
  const d = toDate(value);
  if (!d) return "";
  return formatTimeParts(d, opts?.timezone || activeTimezone, opts?.format || activeTimeFormat);
}

/** Format a date value as date + time using the active org config. */
export function formatDateTime(
  value: AnyDateInput,
  opts?: { timezone?: string; dateFormat?: DateFormat; timeFormat?: TimeFormat; separator?: string },
): string {
  const d = toDate(value);
  if (!d) return "";
  const tz = opts?.timezone || activeTimezone;
  const datePart = formatDateParts(d, tz, opts?.dateFormat || activeDateFormat);
  const timePart = formatTimeParts(d, tz, opts?.timeFormat || activeTimeFormat);
  return `${datePart}${opts?.separator ?? " "}${timePart}`;
}

/** Smart formatting: pure `YYYY-MM-DD` strings return date only; everything else returns date + time. */
export function formatDateSmart(value: AnyDateInput): string {
  if (typeof value === "string" && DATE_ONLY_RE.test(value.trim())) return formatDate(value);
  return formatDateTime(value);
}

/** Returns a sample formatted "now" string for previewing the active config. */
export function previewDateTimeNow(opts?: { dateFormat?: DateFormat; timeFormat?: TimeFormat }): string {
  return formatDateTime(new Date(), opts);
}

export const DEFAULT_TIMEZONE = DEFAULT_TZ;
export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string; example: string }[] = [
  { value: "DD/MM/YYYY", label: "Dia/Mês/Ano (Brasileiro)", example: "27/05/2026" },
  { value: "MM/DD/YYYY", label: "Mês/Dia/Ano (US)", example: "05/27/2026" },
  { value: "YYYY-MM-DD", label: "Ano-Mês-Dia (ISO)", example: "2026-05-27" },
];
export const TIME_FORMAT_OPTIONS: { value: TimeFormat; label: string; example: string }[] = [
  { value: "24h", label: "24 horas", example: "14:30" },
  { value: "12h", label: "12 horas (AM/PM)", example: "02:30 PM" },
];
