// Shared phone utilities for edge functions.
// Brazilian phone normalization: ensure number is "55" + DDD + subscriber digits.

export function normalizePhone(p: string | null | undefined): string {
  if (!p) return '';
  let cleaned = String(p).replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12 && cleaned.length <= 13) {
    return cleaned;
  }
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return '55' + cleaned;
  }
  return cleaned;
}

export function isValidPhone(p: string | null | undefined): boolean {
  if (!p) return false;
  const cleaned = String(p).replace(/\D/g, '');
  return cleaned.length >= 8 && cleaned.length <= 15 && /^\d+$/.test(cleaned);
}

export function extractPhoneFromJid(jid: string | null | undefined): string {
  if (!jid) return '';
  return String(jid)
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .replace('@lid', '');
}
