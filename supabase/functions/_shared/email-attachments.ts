// Shared helper to fetch email attachments from the `email-attachments` bucket
// and turn them into base64 payloads for MIME assembly.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export interface AttachmentMeta {
  path: string;           // storage path inside `email-attachments` bucket
  filename: string;
  content_type: string;
  size?: number;
}

export interface PreparedAttachment {
  filename: string;
  contentType: string;
  base64: string;         // raw base64 (no line breaks)
  size: number;
}

// Total combined attachment size limit (MB) — provider-safe default.
export const MAX_ATTACHMENT_TOTAL_MB = 20;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function loadAttachments(
  admin: SupabaseClient,
  metas: AttachmentMeta[] | null | undefined,
): Promise<PreparedAttachment[]> {
  if (!metas || metas.length === 0) return [];
  const out: PreparedAttachment[] = [];
  let total = 0;
  for (const a of metas) {
    if (!a?.path || !a?.filename) continue;
    const { data, error } = await admin.storage.from('email-attachments').download(a.path);
    if (error || !data) throw new Error(`falha ao baixar anexo ${a.filename}: ${error?.message ?? 'desconhecido'}`);
    const buf = new Uint8Array(await data.arrayBuffer());
    total += buf.byteLength;
    if (total > MAX_ATTACHMENT_TOTAL_MB * 1024 * 1024) {
      throw new Error(`Anexos ultrapassam ${MAX_ATTACHMENT_TOTAL_MB} MB (limite do provedor).`);
    }
    out.push({
      filename: a.filename,
      contentType: a.content_type || 'application/octet-stream',
      base64: bytesToBase64(buf),
      size: buf.byteLength,
    });
  }
  return out;
}

// Break a base64 string into 76-char lines for MIME compliance.
export function chunkBase64(b64: string, lineLen = 76): string {
  const parts: string[] = [];
  for (let i = 0; i < b64.length; i += lineLen) parts.push(b64.slice(i, i + lineLen));
  return parts.join('\r\n');
}
