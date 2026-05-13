import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';

async function rapidPostForm(path: string, body: Record<string, string>, apiKey: string) {
  const url = `https://${RAPIDAPI_HOST}${path}`;
  const form = new URLSearchParams(body);
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(`[StableAPI] ${path} error [${resp.status}]:`, text.slice(0, 500));
    throw new Error(`Stable API ${path} falhou: ${resp.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    console.error(`[StableAPI] ${path} parse error:`, text.slice(0, 300));
    throw new Error(`Resposta inválida da Stable API em ${path}`);
  }
}

function ensureApiSuccess(json: any, path: string) {
  const message = json?.error || json?.message;
  if (typeof message === 'string' && message.trim()) {
    console.error(`[StableAPI] ${path} returned error:`, message.slice(0, 500));
    throw new Error(message.includes('quota') || message.includes('exceeded')
      ? 'Cota da RapidAPI excedida para a Instagram Scraper Stable API. Faça upgrade/renove o plano na RapidAPI ou troque a chave.'
      : message);
  }
  return json;
}

function pickList(json: any): any[] {
  return (
    json?.data?.items ||
    json?.data?.users ||
    json?.data ||
    json?.items ||
    json?.users ||
    json?.followers ||
    json?.followings ||
    (Array.isArray(json) ? json : [])
  );
}

async function fetchFollowersOrFollowing(
  username: string,
  type: 'Followers' | 'Following',
  limit: number,
  apiKey: string
): Promise<any[]> {
  // v2 endpoint returns up to 50 per call, paginate with start_from
  const path = '/get_ig_user_followers_v2.php';
  // The same endpoint serves followers/following; the API differentiates by another flag.
  // Most variants of this provider use the same `/get_ig_user_followers.php` for both,
  // but the catalog also has a separate "Following List". Try a `kind` param fallback.
  const all: any[] = [];
  let paginationToken: string | null = null;
  let safety = 0;

  while (all.length < limit && safety < 25) {
    safety++;
    const body: Record<string, string> = {
      username_or_url: username,
      data: type === 'Followers' ? 'followers' : 'followings',
      amount: String(Math.min(50, limit - all.length)),
    };
    if (paginationToken) body.pagination_token = paginationToken;

    const json = ensureApiSuccess(await rapidPostForm(path, body, apiKey), path);
    const list = pickList(json);
    if (!Array.isArray(list) || list.length === 0) break;

    all.push(...list);

    paginationToken = json?.pagination_token || json?.data?.pagination_token || json?.next_pagination_token || null;
    if (!paginationToken) break;
    if (list.length < 50) break; // last page
  }

  return all.slice(0, limit);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { usernames, scrapeType = 'Followers', limit = 100 } = await req.json();

    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Informe ao menos um username' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['Followers', 'Following'].includes(scrapeType)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de scrape inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limitedUsernames: string[] = usernames.slice(0, 5).map((u: string) => u.trim().replace('@', ''));
    const resultsLimit = Math.min(Math.max(1, limit), 500);

    console.log(`[StableAPI] Scraping ${scrapeType} for ${limitedUsernames.length} profiles, limit ${resultsLimit}, user ${user.id}`);

    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RAPIDAPI_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cache check (last 24h)
    const { data: existingResults } = await supabase
      .from('instagram_scrape_results')
      .select('*')
      .eq('user_id', user.id)
      .in('source_username', limitedUsernames)
      .eq('scrape_type', scrapeType.toLowerCase())
      .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (existingResults && existingResults.length > 0) {
      console.log(`Cache hit: ${existingResults.length} results`);
      return new Response(
        JSON.stringify({
          success: true,
          data: existingResults,
          total: existingResults.length,
          fromCache: existingResults.length,
          newlyScraped: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scrapedProfiles: any[] = [];

    for (const sourceUsername of limitedUsernames) {
      try {
        const items = await fetchFollowersOrFollowing(sourceUsername, scrapeType, resultsLimit, apiKey);
        console.log(`[${sourceUsername}] got ${items.length} ${scrapeType}`);

        for (const item of items) {
          const u = item.user || item;
          const profileData = {
            user_id: user.id,
            username: (u.username || u.user_name || '')?.toLowerCase(),
            full_name: u.full_name || u.fullName || null,
            biography: null,
            profile_pic_url: u.profile_pic_url || u.profilePicUrl || u.profile_pic || null,
            followers_count: 0,
            following_count: 0,
            posts_count: 0,
            is_business_account: false,
            is_verified: u.is_verified ?? u.verified ?? false,
            business_category: null,
            external_url: null,
            email: null,
            phone: null,
            raw_data: item,
            scraped_at: new Date().toISOString(),
            source_username: sourceUsername.toLowerCase(),
            scrape_type: scrapeType.toLowerCase(),
            is_private: u.is_private ?? false,
          };

          if (!profileData.username) continue;

          const { data: inserted, error: insertError } = await supabase
            .from('instagram_scrape_results')
            .insert(profileData)
            .select()
            .single();

          if (insertError) {
            console.error('Insert error:', insertError.message);
          } else if (inserted) {
            scrapedProfiles.push(inserted);
          }
        }
      } catch (err) {
        console.error(`Error scraping ${sourceUsername}:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`Saved ${scrapedProfiles.length} profiles`);

    return new Response(
      JSON.stringify({
        success: true,
        data: scrapedProfiles,
        total: scrapedProfiles.length,
        fromCache: 0,
        newlyScraped: scrapedProfiles.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Instagram scraper error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
