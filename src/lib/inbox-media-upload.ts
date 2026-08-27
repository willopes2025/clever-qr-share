import { supabase } from "@/integrations/supabase/client";

export type InboxMediaType = 'image' | 'document' | 'video';

/**
 * Uploads a file to the public `inbox-media` bucket and returns its public URL.
 * Storage keys only accept a safe subset of characters, so the extension is
 * derived from the filename with a MIME-type fallback.
 */
export async function uploadInboxMedia(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const rawExt = file.name.includes('.') ? file.name.split('.').pop() ?? '' : '';
  const mimeExt = (file.type.split('/')[1] || '').split(';')[0];
  const safeExt = (rawExt || mimeExt)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8) || 'bin';

  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  const { error } = await supabase.storage
    .from('inbox-media')
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('inbox-media')
    .getPublicUrl(path);

  return publicUrl;
}
