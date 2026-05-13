import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'instagram120.p.rapidapi.com';

function extractShortcode(url: string): string | null {
  const m = url.match(/\/(?:p|reel|tv)\/([^\/?#]+)/);
  return m ? m[1] : null;
}

async function fetchComments(shortcode: string, limit: number, apiKey: string): Promise<any[]> {
  const all: any[] = [];
  let nextMinId: string | null = null;
  let safety = 0;

  while (all.length < limit && safety < 20) {
    safety++;
    const url = new URL(`https://${RAPIDAPI_HOST}/api/instagram/post_comments`);
    url.searchParams.set('shortcode', shortcode);
    if (nextMinId) url.searchParams.set('min_id', nextMinId);

    const resp = await fetch(url.toString(), {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`Comments ${shortcode} error [${resp.status}]:`, txt);
      throw new Error(`RapidAPI comments falhou: ${resp.status}`);
    }

    const json = await resp.json();
    const list: any[] =
      json?.comments || json?.data?.comments || json?.data || (Array.isArray(json) ? json : []);

    if (!Array.isArray(list) || list.length === 0) break;
    all.push(...list);

    nextMinId = json?.next_min_id || json?.data?.next_min_id || null;
    if (!nextMinId) break;
  }

  return all.slice(0, limit);
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

    const { postUrls, resultsLimit = 100 } = await req.json();
    if (!postUrls || !Array.isArray(postUrls) || postUrls.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Informe ao menos uma URL de post' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const limitedUrls: string[] = postUrls.slice(0, 5).map((u: string) => u.trim()).filter(Boolean);
    const commentsLimit = Math.min(Math.max(1, resultsLimit), 500);

    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'RAPIDAPI_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cache check (24h)
    const { data: existing } = await supabase
      .from('instagram_comments')
      .select('*')
      .eq('user_id', user.id)
      .in('post_url', limitedUrls)
      .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (existing && existing.length > 0) {
      const cachedUrls = new Set(existing.map((r) => r.post_url));
      if (limitedUrls.every((u) => cachedUrls.has(u))) {
        return new Response(
          JSON.stringify({
            success: true,
            data: existing,
            total: existing.length,
            fromCache: existing.length,
            newlyScraped: 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const scrapedComments: any[] = [];

    for (const postUrl of limitedUrls) {
      const shortcode = extractShortcode(postUrl);
      if (!shortcode) {
        console.warn(`No shortcode extracted from ${postUrl}`);
        continue;
      }

      try {
        const items = await fetchComments(shortcode, commentsLimit, apiKey);
        console.log(`[${shortcode}] got ${items.length} comments`);

        for (const item of items) {
          const owner = item.user || item.owner || {};
          const commentData = {
            user_id: user.id,
            post_url: postUrl,
            post_id: shortcode,
            comment_id: String(item.pk || item.id || `${Date.now()}-${Math.random()}`),
            comment_text: item.text || '',
            commenter_username: owner.username || item.ownerUsername || 'unknown',
            commenter_full_name: owner.full_name || owner.fullName || item.ownerFullName || null,
            commenter_profile_pic: owner.profile_pic_url || owner.profilePicUrl || null,
            commenter_is_verified: owner.is_verified ?? owner.verified ?? false,
            likes_count: item.comment_like_count ?? item.like_count ?? item.likesCount ?? 0,
            timestamp: item.created_at
              ? new Date(item.created_at * 1000).toISOString()
              : item.timestamp
              ? new Date(item.timestamp).toISOString()
              : null,
            is_reply: false,
            parent_comment_id: null,
            raw_data: item,
            scraped_at: new Date().toISOString(),
          };

          const { data: inserted, error: insertError } = await supabase
            .from('instagram_comments')
            .upsert(commentData, { onConflict: 'user_id,post_url,comment_id' })
            .select()
            .single();

          if (insertError) console.error('Insert comment error:', insertError.message);
          else if (inserted) scrapedComments.push(inserted);
        }
      } catch (err) {
        console.error(`Scrape ${postUrl} error:`, err instanceof Error ? err.message : err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: scrapedComments,
        total: scrapedComments.length,
        fromCache: 0,
        newlyScraped: scrapedComments.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Instagram comments scraper error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
