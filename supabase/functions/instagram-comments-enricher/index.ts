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
    const wa = url.match(/wa\.me\/(\d+)/);
    if (wa) return wa[1];
    const api = url.match(/api\.whatsapp\.com\/send\?phone=(\d+)/);
    if (api) return api[1];
  }
  if (!text) return null;
  const patterns = [/(?:\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/, /\+\d{10,15}/];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].replace(/\D/g, '');
  }
  return null;
}

async function fetchProfile(username: string, apiKey: string): Promise<any | null> {
  const url = `https://${RAPIDAPI_HOST}/api/instagram/profile?username=${encodeURIComponent(username)}`;
  const resp = await fetch(url, {
    headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': RAPIDAPI_HOST },
  });
  if (!resp.ok) {
    console.error(`Profile ${username} failed [${resp.status}]`);
    return null;
  }
  const json = await resp.json();
  return json?.user || json?.data?.user || json?.data || json;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('RAPIDAPI_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'RAPIDAPI_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { commentIds } = await req.json();
    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'commentIds is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: commentsData, error: fetchError } = await supabase
      .from('instagram_comments')
      .select('id, commenter_username')
      .in('id', commentIds)
      .eq('user_id', user.id);

    if (fetchError) throw new Error('Failed to fetch comments');
    if (!commentsData || commentsData.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No comments found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uniqueUsernames = [...new Set(commentsData.map((c) => c.commenter_username).filter(Boolean))];
    console.log(`[RapidAPI] Enriching ${uniqueUsernames.length} unique usernames`);

    const profileMap = new Map();
    for (const username of uniqueUsernames) {
      try {
        const item = await fetchProfile(username, apiKey);
        if (!item) continue;

        const biography = item.biography || item.bio || null;
        const externalUrl = item.external_url || item.externalUrl || item.website || null;
        const emailApi = item.public_email || item.business_email || null;
        const phoneApi = item.public_phone_number || item.contact_phone_number || null;

        profileMap.set(username, {
          commenter_biography: biography,
          commenter_email: emailApi || extractEmail(biography),
          commenter_phone: phoneApi || extractPhone(biography, externalUrl),
          commenter_followers_count:
            item.follower_count ?? item.followersCount ?? item.edge_followed_by?.count ?? 0,
          commenter_following_count:
            item.following_count ?? item.followsCount ?? item.edge_follow?.count ?? 0,
          commenter_posts_count:
            item.media_count ?? item.postsCount ?? item.edge_owner_to_timeline_media?.count ?? 0,
          commenter_is_business: item.is_business ?? item.isBusinessAccount ?? false,
          commenter_business_category: item.category || item.business_category_name || null,
          commenter_external_url: externalUrl,
          enriched_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Enrich ${username} error:`, err instanceof Error ? err.message : err);
      }
    }

    const enrichedComments: any[] = [];
    for (const [username, enrichData] of profileMap) {
      const { data } = await supabase
        .from('instagram_comments')
        .update(enrichData)
        .eq('user_id', user.id)
        .ilike('commenter_username', username)
        .select();
      if (data) enrichedComments.push(...data);
    }

    console.log(`Updated ${enrichedComments.length} comments`);

    return new Response(
      JSON.stringify({
        success: true,
        total: enrichedComments.length,
        uniqueProfiles: profileMap.size,
        data: enrichedComments,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Enricher error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
