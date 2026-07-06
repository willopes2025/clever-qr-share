import { ptBR } from "date-fns/locale";
import { format as dfFormat, formatDistanceToNow as dfFormatDistanceToNow } from "date-fns";

/**
 * Shared pt-BR locale for date-fns.
 *
 * Import from here instead of importing `date-fns/locale` directly so every
 * screen renders dates in Portuguese and we can swap the app locale in one place.
 */
export const appLocale = ptBR;

/** date-fns `format` pre-bound to the app locale. */
export function formatBR(date: Date | number, pattern: string): string {
  return dfFormat(date, pattern, { locale: appLocale });
}

/** date-fns `formatDistanceToNow` pre-bound to the app locale + `addSuffix`. */
export function formatDistanceToNowBR(
  date: Date | number,
  options?: { addSuffix?: boolean },
): string {
  return dfFormatDistanceToNow(date, { addSuffix: true, ...options, locale: appLocale });
}
