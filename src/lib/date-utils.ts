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
