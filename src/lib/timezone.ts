// Frontend timezone helpers. The single source of truth is
// `organizations.timezone`, set in Settings → Profile by the owner.
// A small module-level cache lets non-React code (utilities) read it
// synchronously after `setActiveTimezone` has been called once on app boot.

const DEFAULT_TZ = "America/Sao_Paulo";
let activeTimezone: string = DEFAULT_TZ;

export function setActiveTimezone(tz: string | null | undefined) {
  if (tz && typeof tz === "string") activeTimezone = tz;
}

export function getActiveTimezone(): string {
  return activeTimezone;
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
  // value: "YYYY-MM-DDTHH:mm" (sometimes with :ss)
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

export const DEFAULT_TIMEZONE = DEFAULT_TZ;
