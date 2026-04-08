import { format, isSameDay as dateFnsIsSameDay } from "date-fns";

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
 * Format a date string (YYYY-MM-DD) to dd/MM/yyyy without timezone issues
 */
export function formatDateOnly(dateString: string): string {
  const date = parseDateOnly(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
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
  return /\bdata\b|date|vencimento|nascimento|pagamento|data_de_entrada|data_da_entrada|saída|saida|prazo|consulta|evento|agendamento/i.test(fieldName);
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
    // YYYY-MM-DD or ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      const datePart = val.split('T')[0];
      const [y, m, d] = datePart.split('-').map(Number);
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
  // Already formatted
  if (typeof val === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(val)) return val;
  const parsed = parseAnyDateValue(val);
  if (!parsed) return null;
  const day = parsed.getDate().toString().padStart(2, '0');
  const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
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
