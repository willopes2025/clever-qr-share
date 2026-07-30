// Shared helpers to make sure documents sent to WhatsApp always carry a real
// filename (with extension) and a correct mimetype — otherwise WhatsApp shows a
// generic file the recipient cannot open.

const DOC_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  rtf: 'application/rtf',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  json: 'application/json',
  xml: 'application/xml',
};

export function fileNameFromUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const raw = url.split('?')[0].split('#')[0];
    const last = raw.split('/').pop() || '';
    return decodeURIComponent(last).trim();
  } catch {
    return '';
  }
}

export function extensionFromMime(mime?: string | null): string | null {
  if (!mime) return null;
  const clean = mime.split(';')[0].trim().toLowerCase();
  const found = Object.entries(DOC_MIME).find(([, v]) => v === clean);
  return found ? found[0] : null;
}

/**
 * Resolve a safe document filename with a guaranteed extension.
 */
export function resolveDocName(opts: {
  fileName?: string | null;
  caption?: string | null;
  url?: string | null;
  mimeType?: string | null;
  fallbackExt?: string;
}): string {
  const fromUrl = fileNameFromUrl(opts.url);
  let name =
    (opts.fileName && String(opts.fileName).trim()) ||
    (opts.caption && String(opts.caption).trim()) ||
    fromUrl ||
    'documento';

  name = name.replace(/[\r\n"\\/]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!name) name = 'documento';

  if (!/\.[A-Za-z0-9]{2,5}$/.test(name)) {
    const ext =
      (fromUrl.includes('.') ? fromUrl.split('.').pop() : null) ||
      extensionFromMime(opts.mimeType) ||
      opts.fallbackExt ||
      'pdf';
    name = `${name}.${String(ext).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }

  return name;
}

/**
 * Resolve the mimetype for a document filename (a stored mime_type wins).
 */
export function resolveDocMime(name: string, mimeType?: string | null): string {
  const stored = mimeType?.split(';')[0].trim();
  if (stored && stored !== 'application/octet-stream' && stored.includes('/')) return stored;
  const ext = (name.split('.').pop() || '').toLowerCase();
  return DOC_MIME[ext] || 'application/octet-stream';
}
