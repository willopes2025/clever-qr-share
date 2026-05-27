import { format, isSameDay as dateFnsIsSameDay, isToday as dateFnsIsToday, isYesterday as dateFnsIsYesterday } from "date-fns";
import {
  getActiveTimezone,
  partsInTimezone,
  formatDate as formatDateActive,
  formatTime as formatTimeActive,
  formatDateTime as formatDateTimeActive,
} from "@/lib/timezone";

/**
 * Convert a UTC date to the active organization timezone.
 * Returns a new Date object adjusted to display wall-clock time when used with date-fns format().
 */
export function toBrazilTime(date: Date): Date {
  const tz = getActiveTimezone();
  const brString = date.toLocaleString('en-US', { timeZone: tz });
  return new Date(brString);
}

/**
 * Format a date string (ISO/UTC) to HH:mm (or hh:mm AM/PM) honoring the org's time format.
 */
export function formatTimeBR(dateString: string): string {
  return formatTimeActive(dateString);
}

/**
 * Check if a date string is today in Brazil timezone
 */
export function isTodayBR(dateString: string): boolean {
  const date = toBrazilTime(new Date(dateString));
  const now = toBrazilTime(new Date());
  return dateFnsIsToday(date) || (date.toDateString() === now.toDateString());
}

/**
 * Check if a date string is yesterday in Brazil timezone
 */
export function isYesterdayBR(dateString: string): boolean {
  const date = toBrazilTime(new Date(dateString));
  const now = toBrazilTime(new Date());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

/**
 * Smart format for message/conversation timestamps — honors org date/time formats.
 */
export function formatMessageTimeBR(dateString: string | null): string {
  if (!dateString) return "";
  if (isTodayBR(dateString)) {
    return formatTimeActive(dateString);
  }
  if (isYesterdayBR(dateString)) {
    return "Ontem";
  }
  // Short "day/month" using only the first two parts of the active date format.
  const full = formatDateActive(dateString);
  // DD/MM/YYYY -> DD/MM; MM/DD/YYYY -> MM/DD; YYYY-MM-DD -> MM-DD
  const parts = full.split(/[/\-]/);
  if (parts.length === 3) {
    const sep = full.includes('/') ? '/' : '-';
    // For YYYY-MM-DD show MM-DD; for the others show first two segments.
    if (full.match(/^\d{4}/)) return `${parts[1]}${sep}${parts[2]}`;
    return `${parts[0]}${sep}${parts[1]}`;
  }
  return full;
}

/**
 * Full format for message bubbles: "<date> às <time>" using org formats.
 */
export function formatFullDateTimeBR(dateString: string): string {
  return formatDateTimeActive(dateString, { separator: " às " });
}

/**
 * Format for message bubble time display in the active timezone/format.
 */
export function formatBubbleTimeBR(dateString: string): string {
  if (isTodayBR(dateString)) {
    return formatTimeActive(dateString);
  }
  if (isYesterdayBR(dateString)) {
    return `Ontem ${formatTimeActive(dateString)}`;
  }
  return `${formatMessageTimeBR(dateString)} ${formatTimeActive(dateString)}`;
}

/**
 * Get the date label for DateSeparator in active timezone (long Portuguese form).
 */
export function getDateLabelBR(dateString: string): string {
  if (isTodayBR(dateString)) return "Hoje";
  if (isYesterdayBR(dateString)) return "Ontem";

  const tz = getActiveTimezone();
  const p = partsInTimezone(new Date(dateString), tz);
  const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${String(p.day).padStart(2,'0')} de ${months[p.month - 1]} de ${p.year}`;
}

/**
 * Parse a date string (YYYY-MM-DD) without timezone issues
 * This ensures the date displays as the exact day stored, regardless of local timezone
 */
export function parseDateOnly(dateString: string): Date {
  // Handle both "YYYY-MM-DD" and full ISO strings
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a date string (YYYY-MM-DD) honoring the org's active date format.
 */
export function formatDateOnly(dateString: string): string {
  return formatDateActive(dateString);
}

/**
 * Check if a date string (YYYY-MM-DD) is the same day as a Date object
 * This avoids timezone issues when comparing dates from the database
 */
export function isSameDateString(dateString: string | null, day: Date): boolean {
  if (!dateString) return false;
  const taskDate = parseDateOnly(dateString);
  return dateFnsIsSameDay(taskDate, day);
}

/**
 * Check if a field name suggests it's a date field (used for auto-detection)
 */
export function isDateLikeFieldName(fieldName: string): boolean {
  // Só considera "data-like" quando o nome explicita uma data/prazo.
  // Termos como "evento", "consulta", "agendamento" sozinhos podem se referir
  // a outros atributos (ex.: "Local do Evento") e NÃO devem virar campo de data.
  return /\bdata\b|\bdate\b|vencimento|nascimento|prazo|\bdt[_\s-]/i.test(fieldName);
}

/**
 * Parse any date-like value (Excel serial, ISO string, dd/MM/yyyy, etc.)
 * Returns a Date object or undefined if parsing fails
 */
export function parseAnyDateValue(val: any): Date | undefined {
  if (val === null || val === undefined || val === '') return undefined;

  // Excel serial number
  if (typeof val === 'number' || (typeof val === 'string' && /^\d{4,5}(\.\d+)?$/.test(val.trim()))) {
    const serial = typeof val === 'number' ? val : parseFloat(val);
    if (serial > 25000 && serial < 100000) {
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + serial * 86400000);
    }
  }

  if (typeof val === 'string') {
    // Already dd/MM/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const [d, m, y] = val.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    // ISO with time part — preserve time (interpret naive timestamps as local)
    const isoWithTime = val.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
    if (isoWithTime) {
      const [, y, mo, d, h, mi, s, , tz] = isoWithTime;
      if (tz) {
        const parsed = new Date(val);
        if (!isNaN(parsed.getTime())) return parsed;
      }
      return new Date(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
    }
    // Date-only YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    // Fallback
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return undefined;
}

/**
 * Format any date-like value to dd/MM/yyyy (Brazilian format)
 * Handles Excel serial numbers, ISO strings, and already-formatted strings.
 * Returns null if the value can't be parsed as a date.
 */
export function formatDateValue(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  // Already formatted as dd/MM/yyyy
  if (typeof val === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    const [d, m, y] = val.split('/');
    return formatDateActive(`${y}-${m}-${d}`);
  }
  const parsed = parseAnyDateValue(val);
  if (!parsed) return null;
  return formatDateActive(parsed);
}

/**
 * Smart format: auto-detect if a value is a date based on field name/type and format accordingly
 */
export function formatCustomFieldValue(val: any, fieldName?: string, fieldType?: string): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  
  // Explicit date type
  if (fieldType === 'date' || fieldType === 'datetime') {
    return formatDateValue(val) || String(val);
  }
  
  // Auto-detect by field name
  if (fieldName && isDateLikeFieldName(fieldName)) {
    const formatted = formatDateValue(val);
    if (formatted) return formatted;
  }
  
  // Auto-detect ISO date strings even without field name hint
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(val)) {
    const formatted = formatDateValue(val);
    if (formatted) return formatted;
  }
  
  return String(val);
}
