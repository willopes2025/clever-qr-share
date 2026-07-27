// Resolve o access_token correto por número Meta (phone_number_id).
// Números de WABAs diferentes exigem tokens diferentes; guardamos um token
// por número em `meta_number_tokens` (tabela service_role only).

// deno-lint-ignore no-explicit-any
type Client = any;

export async function getMetaTokenForNumber(
  supabase: Client,
  phoneNumberId: string | null | undefined,
  fallbackToken?: string | null,
): Promise<string | null> {
  if (phoneNumberId) {
    const { data, error } = await supabase
      .from('meta_number_tokens')
      .select('access_token')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle();

    if (error) {
      console.error('[META-TOKEN] lookup error:', error.message);
    } else if (data?.access_token) {
      return data.access_token as string;
    }
  }
  return fallbackToken ?? null;
}

export async function saveMetaTokenForNumbers(
  supabase: Client,
  userId: string,
  phoneNumberIds: string[],
  accessToken: string,
  wabaId?: string | null,
): Promise<void> {
  if (!phoneNumberIds.length || !accessToken) return;
  const rows = phoneNumberIds.map((id) => ({
    phone_number_id: id,
    user_id: userId,
    waba_id: wabaId ?? null,
    access_token: accessToken,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('meta_number_tokens')
    .upsert(rows, { onConflict: 'phone_number_id' });
  if (error) console.error('[META-TOKEN] save error:', error.message);
}
