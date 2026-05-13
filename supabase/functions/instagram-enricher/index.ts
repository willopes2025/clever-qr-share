import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'instagram120.p.rapidapi.com';

function extractEmail(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

function extractPhone(text: string | null, url: string | null): string | null {
  if (url) {
    const wa = url.match(/wa\.me\/(\d+)/i);
    if (wa) return wa[1];
    const api = url.match(/api\.whatsapp\.com\/send\?phone=(\d+)/i);
    if (api) return api[1];
  }
  if (!text) return null;
  const patterns = [
    /\+55\s*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/,
    /\(?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const d = m[0].replace(/\D/g, '');
      if (d.length >= 10 && d.length <= 13) return d;
    }
  }
  return null;
}

function extractSocialLinks(text: string | null, url: string | null): Record<string, string> {
  const links: Record<string, string> = {};
  const combined = [text || '', url || ''].join(' ');
  const patterns: Record<string, RegExp> = {
    twitter: /(?:twitter\.com|x\.com)\/(@?[\w]+)/i,
    tiktok: /tiktok\.com\/@?([\w.]+)/i,
    youtube: /youtube\.com\/(?:channel\/|c\/|@)([\w-]+)/i,
    telegram: /t\.me\/([\w]+)/i,
    linkedin: /linkedin\.com\/(?:in|company)\/([\w-]+)/i,
    facebook: /facebook\.com\/([\w.]+)/i,
    threads: /threads\.net\/@?([\w.]+)/i,
  };
  for (const [k, p] of Object.entries(patterns)) {
    const m = combined.match(p);
    if (m && m[1]) links[k] = m[1];
  }
  return links;
}

function detectSuspicious(p: {
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isPrivate?: boolean;
  biography?: string | null;
  profilePicUrl?: string | null;
}): { isSuspicious: boolean; reasons: string[] } {
  const r: string[] = [];
  if (p.followingCount > 0 && p.followersCount > 0 && p.followingCount / p.followersCount > 10)
    r.push('Ratio seguindo/seguidores muito alto (>10x)');
  if (p.followersCount > 1000 && p.postsCount < 5) r.push('Muitos seguidores mas poucos posts');
  if (p.postsCount === 0) r.push('Nenhuma publicação');
  if (p.isPrivate && !p.biography) r.push('Conta privada sem bio');
  if (p.followersCount > 5000 && !p.profilePicUrl) r.push('Muitos seguidores sem foto de perfil');
  if (p.followingCount === 0 && p.followersCount > 100) r.push('Não segue ninguém');
  return { isSuspicious: r.length >= 2, reasons: r };
}

async function fetchProfile(username: string, apiKey: string): Promise<any | null> {
  const url = `https://${RAPIDAPI_HOST}/api/instagram/profile?username=${encodeURIComponent(username)}`;
  const resp = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
  });
  if (!resp.ok) {
    console.error(`Profile ${username} failed [${resp.status}]:`, await resp.text());
    return null;
  }
  const json = await resp.json();
  // Normalize: profile may be at root, .data, .user, .data.user
  return json?.user || json?.data?.user || json?.data || json;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Usuário não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { profileIds } = await req.json();
    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Informe perfis para enriquecer' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const limitedIds = profileIds.slice(0, 50);
    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'RAPIDAPI_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profiles, error: fetchError } = await supabase
      .from('instagram_scrape_results')
      .select('id, username')
      .in('id', limitedIds)
      .eq('user_id', user.id);

    if (fetchError || !profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Perfis não encontrados' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[RapidAPI] Enriching ${profiles.length} profiles`);

    const enrichedProfiles: any[] = [];
    const now = new Date().toISOString();

    for (const p of profiles) {
      try {
        const item = await fetchProfile(p.username, apiKey);
        if (!item) continue;

        const biography = item.biography || item.bio || null;
        const externalUrl = item.external_url || item.externalUrl || item.website || null;

        const emailFromApi = item.public_email || item.business_email || item.email || null;
        const email = emailFromApi || extractEmail(biography);

        const phoneFromApi = item.public_phone_number || item.contact_phone_number || item.business_phone_number || null;
        let phone = phoneFromApi || extractPhone(biography, externalUrl);
        if (phone) {
          const d = phone.replace(/\D/g, '');
          phone = d.length >= 10 && d.length <= 11 && !d.startsWith('55') ? '55' + d : d;
        }

        const followersCount = item.follower_count ?? item.followersCount ?? item.edge_followed_by?.count ?? 0;
        const followingCount = item.following_count ?? item.followsCount ?? item.edge_follow?.count ?? 0;
        const postsCount = item.media_count ?? item.postsCount ?? item.edge_owner_to_timeline_media?.count ?? 0;
        const isPrivate = item.is_private ?? false;

        const otherSocialLinks = extractSocialLinks(biography, externalUrl);
        const profilePicUrl = item.profile_pic_url_hd || item.profile_pic_url || item.profilePicUrl || null;

        const suspicious = detectSuspicious({
          followersCount, followingCount, postsCount, isPrivate, biography, profilePicUrl,
        });

        const updateData: Record<string, any> = {
          full_name: item.full_name || item.fullName || null,
          biography,
          profile_pic_url: profilePicUrl,
          followers_count: followersCount,
          following_count: followingCount,
          posts_count: postsCount,
          is_business_account: item.is_business ?? item.isBusinessAccount ?? false,
          is_verified: item.is_verified ?? item.verified ?? false,
          business_category: item.category || item.business_category_name || item.categoryName || null,
          external_url: externalUrl,
          email,
          phone,
          enriched_at: now,
          fbid: item.fbid || item.facebookId || null,
          other_social_links: Object.keys(otherSocialLinks).length > 0 ? otherSocialLinks : null,
          is_suspicious: suspicious.isSuspicious,
          suspicious_reasons: suspicious.reasons.length > 0 ? suspicious.reasons : null,
        };

        const { data: updated, error: updateError } = await supabase
          .from('instagram_scrape_results')
          .update(updateData)
          .eq('id', p.id)
          .eq('user_id', user.id)
          .select()
          .maybeSingle();

        if (updateError) console.error('Update error:', p.id, updateError.message);
        else if (updated) enrichedProfiles.push(updated);
      } catch (err) {
        console.error(`Enrich ${p.username} error:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`Enriched ${enrichedProfiles.length} profiles`);

    return new Response(
      JSON.stringify({
        success: true,
        data: enrichedProfiles,
        total: enrichedProfiles.length,
        requested: limitedIds.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Instagram enricher error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
